# Semantic Search — `global_knowledge`

Pesquisa semântica em `public.global_knowledge` usando `pgvector` (Neon).

## Stack

- Modelo de embedding: **OpenAI `text-embedding-3-small`** (1536 dims).
- Coluna: `global_knowledge.embedding vector(1536)` (já existia, RLS por `workspace_id`).
- Índice: HNSW (`idx_global_knowledge_embedding_hnsw`) + ivfflat legado (`global_knowledge_embedding_idx`).
- Função SQL: `public.search_knowledge_semantic(query_embedding, workspace_id_filter, match_count, similarity_threshold)`.

## Variáveis de ambiente

- `OPENAI_API_KEY` — obrigatória pra `search-knowledge` e `embed-knowledge`.
- `CRON_SECRET` — opcional, libera `embed-knowledge` via Bearer.
- `DATABASE_URL` — Neon (já existente).

## Componentes

### Helper `api/_lib/shared/embeddings.ts`

- `generateEmbedding(text: string): Promise<number[]>` — single embedding.
- `generateEmbeddings(texts: string[]): Promise<number[][]>` — batch.
- `toVectorLiteral(embedding: number[]): string` — converte pra formato `[0.1,0.2,...]` aceito por `$N::vector`.
- `EMBEDDING_MODEL` / `EMBEDDING_DIMS` — constantes (`text-embedding-3-small`, 1536).

### Migration `migrations/0005_semantic_search.sql`

- Cria índice HNSW (`m=16`, `ef_construction=64`).
- Recria função `search_knowledge_semantic` com retorno `(id, title, content, summary, category, source_url, similarity)` filtrando por workspace + threshold.

### Handler `api/_handlers/embed-knowledge.ts`

Backfill de embeddings.

- **Auth**: `x-vercel-cron: 1` ou `Authorization: Bearer $CRON_SECRET` ou usuário JWT presente em `public.super_admins`.
- **Body** (POST JSON):

```json
{
  "workspaceId": "uuid (optional)",
  "batchSize": 50,
  "maxItems": 500,
  "dryRun": false
}
```

- **Comportamento**:
  - Lista `global_knowledge WHERE embedding IS NULL` (filtrando por workspace se passado).
  - Gera embeddings em batches via OpenAI.
  - `UPDATE` em transação por batch.
  - Retorna `{ totalMissing, processed, updated, failedBatches, errors[], duration_ms }`.

- **Exemplos**:

```bash
# Dry run (só conta)
curl -X POST https://<APP>/api/embed-knowledge \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"dryRun":true}'

# Backfill 200 itens
curl -X POST https://<APP>/api/embed-knowledge \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"maxItems":200,"batchSize":50}'

# Backfill apenas uma workspace
curl -X POST https://<APP>/api/embed-knowledge \
  -H "Authorization: Bearer $CRON_SECRET" \
  -d '{"workspaceId":"...","maxItems":1000}'
```

### Handler `api/_handlers/search-knowledge.ts`

Pesquisa híbrida (semantic + ILIKE) — auth user JWT, valida workspace membership.

- **Body**: `{ query, workspaceId, limit?, threshold? }`.
- **Pipeline**:
  1. Gera embedding via OpenAI.
  2. Roda `search_knowledge_semantic` (cosine, threshold default 0.4).
  3. Roda ILIKE em paralelo (cobre itens sem embedding ou queries muito curtas).
  4. Mescla — semantic vence em duplicatas.
- **Retorno**: `{ success, results[], semanticCount, textCount, embedError }`.

### Manifest

`embed-knowledge` foi adicionado a `api/handler-manifest.ts`.

## Fluxo recomendado

1. Itens são adicionados a `global_knowledge` (via UI / `process-knowledge` / etc).
2. Trigger backfill periódico:

   ```bash
   # Vercel cron (recomendado) com header x-vercel-cron
   # Ou manual:
   curl -X POST $URL/api/embed-knowledge -H "Authorization: Bearer $CRON_SECRET"
   ```

3. Frontend chama `search-knowledge` normalmente — fica semantic transparente.
4. Se OpenAI falhar (`embedError != null`), o ILIKE ainda retorna resultados.

## Estado atual (5 maio 2026)

- `global_knowledge` está **vazio** (0 rows). Backfill será no-op até alguém popular a tabela via UI / `process-knowledge`.
- Função / índice / handler / migration prontos.
- `OPENAI_API_KEY` precisa estar setada na Vercel.

## Notas

- A função antiga retornava `(id, title, content, summary, category, source_url, similarity)` — mantivemos a mesma assinatura pra não quebrar handlers existentes.
- Há **dois índices** sobre `embedding`: HNSW (novo) + ivfflat (legado). Drop do ivfflat pode ser feito numa migration posterior depois de validar que o HNSW está sendo escolhido pelo planner.
- Threshold default é `0.4` (cosine similarity). Ajuste via param `threshold` no body do search.
- Limites OpenAI: input máximo 8191 tokens. Truncamos em 24k chars (≈8k tokens) com folga.
