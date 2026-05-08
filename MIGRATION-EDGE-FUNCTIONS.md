# Edge Functions → Vercel Functions Migration

Migração das edge functions Supabase (Deno) para Vercel Functions (Node + TypeScript).

## Status geral

- **92 edge functions** em `supabase/functions/<nome>/index.ts` (mantidas como referência)
- **84 chamadas** `supabase.functions.invoke()` no client substituídas por `apiInvoke()` (`/api/<nome>`)
- **20 funções migradas com lógica funcional**
- **72 funções com stub 501 Not Implemented** (precisam migração futura)
- **Build do client passa**: `bun run build` ✅

## Infra criada

| Arquivo | Função |
|---|---|
| `api/_lib/db.ts` | Pool Neon serverless + helpers `query`, `queryOne`, `insertRow` |
| `api/_lib/auth.ts` | Verificação JWT do Neon Auth (Stack Auth) via JWKS (lib `jose`) |
| `api/_lib/cors.ts` | Headers CORS + handler de preflight |
| `api/_lib/handler.ts` | Wrappers `authedPost` / `anonPost` (CORS + auth + JSON + erros) |
| `api/_lib/llm.ts` | Port simplificado de `_shared/llm.ts` (Gemini + OpenAI + retry/fallback + usage log) |
| `api/_lib/stub.ts` | Helper `notImplemented(name)` para stubs 501 |
| `src/lib/apiInvoke.ts` | Client-side: drop-in replace de `supabase.functions.invoke` |

## Top 25 funções escolhidas

Baseado em contagem de uso no client (`grep invoke src/`):

1. `generate-performance-insights` (3 chamadas)
2. `fetch-rss-feed` (3)
3. `youtube-search` (2)
4. `validate-social-credentials` (2)
5. `validate-csv-import` (2)
6. `twitter-reply` (2)
7. `transcribe-images` (2)
8. `sync-rss-to-library` (2)
9. `send-invite-email` (2)
10. `scrape-website` (2)
11. `process-automations` (2) — STUB
12. `generate-content-v2` (2) — STUB (1027 linhas, depende de 5 helpers)
13. `generate-client-context` (2)
14. `fetch-reference-content` (2)
15. `extract-pdf` (2)
16. `analyze-style` (2)
17. `extract-docx` (2)
18. `kai-chat-stream` (1) — função inexistente no Supabase, deixei stub
19. `kai-content-agent` (1) — VERSÃO SIMPLIFICADA (TODO: port full prompt-builder)
20. `kai-metrics-agent` (1) — streaming SSE
21. `generate-image` (1) — função inexistente, deixei stub
22. `generate-voice-profile` (1)
23. `generate-content-guidelines` (1)
24. `extract-instagram` (1) — usa supabase storage para upload (mantido com supabase-js admin)
25. `extract-youtube` (1)

## Funções migradas com lógica funcional ✅

| Função | Auth | DB | LLM | Notas |
|---|---|---|---|---|
| `extract-pdf` | ✅ | usage log | Gemini Vision | OK |
| `extract-docx` | ✅ | usage log | Gemini Vision | OK |
| `transcribe-images` | optional | usage log | Gemini Vision | OK |
| `scrape-website` | ✅ | upsert client_websites | — | OK |
| `fetch-rss-feed` | optional | — | — | OK |
| `youtube-search` | optional | viral_search_cache | — | YT Data API + Apify fallback |
| `validate-social-credentials` | ✅ | upsert credentials | — | Twitter OAuth 1.0a + LinkedIn |
| `twitter-reply` | ✅ | engagement_opportunities | Gemini | OAuth 1.0a sign |
| `sync-rss-to-library` | ✅ | client_content_library, youtube_videos | — | YouTube + Newsletter |
| `send-invite-email` | manual | — | — | Resend API |
| `validate-csv-import` | optional | platform_metrics | Lovable Gateway | OK |
| `generate-client-context` | ✅ | clients | Gemini 2.0 | grande consolidado |
| `fetch-reference-content` | ✅ | — | Firecrawl | recursive call to /api/extract-youtube |
| `analyze-style` | ✅ | usage log | Gemini Vision | ⚠️ workspace token check skipped |
| `extract-instagram` | ✅ | — | Apify | ⚠️ usa supabase-js para storage |
| `extract-youtube` | ✅ | — | Supadata + YT Inner API | OK |
| `generate-content-guidelines` | optional | clients, library, instagram_posts | callLLM | OK |
| `generate-voice-profile` | optional | clients, library, instagram_posts | Gemini | OK |
| `generate-performance-insights` | ✅ | usage log | Gemini 2.0 | ⚠️ workspace token check skipped |
| `kai-metrics-agent` | optional | platform_metrics, instagram_posts | Lovable Gateway | streaming SSE |
| `kai-content-agent` | optional | clients | Gemini streaming | ⚠️ SIMPLIFIED — falta prompt-builder |

## Stubs 501 Not Implemented 🔜

Todas as 71 demais funções:

`adapt-viral-reel`, `analyze-client-onboarding`, `analyze-image-complete`,
`analyze-youtube-sentiment`, `batch-sync-posts`, `batch-transcribe-posts`,
`delete-account`, `extract-branding`, `extract-knowledge`,
`fetch-beehiiv-metrics`, `fetch-instagram-metrics`, `fetch-late-metrics`,
`fetch-linkedin-apify`, `fetch-tiktok-apify`, `fetch-twitter-apify`,
`fetch-youtube-apify`, `fetch-youtube-metrics`, `firecrawl-scrape`,
`generate-content-learnings`, `generate-content-v2`, `generate-image`,
`generate-radar-brief`, `generate-viral-carousel`, `get-vapid-public-key`,
`google-news-search`, `google-trends-br`, `image-search`, `import-clickup`,
`instagram-search`, `kai-chat-stream`, `kai-planning-agent`, `kai-simple-chat`,
`late-analytics`, `late-disconnect-account`, `late-oauth-callback`,
`late-oauth-start`, `late-post`, `late-verify-accounts`, `late-webhook`,
`late-webhook-reprocess`, `late-webhook-test`, `linkedin-oauth-callback`,
`linkedin-oauth-start`, `linkedin-post`, `mcp-reader`, `process-automations`,
`process-due-date-notifications`, `process-email-notifications`,
`process-knowledge`, `process-push-queue`, `process-recurring-content`,
`process-scheduled-posts`, `publish-viral-carousel`, `research-newsletter-topic`,
`resolve-youtube-channel`, `reverse-engineer`, `scrape-newsletter`,
`search-knowledge`, `send-publish-reminders`, `send-push-notification`,
`sync-all-metrics`, `telegram-daily-report`, `telegram-notify`, `telegram-poll`,
`telegram-send-notification`, `transcribe-media`, `twitter-feed`,
`twitter-oauth-callback`, `twitter-oauth-start`, `twitter-post`,
`unified-content-api`, `update-newsletter-covers`.

Cada um retorna 501 com mensagem `"Edge function X not yet migrated"`.

## Bloqueios técnicos / TODOs

### Helpers `_shared` que precisam ser portados
1. **`_shared/prompt-builder.ts`** — `buildWriterSystemPrompt`, `selectModelForFormat`. Crítico para `kai-content-agent` e `generate-content-v2`. Tem mais de 500 linhas e depende de:
2. **`_shared/knowledge-loader.ts`** — `getFormatDocs`, `getGlobalKnowledge`, `getSuccessPatterns`, `getFullContentContext`, `getStructuredVoice`, `normalizeFormatKey`. Lê arquivos do file system (em Vercel Functions precisam ir para `api/_data/` e ser lidos via `fs.readFile`).
3. **`_shared/format-rules.ts`** — `getFormatRules`, `UNIVERSAL_RULES`. Constants estáticas, port direto.
4. **`_shared/quality-rules.ts`** — `buildForbiddenPhrasesSection`, `UNIVERSAL_OUTPUT_RULES`. Idem.
5. **`_shared/tokens.ts`** — `checkWorkspaceTokens`, `debitWorkspaceTokens`, `getWorkspaceIdFromUser`, `TOKEN_COSTS`, `createInsufficientTokensResponse`. Sistema de quotas por workspace — implementação atual chama Supabase RPC. **Precisa repensar quando schema Neon estiver pronto.** Por enquanto migrações que usavam tokens (`analyze-style`, `generate-performance-insights`) ignoram a verificação.
6. **`_shared/viralCache.ts`** — port inline já feito em `youtube-search`. Pra outras funções (instagram-search, google-news-search, google-trends-br) ainda é stub.
7. **`_shared/ai-usage.ts`** — `logAIUsage`, `estimateTokens`, `estimateImageTokens`, `createSupabaseClient`. Já substituído por inserts diretos em `ai_usage_logs` via Neon pool.

### Auth JWT
- `api/_lib/auth.ts` usa `jose` + JWKS de `process.env.NEON_JWKS_URL || VITE_NEON_JWKS_URL`
- Confere `payload.sub` como user id
- Compatível com Stack Auth — mas se Auth agent escolher outra estrutura de claims, precisa atualizar

### Storage
- `extract-instagram` ainda usa `@supabase/supabase-js` (admin) para upload em bucket `client-files` — outro agente vai migrar storage separadamente
- Mantido como dependência transitória; quando Storage for migrado, trocar `supabase.storage` por equivalente

### Call entre funções
- Algumas funções migradas chamam outras (`sync-rss-to-library` → `extract-youtube`; `fetch-reference-content` → `extract-youtube`)
- Implementado via `fetch('/api/<nome>', ...)` usando `req.headers.host` para reconstruir base URL e propagar JWT do header `authorization`
- Funciona em prod (Vercel) e dev (vite dev pode precisar de proxy)

## Como o client invoca

Antes:
```ts
const { data, error } = await supabase.functions.invoke('extract-pdf', {
  body: { fileUrl, fileName, userId },
});
```

Depois:
```ts
import { apiInvoke } from '../lib/apiInvoke';
const { data, error } = await apiInvoke('extract-pdf', {
  body: { fileUrl, fileName, userId },
});
```

Mesmo formato `{ data, error }`. JWT do Neon Auth é injetado automaticamente via localStorage (`stack-auth.*` ou `kai-auth-token`/`neon-auth-token` keys). Precisa alinhar com Auth agent qual é a chave canônica.

## Próximos passos para Gabriel

1. **Definir env vars no Vercel:**
   - `DATABASE_URL` (Neon connection string com pooler)
   - `NEON_JWKS_URL` (mesmo de `VITE_NEON_JWKS_URL`)
   - `GOOGLE_AI_STUDIO_API_KEY`, `OPENAI_API_KEY` (opcional fallback)
   - `RESEND_API_KEY`, `APIFY_API_KEY`, `APIFY_API_KEY_INSTAGRAM`, `SUPADATA_API_KEY`, `YOUTUBE_API_KEY`, `LOVABLE_API_KEY`, `FIRECRAWL_API_KEY`
   - Mantém `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` enquanto storage não migrar

2. **Confirmar a chave do JWT em localStorage** (talk com Auth agent) e ajustar `getAuthToken()` em `src/lib/apiInvoke.ts` se necessário.

3. **Decidir prioridade dos stubs** — quais 501s são bloqueadores pra cada feature.

4. **Portar `_shared/prompt-builder.ts` + `knowledge-loader.ts` + `format-rules` + `quality-rules`** para `api/_lib/` antes de migrar `generate-content-v2` e `kai-content-agent` versão completa.

5. **Re-implementar quotas** (`tokens.ts`) quando schema Neon do workspace estiver pronto.

## Arquivos modificados/criados

### Criados (api/)
- `api/_lib/db.ts`, `api/_lib/auth.ts`, `api/_lib/cors.ts`, `api/_lib/handler.ts`, `api/_lib/llm.ts`, `api/_lib/stub.ts`
- 92 handlers `api/<nome>.ts` (20 funcionais + 72 stubs)

### Criados (src/)
- `src/lib/apiInvoke.ts`

### Modificados (src/)
- 61 arquivos com `import { apiInvoke } from '...'` adicionado e `supabase.functions.invoke(` → `apiInvoke(`

### package.json
- Adicionados deps: `@vercel/node`, `@neondatabase/serverless`, `jose`
- (`@vercel/blob` já presente via outro agente)
