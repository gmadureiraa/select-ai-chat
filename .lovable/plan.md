

# Plano: Corrigir Sync de Métricas do Late

## Diagnóstico Completo

### Problemas Identificados

1. **72 duplicatas de Instagram** - cada post existe 2 vezes no banco:
   - Registro do Excel: tem métricas reais (likes: 102, 231, 482...)
   - Registro do Late: tem métricas zeradas (likes: 0)

2. **Erro PGRST116** nos logs - ao usar `maybeSingle()` para buscar post por permalink, o Supabase falha quando encontra 2 registros com o mesmo permalink

3. **37 erros reportados** - a maioria dos posts do Instagram não foi atualizada porque a query de verificação falhou

4. **Métricas não sincronizadas** - os registros duplicados do Late foram criados com métricas zeradas, e o update falhou

### Causa Raiz
A correção de deduplicação (usar URL como chave) foi implementada após as duplicatas já terem sido criadas. O código atual falha ao tentar verificar se um post existe porque encontra 2 registros.

---

## Solução

### Parte 1: Corrigir Query de Verificação

Modificar `syncInstagramPosts()` (e similares) para usar `.limit(1).single()` com tratamento adequado, ou usar `.order().limit(1)` para pegar o primeiro registro mesmo quando há duplicatas:

```typescript
// ANTES (falha com duplicatas):
const { data: existing } = await supabase
  .from('instagram_posts')
  .select('...')
  .eq('client_id', clientId)
  .eq('permalink', permalink)
  .maybeSingle();  // ERRO se houver 2+ registros

// DEPOIS (funciona com duplicatas):
const { data: existingList } = await supabase
  .from('instagram_posts')
  .select('...')
  .eq('client_id', clientId)
  .eq('permalink', permalink)
  .order('likes', { ascending: false })  // Pegar o que tem mais likes
  .limit(1);

const existing = existingList?.[0] || null;
```

### Parte 2: Limpar Duplicatas Existentes

SQL para deletar registros duplicados, mantendo o que tem mais métricas:

```sql
-- Deletar duplicatas do Instagram (manter o que tem mais likes)
DELETE FROM instagram_posts 
WHERE id IN (
  SELECT unnest(ids[2:]) -- Todos exceto o primeiro (com mais likes)
  FROM (
    SELECT array_agg(id ORDER BY COALESCE(likes, 0) DESC) as ids
    FROM instagram_posts
    WHERE client_id = 'c1227fa7-f9c4-4f8c-a091-ae250919dc07'
      AND permalink IS NOT NULL
    GROUP BY client_id, permalink
    HAVING COUNT(*) > 1
  ) dupes
);
```

### Parte 3: Garantir Sync de Métricas Completo

Adicionar logs para debugar quais campos vêm da API Late e garantir que todos sejam mapeados corretamente:

```typescript
console.log(`[fetch-late-metrics] Post data from Late:`, {
  permalink: post.platformPostUrl,
  likes: post.likes,
  comments: post.comments,
  shares: post.shares,
  impressions: post.impressions,
  reach: post.reach,
  views: post.views,
  engagementRate: post.engagementRate
});
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/fetch-late-metrics/index.ts` | Trocar `maybeSingle()` por `.order().limit(1)` + adicionar logs de debug |
| SQL (executar no Supabase) | Deletar 72 duplicatas de Instagram |

---

## Resultado Esperado

1. **Sem erros PGRST116** - query funciona mesmo com duplicatas
2. **Métricas sincronizadas** - dados do Late são atualizados nos registros existentes
3. **Sem duplicatas** - limpeza remove registros redundantes
4. **Logs claros** - possível debugar quais métricas vêm da API

---

## Ordem de Execução

1. Primeiro: Limpar duplicatas existentes (SQL)
2. Segundo: Atualizar código para prevenir novos erros
3. Terceiro: Rodar sync novamente para verificar

