# KAI Simple Chat — Vercel Node Migration

Migrated `supabase/functions/kai-simple-chat/` (Deno + Supabase) → `api/_handlers/kai-simple-chat.ts` (Vercel Node + Neon).

## Summary

- **Original:** 2264 LOC in `index.ts` + 14 sub-files in `tools/` (3230 LOC total Deno)
- **Migrated:** 2335 LOC in `api/_handlers/kai-simple-chat.ts` + 13 sub-files (2903 LOC) in `api/_lib/kai-chat-tools/`
- **Build:** `bun run build` ✅ passes
- **TypeScript:** clean (no errors with project tsconfig)

## Files

### Main handler
- `api/_handlers/kai-simple-chat.ts` — 2335 LOC (was a 2-line stub)

### Tools directory `api/_lib/kai-chat-tools/`
| File | LOC | Description |
|------|-----|-------------|
| `index.ts` | 55 | Barrel export |
| `kai-stream.ts` | 215 | SSE emitter (uses `res.write` instead of ReadableStream controller) |
| `types.ts` | 61 | Shared types (ToolDefinition, ToolExecutionContext etc.) |
| `registry.ts` | 55 | ToolRegistry class |
| `runner.ts` | 244 | runToolLoop — Gemini function calling orchestrator |
| `echo.ts` | 57 | Diagnostic echo tool |
| `createContent.ts` | 208 | Generates draft via kai-content-agent + persists planning_items |
| `createViralCarousel.ts` | 160 | Calls generate-viral-carousel handler |
| `editContent.ts` | 180 | Reescreve rascunho via kai-content-agent |
| `listPendingApprovals.ts` | 97 | Lista rascunhos/ideias pendentes |
| `getClientContext.ts` | 118 | Brand voice, guidelines, social, stats |
| `searchLibrary.ts` | 147 | ILIKE search em content_library + reference_library |
| `publishNow.ts` | 362 | Publica via late-post handler (com fallback connect_account) |
| `scheduleFor.ts` | 309 | Agenda via late-post handler |
| `connectAccount.ts` | 126 | Devolve URL OAuth via late-oauth-start |
| `getMetrics.ts` | 509 | KPIs + chart + top posts (Instagram/LinkedIn/Twitter/YouTube) |

## Tools registered (function-calling mode)

Quando `body.useTools=true`, o handler usa `runToolLoop` com 11 tools:
1. `echo` — diagnostic
2. `createContent` — gera rascunho
3. `createViralCarousel` — Sequência Viral
4. `editContent` — edita rascunho existente
5. `listPendingApprovals` — lista rascunhos pendentes
6. `getClientContext` — brand voice + guidelines
7. `searchLibrary` — busca biblioteca
8. `publishNow` — publica imediatamente
9. `scheduleFor` — agenda futuro
10. `connectAccount` — OAuth URL
11. `getMetrics` — métricas + chart

## Conversões aplicadas

- `Deno.env.get(X)` → `process.env.X`
- `Deno.serve(handler)` → `export default async function handler(req, res)`
- `import "https://esm.sh/X"` / `npm:X` → import normal (deps já no package.json)
- `createClient(SUPABASE_URL, SERVICE_ROLE_KEY)` → `query()` / `queryOne()` (Neon pg)
- `supabase.from('X').select(...)` → SQL puro com `query<T>()`
- `supabase.functions.invoke('Y', {body})` → `fetch('${internalBaseUrl}/api/Y', {method:'POST', headers:{Authorization}, body})`
- `ReadableStream` SSE controller → `res.setHeader(...)` + `res.write(...)` + `res.end()`
- `crypto.randomUUID()` → `randomUUID` from `node:crypto`
- `btoa(...)` → `Buffer.from(...).toString('base64')`

## Env vars usadas

- `DATABASE_URL` — Neon connection string (já configurado)
- `GOOGLE_AI_STUDIO_API_KEY` — Gemini (já configurado)
- `GROK_API_KEY` — opcional para web search via Grok (não bloqueia se ausente)
- `INTERNAL_API_BASE_URL` — opcional, base URL para chamar outros handlers internos. Default monta de `req.headers.host` ou cai em `https://kai-2-topaz.vercel.app`
- `INTERNAL_SERVICE_TOKEN` ou `SUPABASE_SERVICE_ROLE_KEY` — para auth interno (Telegram bot etc.)

## Stream protocol mantido

Output SSE idêntico ao original:
```
data: {"choices":[{"delta":{"content":"..."}}]}\n\n
data: {"choices":[{"delta":{"action_card":{...}}}]}\n\n
data: [DONE]\n\n
```
Frontend que consome `EventSource` continua compatível.

## Modos suportados

1. **Image generation** — quando mensagem pede imagem → Gemini Image preview, devolve base64 via SSE
2. **Planning card creation** — quando intent regex detecta "criar cards/posts no planejamento" → `generatePlanningCards()` insere em `planning_items`
3. **Tool-calling** (`useTools=true`) — usa `runToolLoop` com Gemini function calling + 11 tools registradas. Suporta `forceTool` (botão clicado) e `orchestratorModel` (upgrade para Pro a partir da 2ª tool call)
4. **Stream normal** (`stream=true`, default) — Gemini SSE → traduzido pra OpenAI-style SSE
5. **Non-streaming** (`stream=false`) — JSON `{ content }` com 200 OK
6. **Internal service auth** — `internalServiceAuth=true` + `userId` + `Authorization: Bearer ${INTERNAL_SERVICE_TOKEN || SUPABASE_SERVICE_ROLE_KEY}`

## Blockers / Notas

### 1. `search_knowledge_semantic` RPC (Supabase pgvector)
A função original chamava `supabase.rpc("search_knowledge_semantic", ...)` — uma stored function pgvector custom do Supabase. No Neon não temos garantia que existe. **Fallback implementado:** tenta SQL direto na função (se ela existir no Neon), e se falhar usa `ILIKE` em `knowledge_base` com tokens da query (sem semantic). Pra ter semantic real, precisa:
- pgvector instalado no Neon
- Migrar a função `search_knowledge_semantic` (em `supabase/migrations/`) para Neon
- Ou rebuilder usando `<=>` operator direto

### 2. RPCs custom referenciadas
Nenhuma outra RPC custom é chamada (apenas `supabase.from(...)` SELECTs/UPDATEs/INSERTs simples — todos portados pra SQL direto).

### 3. `supabase.functions.invoke()` → fetch interno
Substituído por `fetch('${internalBaseUrl}/api/<handler>')` com Bearer auth do usuário. Handlers chamados:
- `kai-content-agent` (já migrado ✅)
- `generate-viral-carousel` (já migrado ✅)
- `late-post` (já migrado ✅)
- `late-oauth-start` (já migrado ✅)
- `extract-youtube` (já migrado ✅)
- `firecrawl-scrape` (já migrado ✅)

`internalBaseUrl` é resolvido na ordem: `process.env.INTERNAL_API_BASE_URL` → `req.headers.host` → fallback `https://kai-2-topaz.vercel.app`.

### 4. Bibliotecas
Nenhuma dep nova precisou ser instalada. `@neondatabase/serverless`, `jose`, `@vercel/node` já estavam no `package.json`. `node:crypto.randomUUID()` é built-in.

### 5. JSONB inserts
Para campos `metadata` (jsonb), passamos `JSON.stringify(...)` como string e o pg cliente serializa correto. Coluna `metadata = $X::jsonb` em UPDATEs explícitos pra garantir cast.

### 6. UUID arrays
Para queries com lista de IDs a excluir (em `fetchLibraryExamples`), uso `$N::uuid[]` + `id <> ALL($N::uuid[])`. Funciona com Neon pg driver passando JS array.

### 7. Compatibilidade Telegram bot
O original aceitava `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` como auth interno. Mantido — o handler agora aceita `Bearer ${INTERNAL_SERVICE_TOKEN}` OU `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` (compat). Setar `INTERNAL_SERVICE_TOKEN` no Vercel quando migrar do Supabase.

## Status

- ✅ `api/_handlers/kai-simple-chat.ts` funcional (não 501)
- ✅ Todas 11 tools portadas em `api/_lib/kai-chat-tools/`
- ✅ `bun run build` passa
- ✅ TypeScript sem erros
- ⚠️ `search_knowledge_semantic` precisa pgvector no Neon pra semantic search real (fallback ILIKE funciona)
- ⚠️ Testar end-to-end no deploy real (especialmente streaming SSE no Vercel Functions)
