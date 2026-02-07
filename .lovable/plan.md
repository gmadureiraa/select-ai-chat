
# Plano: Corrigir Duplicação de Posts no Sync do Late

## Problema Identificado

Ao sincronizar métricas via Late API, os posts estão sendo **duplicados** porque:

1. **Upload manual (CSV/Excel)** usa o **ID numérico** interno do Instagram como `post_id`:
   - Exemplo: `18178406515326641`

2. **Sync via Late API** usa o **shortcode da URL** como `post_id`:
   - Exemplo: `DUWU2iUEQjj`

O mesmo post "O Bitcoin caiu..." aparece duas vezes no banco:

| Origem | post_id | likes | impressions |
|--------|---------|-------|-------------|
| Excel | `18178406515326641` | 292 | 15,489 |
| Late | `DUWU2iUEQjj` | 0 | 0 |

Como o `post_id` é diferente, o **upsert não reconhece como duplicata** e cria um novo registro.

---

## Solução Proposta

### Estratégia: Usar URL como Chave de Deduplicação

Antes de fazer upsert de um post do Late, verificar se já existe um registro com a mesma URL (`permalink` para Instagram, `post_url` para LinkedIn, etc.).

Se existir:
- **Atualizar métricas** do registro existente (se as métricas do Late forem maiores que zero)
- **Não criar novo registro**

Se não existir:
- Criar novo registro normalmente

---

## Implementação

### Parte 1: Modificar `fetch-late-metrics` Edge Function

```typescript
// ANTES: Upsert direto com post_id do Late
const instagramPosts = posts.map(p => ({
  post_id: extractStablePostId('instagram', p), // retorna shortcode
  ...
}));
await supabase.from('instagram_posts').upsert(instagramPosts, { 
  onConflict: 'client_id,post_id' 
});

// DEPOIS: Verificar por URL antes de inserir
async function syncInstagramPosts(supabase, clientId: string, posts: LateAnalyticsPost[]) {
  for (const post of posts) {
    const permalink = post.platformPostUrl;
    if (!permalink) continue;
    
    // Buscar post existente por URL
    const { data: existing } = await supabase
      .from('instagram_posts')
      .select('id, post_id, likes, impressions')
      .eq('client_id', clientId)
      .eq('permalink', permalink)
      .maybeSingle();
    
    if (existing) {
      // Post já existe - atualizar métricas se as novas forem maiores
      const updates: any = { updated_at: new Date().toISOString() };
      
      // Só atualizar métricas se vierem dados maiores que zero
      if (post.likes && post.likes > (existing.likes || 0)) updates.likes = post.likes;
      if (post.impressions && post.impressions > (existing.impressions || 0)) updates.impressions = post.impressions;
      if (post.reach) updates.reach = post.reach;
      if (post.comments) updates.comments = post.comments;
      if (post.engagementRate) updates.engagement_rate = post.engagementRate;
      
      // Marcar como sincronizado
      updates.metadata = { 
        ...(existing.metadata || {}), 
        late_synced_at: new Date().toISOString() 
      };
      
      await supabase
        .from('instagram_posts')
        .update(updates)
        .eq('id', existing.id);
    } else {
      // Post não existe - inserir novo
      await supabase
        .from('instagram_posts')
        .insert({
          client_id: clientId,
          post_id: extractStablePostId('instagram', post),
          permalink,
          caption: post.content,
          likes: post.likes || 0,
          impressions: post.impressions || 0,
          reach: post.reach || 0,
          comments: post.comments || 0,
          engagement_rate: post.engagementRate || 0,
          posted_at: post.publishedAt,
          metadata: { late_post_id: post.id, late_synced_at: new Date().toISOString() }
        });
    }
  }
}
```

### Parte 2: Aplicar Mesma Lógica para Twitter e LinkedIn

- **Twitter**: Usar `tweet_url` ou campo similar para deduplicação
- **LinkedIn**: Usar `post_url` para deduplicação

### Parte 3: Adicionar Índice para Performance (Opcional mas Recomendado)

```sql
CREATE INDEX IF NOT EXISTS idx_instagram_posts_permalink 
  ON instagram_posts(client_id, permalink) 
  WHERE permalink IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_linkedin_posts_url 
  ON linkedin_posts(client_id, post_url) 
  WHERE post_url IS NOT NULL;
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/fetch-late-metrics/index.ts` | Refatorar lógica de upsert para verificar por URL antes de inserir |
| Migration SQL | Adicionar índices para `permalink` e `post_url` |

---

## Limpeza de Dados Existentes

Após implementar a correção, será necessário limpar os registros duplicados:

```sql
-- Identificar duplicatas do Instagram (mesmo permalink, diferentes post_id)
WITH duplicates AS (
  SELECT permalink, client_id, 
         COUNT(*) as count,
         array_agg(id ORDER BY likes DESC) as ids,
         array_agg(post_id) as post_ids
  FROM instagram_posts
  WHERE permalink IS NOT NULL
  GROUP BY permalink, client_id
  HAVING COUNT(*) > 1
)
SELECT * FROM duplicates;

-- Deletar registros duplicados (manter o que tem mais likes)
-- (SQL de limpeza será fornecido após análise dos dados)
```

---

## Fluxo de Sync Corrigido

```text
Late API retorna post
    ↓
Extrai permalink/URL do post
    ↓
Busca no banco: "Existe post com essa URL?"
    ↓
┌─ SIM ─────────────────────────┐    ┌─ NÃO ──────────────────┐
│                               │    │                        │
│ Atualizar métricas se > 0    │    │ Inserir novo registro  │
│ Manter post_id original      │    │ Usar shortcode como ID │
│ Marcar como sincronizado     │    │ Salvar permalink       │
│                               │    │                        │
└───────────────────────────────┘    └────────────────────────┘
```

---

## Resultado Esperado

1. **Sem duplicação**: Posts existentes são atualizados, não duplicados
2. **Métricas preservadas**: Dados do Excel não são sobrescritos com zeros
3. **Atualização inteligente**: Apenas atualiza se novas métricas forem maiores
4. **Performance mantida**: Índices otimizam busca por URL
