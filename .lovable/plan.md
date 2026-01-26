

# Plano: Correções Críticas + Melhorias do kAI

## Resumo Executivo

Após análise detalhada, identifiquei problemas críticos que impedem o kAI de funcionar na sua capacidade máxima, além de inconsistências na landing page.

---

## PROBLEMAS IDENTIFICADOS

### 1. Landing Page - Menção a "7 dias grátis"
**Arquivo:** `src/components/landing/CTASection.tsx` (linha 105)

O texto ainda menciona "7 dias grátis" que não existe mais na estratégia de monetização.

### 2. Mapeamento de Formato Incorreto
**Arquivo:** `supabase/functions/kai-simple-chat/index.ts`

O sistema detecta `"carrossel"` (português) mas busca no banco por esse valor. Porém, o `doc_key` no banco é `"carousel"` (inglês). Resultado: regras não são carregadas.

### 3. Documentação Incompleta no Banco
**Tabela:** `kai_documentation`

| Formato | Arquivo docs/ | Banco kai_documentation |
|---------|--------------|-------------------------|
| Carrossel | 349 linhas (11KB) | 1025 chars (resumo) |
| Newsletter | 290+ linhas | ~900 chars |
| Thread | 200+ linhas | ~1155 chars |

A documentação completa não está no banco - apenas versões resumidas.

### 4. Top Performers Não Carregados
O cliente tem 60 posts no Instagram, mas nenhum com `content_synced_at` preenchido. A query exige esse campo, então retorna vazio.

---

## CORREÇÕES PROPOSTAS

### FASE 1: Correções Imediatas

#### 1.1 Remover "7 dias grátis" do CTA
**Arquivo:** `src/components/landing/CTASection.tsx`

```diff
- <span className="text-background dark:text-foreground font-semibold"> 7 dias grátis</span> para testar.
+ <span className="text-background dark:text-foreground font-semibold"> Sem compromisso</span> para começar.
```

#### 1.2 Corrigir Mapeamento de Formatos
**Arquivo:** `supabase/functions/kai-simple-chat/index.ts`

Adicionar mapeamento PT → EN para busca no banco:

```typescript
const FORMAT_KEY_MAP: Record<string, string> = {
  "carrossel": "carousel",
  "newsletter": "newsletter",
  "thread": "thread",
  "stories": "stories",
  "reels": "reels",
  "post": "instagram_post",
  "linkedin": "linkedin_post",
  "tweet": "tweet",
  "artigo": "x_article",
  "blog": "blog_post",
  "email": "email_marketing",
};

// Na busca de format rules:
const docKey = FORMAT_KEY_MAP[contentCreation.detectedFormat] || contentCreation.detectedFormat;
```

#### 1.3 Remover Restrição de content_synced_at
**Arquivo:** `supabase/functions/kai-simple-chat/index.ts`

Para buscar top performers mesmo sem sync completo:

```diff
const { data: topPosts } = await supabase
  .from("instagram_posts")
  .select("caption, post_type, engagement_rate, likes, full_content")
  .eq("client_id", clientId)
-  .not("content_synced_at", "is", null)
  .order("engagement_rate", { ascending: false })
  .limit(5);
```

---

### FASE 2: Atualizar Documentação Completa

#### 2.1 Migração SQL para Atualizar kai_documentation

Atualizar os formatos no banco com conteúdo completo dos arquivos `docs/formatos/*.md`:

```sql
UPDATE kai_documentation 
SET content = $DOC$
[Conteúdo completo do CARROSSEL.md - 349 linhas]
$DOC$,
    version = version + 1,
    updated_at = now()
WHERE doc_type = 'format' AND doc_key = 'carousel';
```

**Formatos a atualizar:**
- carousel (CARROSSEL.md)
- newsletter (NEWSLETTER.md)
- thread (THREAD.md)
- stories (STORIES.md)
- instagram_post (POST_INSTAGRAM.md)
- linkedin_post (LINKEDIN_POST.md)
- tweet (TWEET.md)
- x_article (ARTIGO_X.md)
- blog_post (BLOG_POST.md)
- email_marketing (EMAIL_MARKETING.md)

Cada documento será expandido para incluir:
- Estrutura obrigatória completa
- Exemplos práticos
- Formato de entrega
- Erros comuns a evitar
- Estratégias de engagement

---

## ARQUIVOS A MODIFICAR

| Arquivo | Mudança |
|---------|---------|
| `src/components/landing/CTASection.tsx` | Remover "7 dias grátis" |
| `supabase/functions/kai-simple-chat/index.ts` | Adicionar FORMAT_KEY_MAP, remover filtro content_synced_at |
| Migração SQL | Atualizar kai_documentation com conteúdo completo |

---

## RESULTADO ESPERADO

Após implementação:

1. **Landing page** sem menção a trial gratuito inexistente
2. **Format detection** funcionando corretamente (carrossel → carousel)
3. **Top performers** carregados para todo cliente com posts
4. **Regras de formato** completas (11KB+ vs 1KB resumo)
5. **Qualidade do conteúdo** significativamente melhorada

---

## ORDEM DE IMPLEMENTAÇÃO

1. Corrigir CTASection.tsx (remoção "7 dias grátis")
2. Adicionar FORMAT_KEY_MAP no kai-simple-chat
3. Remover filtro content_synced_at
4. Criar migração SQL para atualizar kai_documentation com conteúdo completo

