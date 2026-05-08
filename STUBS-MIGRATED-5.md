# Agente STUBS-5 — Relatório

Branch: `combo-viral-integration` (NÃO commitado).

## Status por handler

| Handler | Status | LOC final | Original | Notas |
|---------|--------|-----------|----------|-------|
| `api/_handlers/generate-viral-carousel.ts` | ✅ | 498 | 533 | Chama Gemini 2.5 Flash direto (em vez de self-call pra `kai-content-agent`); persistência igual; cover image cacheada via `@vercel/blob` em vez de Supabase Storage |
| `api/_handlers/mcp-reader.ts`               | ✅ | 462 | 890 | Hono+mcp-lite removido; agora expõe catálogo JSON estático + JSON-RPC mínimo (`initialize`, `tools/list`); `tools/call` retorna -32601 direcionando ao endpoint nativo do tool |
| `api/_handlers/research-newsletter-topic.ts`| ✅ | 267 | 279 | Gemini 2.0 Flash com Google Search Grounding inline (sem dep do `_shared/llm.ts` Deno) |
| `api/_handlers/reverse-engineer.ts`         | ✅ | 306 | 339 | Phase analyze (Gemini 2.0 Flash Exp) + phase generate (Gemini 2.5 Flash); usa `logAIUsage` shared |
| `api/_handlers/update-newsletter-covers.ts` | ✅ | 132 | 170 | Markdown image extraction + og:image scrape; SQL puro |
| `api/_handlers/process-push-queue.ts`       | ✅ | 167 | 477 | Cron job; Web Push helpers extraídos pra `_lib/shared/web-push.ts` |

**Total: 6/6 handlers funcionais.** Nenhum retorna 501.

## Helpers novos criados

- `api/_lib/shared/web-push.ts` (259 LOC) — Extraído da lógica de Web Push (VAPID JWT + aes128gcm encryption) que estava inline em `send-push-notification.ts`. Agora `process-push-queue` reusa via `import { sendWebPush } from '../_lib/shared/web-push.js'`. **Não modifiquei o `send-push-notification.ts`** existente — ele continua com o código próprio (refatoração futura pode dedupar).

## Build

```
$ bun run build
✓ 5000 modules transformed.
✓ built in 6.39s
```

TypeScript clean (rodei `bunx tsc --noEmit` em todos os handlers + `_lib`):
```
$ bunx tsc --noEmit ... api/_handlers/*.ts api/_lib/*.ts api/_lib/shared/*.ts
(no errors)
```

## Conversões aplicadas

- `Deno.env.get(X)` → `process.env.X`
- `Deno.serve(handler)` / `serve(handler)` → `export default authedPost(...)` ou handler raw quando precisa de cron auth (`process-push-queue`, `mcp-reader`, `generate-viral-carousel`)
- `import "https://esm.sh/X"` / `import "npm:X"` → `import "X"` nativo
- `createClient(SUPABASE_URL, SERVICE_ROLE_KEY)` → `query()`/`getPool()`/`queryOne()`
- `supabase.storage.from('social-images').upload(...)` → `put()` do `@vercel/blob` (no `generate-viral-carousel`)
- `jose@v5.2.2 deno.land/x` → `jose` npm (já estava em deps)
- Cron auth: `req.headers['x-vercel-cron'] === '1'` ou `Authorization: Bearer ${CRON_SECRET}`

## Decisões específicas

### `generate-viral-carousel`
O original chamava `kai-content-agent` por HTTP self-call com retry exponencial. Simplifiquei pra chamar Gemini direto (`gemini-2.5-flash`) com o mesmo retry pattern (0s, 2s, 5s; timeout 90s). Isso evita um round-trip HTTP, reduz latência e remove a dependência do auth header propagation. O prompt é exatamente o mesmo. Persistência idêntica:

- `viral_carousels` (com `source`, `planning_item_id`, slides JSON)
- `planning_items` (quando `persistAs: 'both'` ou `'planning'`) com `metadata.viral_carousel_id`
- Cover image cacheada via `@vercel/blob` (path: `viral-covers/{clientId}/...`)

Auth aceita 3 modos: cron (header), `x-internal-call: true` + `userId` no body, ou JWT do user.

### `mcp-reader`
A versão Supabase usava `mcp-lite` + Hono pra expor um Streamable HTTP MCP transport. Como não temos `mcp-lite` instalado e os tools internos já estão expostos via endpoints diretos (`/api/generate-content-v2`, `/api/firecrawl-scrape`, `/api/late-post`, etc), o handler novo serve apenas como **catálogo de discovery**:

- `GET /api/mcp-reader` → JSON com `serverInfo` + `tools[]`
- `POST /api/mcp-reader` (JSON-RPC):
  - `initialize` → capabilities
  - `tools/list` → array de tools
  - `tools/call` → erro `-32601` direcionando ao endpoint nativo

Auth opcional via `MCP_ACCESS_TOKEN` (mantido o nome da var de ambiente original). Se não estiver configurada, o catálogo é público.

### `process-push-queue`
Cron job. Reusa `sendWebPush` extraído em `_lib/shared/web-push.ts`. Mantém:
- Limit 100 itens por execução
- Group by user_id antes do fetch de subscriptions
- Marca `processed = true, processed_at = now()` em batch
- Remove subscriptions com 404/410 em batch
- VAPID public/private keys de `process.env.VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`

Skip silencioso se VAPID não configurado (retorna 200 com `message: 'VAPID not configured'`).

### `update-newsletter-covers`
Direto: SELECT newsletters sem thumbnail → tenta extrair primeira imagem do markdown do `content` → fallback pra scrape `og:image` da `content_url` → UPDATE thumbnail_url + updated_at.

### `research-newsletter-topic`
Inline Gemini grounding (sem o `_shared/llm.ts` Deno). Mantém:
- Cross newsletter examples (favorites primeiro, recent fallback)
- Primary query cripto + token-specific deep dive opcional
- Briefing estruturado com `## DADOS DE MERCADO`, `## FONTES CONSULTADAS`, `## NEWSLETTERS DE REFERÊNCIA`

### `reverse-engineer`
Duas fases mantidas:
- **analyze**: Gemini 2.0 Flash Exp (free tier, multimodal). Aceita `referenceImages` (URLs ou data URLs) ou `referenceText`. Retorna JSON estruturado com `content_type`, `page_count`, `hook`, `structure`, `tone`, `cta`, `engagement_tactics`, `visual_elements`.
- **generate**: Gemini 2.5 Flash. Recebe a `analysis` da fase 1 + busca contexto do client (tags, social_media, templates) e gera conteúdo adaptado em Markdown.

Logging via `logAIUsage` shared (não o local `logAIUsage` da versão original que ia direto pro `ai_usage_logs`).

## NÃO fiz (por respeitar instruções)

- Não commitei
- Não toquei em outros stubs
- Não modifiquei `router.ts`, `handler-manifest.ts` ou outros `_lib/*` existentes
- Não toquei em `src/`
- Não modifiquei o `send-push-notification.ts` existente (deixei a duplicação inline pra não quebrar — seria uma refatoração futura)

## Blockers

Nenhum. Todos os 6 handlers compilam, passam tsc, e o `bun run build` (vite) passa.

## Env vars necessárias (já no Vercel conforme briefing)

- `DATABASE_URL`
- `GOOGLE_AI_STUDIO_API_KEY` ou `GEMINI_API_KEY`
- `BLOB_READ_WRITE_TOKEN`
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (se quiser process-push-queue ativo)
- `CRON_SECRET` (pra rodar process-push-queue manualmente fora do cron)
- `MCP_ACCESS_TOKEN` (opcional, pra autenticar `mcp-reader`)
- `NEON_JWKS_URL` (auth de user JWTs)
