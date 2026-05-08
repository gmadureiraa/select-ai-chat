# Fase D — Knowledge Feedback Loop (concluída)

> Branch: `combo-viral-integration` (não commitar)
> Data: 2026-05-08

## Objetivo

Fechar o loop de aprendizado dos agentes virais: armazenar embeddings + score
de engajamento por conteúdo do cliente e expor isso aos prompts de
`generate-viral-carousel`, `adapt-viral-reel` e `kai-content-agent`. Saída:
melhores referências históricas → menos "frio" no primeiro shot.

## Migrations aplicadas (Neon)

### `migrations/0009_client_content_embeddings.sql`
- Colunas novas em `public.client_content_library`:
  - `embedding vector(1536)` (compatível com `text-embedding-3-small`)
  - `engagement_score numeric DEFAULT 0`
  - `embedded_at timestamptz`
- Função `public.calc_engagement_score(likes, comments, shares)` IMMUTABLE
  → `likes×1 + comments×2 + shares×5` (validado: 100+5+2 → 120 ✓)
- Trigger `client_content_engagement_score` BEFORE INSERT/UPDATE OF metadata
  → atualiza `engagement_score` lendo `metadata.likes / .comments / .shares`
- Indexes:
  - `idx_client_content_embedding` HNSW (vector_cosine_ops, m=16, ef=64)
  - `idx_client_content_engagement` btree (client_id, engagement_score DESC)
  - `idx_client_content_embedding_pending` btree partial WHERE embedding IS NULL

### `migrations/0011_client_top_content_view.sql`
- `MATERIALIZED VIEW public.client_top_content`:
  - filtra `engagement_score > 0` E
    `COALESCE(metadata->>'published_at'::timestamptz, created_at) > now() - 6 months`
  - `ROW_NUMBER() OVER (PARTITION BY client_id ORDER BY engagement_score DESC, created_at DESC) AS rank`
- Função `refresh_client_top_content()` → `REFRESH MATERIALIZED VIEW CONCURRENTLY`
  (testada e funciona)
- Indexes: unique pk(id) + lookup(client_id, rank)
- GRANT SELECT pra `authenticated`, `anon` (e `anonymous` se existir, fail-soft)

## Handler novo: `embed-client-content`

`api/_handlers/embed-client-content.ts`

- Auth: super_admin OR `x-vercel-cron` OR `Authorization: Bearer $CRON_SECRET`
- Body validado por `zod`:
  ```ts
  { workspace_id?, client_id?, batch_size?=50, max_items?=500, dry_run?=false }
  ```
- Filtra por `embedding IS NULL`, opcionalmente por `client_id` ou
  `workspace_id` (via JOIN com `clients`)
- Loop em batches: chama OpenAI `generateEmbeddings`, faz UPDATE em transaction
- Setea `embedded_at = now()` quando atualiza
- Adicionado em `api/handler-manifest.ts` automaticamente

## Helpers novos em `client-context.ts`

### `findSimilarContent(clientId, queryText, limit=5)`
- Gera embedding do `queryText` via OpenAI
- Roda `ORDER BY embedding <=> $vec LIMIT n` em `client_content_library`
- Retorna `{id, title, content, similarity, engagement_score}[]`
- **Falha silenciosa** (retorna `[]`) se OpenAI off / sem embeddings

### `getTopPerformingContent(clientId, limit=5)`
- Lê da `client_top_content` (materialized view)
- Retorna `{id, title, content, engagement_score, rank}[]`
- **Falha silenciosa** se view ainda não existe (migration não rodou)

### `buildClientHistoricalReferences` (refatorado, agora `async`)

Cascata de 3 etapas:

1. Se `query` provided → `findSimilarContent` (similarity por embedding)
2. Senão / se vazio → `getTopPerformingContent` (top score nos 6 meses)
3. Fallback final → ordenação local em memória do `ctx.contentLibrary`
   (favorite + engagement metadata) — preserva comportamento antigo

**Compatibilidade**: aceita `(ctx, n)` antigo OU `(ctx, query, n)` novo.
Detecta o tipo do segundo argumento.

## Callers atualizados (3 arquivos)

| Caller | Query usada na similarity |
|--------|--------------------------|
| `generate-viral-carousel.ts` (`buildPrompt`) | `briefing` |
| `adapt-viral-reel.ts` | `${tema} — ${objetivo}` |
| `kai-content-agent.ts` | `userRequest` (request OR message do user) |

`buildPrompt` em `generate-viral-carousel.ts` virou `async` — o call site já
estava em contexto async, só precisei adicionar `await`.

## Build status

- `bun run build` (Vite frontend) → ✓ passa em 18.55s
- `bunx tsc --noEmit -p tsconfig.app.json` filtrado pra Phase D files
  (`client-context`, `embed-client-content`, `kai-content-agent`,
  `generate-viral-carousel`, `adapt-viral-reel`) → 0 erros
- Erros de TS pré-existentes em `viral-sv-original/`, `ViralRadarTab.legacy.tsx`
  etc. seguem inalterados — não foram introduzidos por Phase D
- `api/handler-manifest.ts` regenerado: 116 handlers (inclui `embed-client-content`)

## Coverage atual de embeddings

```
SELECT count(*) AS total, count(embedding) AS embedded,
       count(*) FILTER (WHERE engagement_score > 0) AS scored
  FROM client_content_library;
```
| total | embedded | scored |
|-------|----------|--------|
|   0   |    0     |   0    |

Tabela está vazia hoje no Neon. Backfill é no-op até começarem a popular.
A view `client_top_content` também tem 0 rows (REFRESH testado e ok).

## Como rodar backfill quando popular a tabela

```bash
# Dry-run (conta sem atualizar)
curl -X POST https://kai-app-combo.vercel.app/api/embed-client-content \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"dry_run": true}'

# Backfill por workspace
curl -X POST https://kai-app-combo.vercel.app/api/embed-client-content \
  -H "Authorization: Bearer $CRON_SECRET" \
  -d '{"workspace_id": "<uuid>", "max_items": 200}'
```

E pra refresh da view:
```sql
SELECT public.refresh_client_top_content();
```
(rodar via cron diário ou após batches grandes de inserts em
`client_content_library`).

## Conflitos potenciais com outros agentes (verificado)

- VIRAL-FRONTEND: paths disjuntos (`src/components/kai/viral-*`,
  `src/store/`) — nenhuma sobreposição
- FASE-C: `migrations/0010`, `save-as-planning-item`, `usePlanningSync` —
  nenhuma sobreposição
- FASE-F: `useViralAccess`, `tokens.ts` — nenhuma sobreposição
- `client-context.ts` foi modificado por outro agente antes desta fase, mas
  helpers `findSimilarContent` / `getTopPerformingContent` não existiam — só
  foram adicionados (sem duplicação)

## Próximos passos sugeridos (fora do escopo Fase D)

- Cron diário pra `refresh_client_top_content()` quando engagement
  empilhar (hoje overhead é zero, sem urgência)
- Opcional: cron diário também pra `embed-client-content` com `workspace_id`
  rotativo, processando ~500 itens/run
- Quando rolar import grande de posts históricos, rodar manual pra popular
  embeddings antes de gerações pesadas
