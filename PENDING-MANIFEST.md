# PENDING-MANIFEST — Pós fix wave 2026-05-16

> Histórico: pendências dos agentes de fix wave consolidadas e PROCESSADAS
> em commits subsequentes. Este arquivo agora documenta apenas o que ainda
> requer ação manual (env vars Vercel, migrations em prod).

---

## ✅ Já aplicado em código (não requer mais ação)

### vercel.json crons array — atualizado

- `process-scheduled-posts` schedule mudou `0 12 * * *` → `*/5 * * * *`
- `process-push-queue` adicionado `*/5 * * * *`
- `process-email-notifications` adicionado `*/5 * * * *`
- `send-publish-reminders` agora 2x/dia (`0 9,17 * * *`)
- `process-due-date-notifications` agora 2x/dia (`0 9,15 * * *`)
- `run-madureira-workflows-daily` adicionado (`0 10 * * *`, dispara os 10 workflows Madureira após remoção do `cron-radar-master`)

### Tools órfãs removidas

- `analyzeViralReelTool` removido (handler `adapt-viral-reel` foi deletado em `e4575fce`)
- `createRadarBriefTool` removido (handler `generate-radar-brief` foi deletado em `e4575fce`)
- Index/registry/system prompt do `kai-simple-chat.ts` atualizados pra apontar usuários pros apps standalone (`reels.kaleidos.com.br` / `radar.kaleidos.com.br`)

---

## 🔧 Ação manual pendente (usuário no Vercel/DB)

### 0. MCP server full (NOVO onda 2026-05-16)

**Contexto:** `mcp-reader.ts` legado expunha catálogo hardcoded de ~20 tools só pra discovery. Substituído por servidor MCP completo com auto-discovery (lê barrel `kai-chat-tools/index.ts` e expõe TODA tool registrada).

**Novos handlers em `api/_handlers/`:**

- `mcp.ts` — endpoint JSON-RPC 2.0 unificado (canônico, `/api/mcp`)
- `mcp-tools-list.ts` — REST + JSON-RPC `tools/list`
- `mcp-tools-call.ts` — REST + JSON-RPC `tools/call`
- `mcp-resources-list.ts` — REST + JSON-RPC `resources/list`
- `mcp-resources-read.ts` — REST + JSON-RPC `resources/read`

**Novos libs em `api/_lib/mcp/`:**

- `auth.ts` — `assertMcpAuth` aceita `KAI_MCP_TOKEN` Bearer OU JWT user
- `registry.ts` — auto-discovery iterando exports do barrel
- `invoke.ts` — converte resultado de tool → MCP `{content, isError, structuredContent}`
- `buffered-emitter.ts` — `KAIStreamEmitter` request/response (não-SSE)
- `resources.ts` — lista/lê `kai://client/<id>`, `kai://planning/<id>`, `kai://library/<id>`

**Adicionar entries em `api/handler-manifest.ts`:**

```ts
'mcp': () => import('./_handlers/mcp.js'),
'mcp-tools-list': () => import('./_handlers/mcp-tools-list.js'),
'mcp-tools-call': () => import('./_handlers/mcp-tools-call.js'),
'mcp-resources-list': () => import('./_handlers/mcp-resources-list.js'),
'mcp-resources-read': () => import('./_handlers/mcp-resources-read.js'),
```

**Manter** `'mcp-reader'` no manifest (legado, backward compat por enquanto). Pode ser removido depois que clients antigos forem migrados pra `/api/mcp`.

**`vercel.json` rewrite — já funciona via router catch-all:**

Não precisa rewrite extra. O `vercel.json` já tem `"/api/:slug*" → "/api/router?slug=:slug*"` que cobre `/api/mcp`, `/api/mcp/tools/list`, etc. O router faz fallback kebab automaticamente (`mcp/tools/list` → `mcp-tools-list`).

**Env vars novas no Vercel:**

```bash
# Token global pro MCP (gerar com: openssl rand -hex 32)
vercel env add KAI_MCP_TOKEN production
```

`MCP_ACCESS_TOKEN` (nome legado usado pelo `mcp-reader`) continua aceito como alias.

**Doc completa:** `MCP-SETUP.md` na raiz do kai-app.

### 1. Env vars no Vercel project KAI

**Bloqueante pra alguns handlers funcionarem em prod:**

- `OPENAI_API_KEY` — usado por `process-knowledge.ts` pra embedding `text-embedding-3-small` (1536 dims)
- `GOOGLE_AI_STUDIO_API_KEY` — usado por `callLLM` (Gemini 2.5 Flash) em vários handlers migrados off-Lovable
- `LOVABLE_API_KEY` pode ser removido — não tem mais nenhum handler usando

**Como aplicar:**
```bash
# via Vercel CLI no projeto kai-app
vercel env add OPENAI_API_KEY production
vercel env add GOOGLE_AI_STUDIO_API_KEY production
vercel env rm LOVABLE_API_KEY production
```

### 2. Migration de backfill — content_pillars

**Antes de rodar, contar rows legacy:**
```sql
SELECT count(*) FROM client_preferences WHERE preference_type = 'content_pillars';
```

**Rodar uma vez em prod (Neon DB):**
```sql
-- migrations/0041_backfill_content_pillars_singular.sql
-- (também disponível em supabase/migrations/20260516130000_*.sql)
```

Sem isso, clientes existentes não veem pilares nos geradores virais até serem editados manualmente.

### 3. Upgrade rate-limit pra Upstash Redis (P1 — não bloqueante)

Hoje `api/_lib/shared/rate-limit.ts` é in-memory — vale por container Vercel, não compartilha entre cold starts. Pra hardening real:

```bash
vercel env add UPSTASH_REDIS_REST_URL production
vercel env add UPSTASH_REDIS_REST_TOKEN production
bun add @upstash/ratelimit @upstash/redis
```

E refatorar `rate-limit.ts` pra usar Upstash quando env presente, fallback in-memory.

### 4. Backfill opcional: instagram_posts.images legados (P2)

`batch-transcribe` e `cron-transcribe-recent-posts` agora ignoram `images: ['client-files/xxx.jpg']` órfãos do Supabase Storage. Pra limpar:

```sql
UPDATE instagram_posts
SET images = NULL
WHERE images IS NOT NULL
  AND thumbnail_url IS NULL;
```

### 5. Reativar tabelas per-client (P2 — quando integrar Metricool)

`useUnifiedContent` parou de ler tabelas órfãs `twitter_posts` / `linkedin_posts`. Quando o sync per-client via Metricool estiver pronto, reativar bloco comentado apontando pro shape novo.

---

## 📋 Pendências de outras ondas de FIX (não processadas)

### Clients/Brand — próxima onda

**Handlers novos a criar:**
- `client-document-create`
- `client-website-{create,update,delete}` (ou expandir `client-update` com payload `websites: Website[]`)
- `client-reference-{create,update,delete}`
- `client-visual-reference-create` (com rate-limit no `analyze-style` downstream)

**Hooks ainda em direct supabase (migrar pra handlers):**
- `useClientWebsites`
- `useReferenceLibrary` (atenção: chama RPC `log_user_activity` — verificar se existe no Neon)
- `useClientVisualReferences`
- `useClientDocuments`
- `AIContextTab` (linha de `voice_profile`/`content_guidelines`)
- `ClientAnalyticsTab` (linhas 106-114)

**Wizards duplicados (P1, decisão pendente):**
- `ClientCreationWizardSimplified` (2-step sidebar) vs `ClientOnboardingWizard` (5-step rota `/clients`)
- Cliente criado pelo sidebar não ganha preferences/refs/social import
- Decidir: unificar ou separar explicitamente. Custo: 4-8h.

### Backend Infra — próxima onda

- **SQL injection latente** em `process-scheduled-posts` (pattern TS union é seguro mas vale refator) — ~1h
- **Dedup Stripe webhook** — P1
- **`FOR UPDATE SKIP LOCKED`** universal em cron pickups — P1
- **MVIEW refresh fora do handler principal** — P1
- **`ENV-VARS.md` completo** — P1
- **Neon RLS Authorize refator** — fundamento de auth no server pool. ~12h.

### Frontend/UX — próxima onda

- Settings members vs team dedupe (1.602 linhas duplicadas)
- Bundle inicial pesado (chart-vendor 397kB — vem do performance-v2, não tem como lazy load fácil)
- `viral-sv-original` extract (60-80h — projeto separado)
- `RDtoaster` duplicado (radix+sonner)
- Pull-to-refresh, design tokens warning/success/info, MobileHeader cluttered
- Migração Tailwind v3 → v4 (não prioridade)

---

*Atualizado 2026-05-16 — após processar todos os PENDING-MANIFEST das 6 fix waves do KAI.*
