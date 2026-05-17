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

### 1b. Migration 0043 — approval_tokens (NOVO 2026-05-17)

**Contexto:** `api/_lib/approval-flow.ts` migrou de `Map<string, ApprovalToken>` in-memory pra tabela Postgres `approval_tokens`. Multi-instância Vercel quebrava o flow antigo (lambda A gera token → lambda B recebe consume → Map vazio → "Token inválido"). Detalhes completos no header da migration `migrations/0043_approval_tokens.sql`.

**Rodar uma vez em prod (Neon DB):**
```sql
-- migrations/0043_approval_tokens.sql
-- mirror: supabase/migrations/20260517110000_approval_tokens.sql
```

Sem isso, todas as tools com approval flow (deleteContent, deleteTask, deleteAutomation, deleteReference, deletePlanningItem) vão falhar em prod assim que o deploy entrar — `requireApproval` faz INSERT na tabela.

**Novo cron diário** já está em `vercel.json` (`/api/cron-approval-tokens-cleanup` às `0 3 * * *`). Não requer ação manual além de aplicar a migration.

**Smoke test:** `e2e/_approval-flow-postgres.spec.ts` (skipa sem `DATABASE_URL`). Roda local: `DATABASE_URL=... bunx playwright test e2e/_approval-flow-postgres.spec.ts`.

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

### 3. Upgrade rate-limit pra Upstash Redis ✅ código aplicado, faltam envs

`api/_lib/shared/rate-limit.ts` refatorado em 2026-05-17 — agora detecta Upstash
e cai pra in-memory quando ausente:

- Nova API async: `rateLimit({ key, limit, windowMs })` retorna
  `{allowed, remaining, reset, retryAfterSec}`. Sliding window via
  `@upstash/ratelimit` (prefix `kai:rl`).
- API legada `checkRateLimit(req, { key, maxPerMinute, maxPerHour? })`
  preservada como alias síncrono in-memory pros handlers que não querem
  `await` (firecrawl-scrape, radar-img-proxy, scrape-newsletter, image-search,
  fetch-rss-feed, generate-content-guidelines).
- Deps adicionadas: `@upstash/ratelimit@2.0.8`, `@upstash/redis@1.38.0`.
- MCP handlers (`mcp.ts` + `mcp-tools-call.ts`) agora aplicam rate-limit
  por bucket (cheap 60/min · normal 20/min · expensive 5/min · destructive
  3/min) — classificação em `api/_lib/mcp/rate-limit-policy.ts`.

**Setar no Vercel pra ativar modo distribuído:**

```bash
# Provisionar Upstash Redis via Vercel Marketplace (recomendado) ou direto em
# console.upstash.com (free tier OK).
vercel env add UPSTASH_REDIS_REST_URL production
vercel env add UPSTASH_REDIS_REST_TOKEN production
vercel env add UPSTASH_REDIS_REST_URL preview
vercel env add UPSTASH_REDIS_REST_TOKEN preview
vercel deploy --prod
```

**Sem essas envs:** fallback in-memory continua funcionando — protege contra
abuse oportunista do mesmo container, mas não tem sync cross-instance. Em
múltiplas λ warm o cap efetivo é (cap nominal × N instâncias). Pra MCP isso
ainda é melhor do que nada porque attacker precisaria abrir N conexões TCP
simultâneas no mesmo segundo pra burlar.

**Verificar headers em prod:**

```bash
curl -i -X POST -H "Authorization: Bearer $KAI_MCP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"listClients","arguments":{"limit":1}}' \
  https://kai.kaleidos.com.br/api/mcp/tools/call \
  | grep -i x-ratelimit
# X-RateLimit-Bucket: cheap
# X-RateLimit-Limit: 60
# X-RateLimit-Remaining: 59
# X-RateLimit-Reset: 1747506678
```

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

---

## 🔧 Adicionar em `api/handler-manifest.ts` (WRITE/DELETE tools agent, 2026-05-16)

Os 15 novos chat tools (10 WRITE/EDIT + 5 DELETE) precisam destes 10 handlers
registrados no manifest pra `/api/router?slug=<x>` funcionar em produção:

```ts
'team-tasks-update': () => import('./_handlers/team-tasks-update.js'),
'team-tasks-delete': () => import('./_handlers/team-tasks-delete.js'),
'planning-items-delete': () => import('./_handlers/planning-items-delete.js'),
'automations-delete': () => import('./_handlers/automations-delete.js'),
'workspace-members-add': () => import('./_handlers/workspace-members-add.js'),
'workspace-members-remove': () => import('./_handlers/workspace-members-remove.js'),
'workspace-members-update-role': () => import('./_handlers/workspace-members-update-role.js'),
'reference-update': () => import('./_handlers/reference-update.js'),
'reference-delete': () => import('./_handlers/reference-delete.js'),
'client-settings-update': () => import('./_handlers/client-settings-update.js'),
```

Sem isso, as tools chamam `/api/router?slug=team-tasks-update` etc e o
router não acha o handler → 404. Detalhes completos em
`PENDING-AGENT-MERGE.md` seção "WRITE/DELETE TOOLS".

---

## ✅ Adicionado em `handler-manifest.ts` (P0 hooks migration agent, 2026-05-17)

Os 16 novos handlers criados pra fechar o gap de `supabase.from()` direto
nos hooks (Backend Consistency audit). JÁ registrados no manifest no
commit `0d1aec94`:

```ts
'client-delete': () => import('./_handlers/client-delete.js'),
'client-document-create': () => import('./_handlers/client-document-create.js'),
'content-feedback-create': () => import('./_handlers/content-feedback-create.js'),
'import-history-create': () => import('./_handlers/import-history-create.js'),
'kanban-columns-create': () => import('./_handlers/kanban-columns-create.js'),
'kanban-columns-update': () => import('./_handlers/kanban-columns-update.js'),
'kanban-columns-delete': () => import('./_handlers/kanban-columns-delete.js'),
'planning-items-create': () => import('./_handlers/planning-items-create.js'),
'planning-items-reorder': () => import('./_handlers/planning-items-reorder.js'),
'planning-comments-create': () => import('./_handlers/planning-comments-create.js'),
'planning-comments-delete': () => import('./_handlers/planning-comments-delete.js'),
'task-checklist-create': () => import('./_handlers/task-checklist-create.js'),
'task-checklist-update': () => import('./_handlers/task-checklist-update.js'),
'task-checklist-delete': () => import('./_handlers/task-checklist-delete.js'),
'task-comments-create': () => import('./_handlers/task-comments-create.js'),
'task-comments-delete': () => import('./_handlers/task-comments-delete.js'),
```

Round 2 (commit `2409c2a0`) adicionou:

```ts
'planning-items-update': () => import('./_handlers/planning-items-update.js'),
'kanban-columns-init': () => import('./_handlers/kanban-columns-init.js'),
```

`planning-items-create` foi extendido pra aceitar id (restore/undo flow)
e todos os campos editáveis (recurrence_*, media_urls, labels, etc).

### Follow-ups recomendados

- **team-tasks-recurrence** — handler dedicado pra criar/editar templates
  de recorrência (recurrence_type, recurrence_days, recurrence_time,
  recurrence_end_date, is_recurrence_template). Migrar
  `useTeamTasks.createTask/updateTask/duplicateTask` deixou esses campos
  silenciosamente droppados — funciona pra TaskDialog atual mas quebra
  quando UI de recorrência for adicionada.

- **team-tasks-mentions** — campo `mentions: string[]` da tabela
  team_tasks tbm está sendo droppado nas migrações acima. Verificar se
  algum cron/notification depende disso.

- **planning_items.created_by** — `planning-items-create.ts` força
  `created_by = user.id` no handler. Verificar se planning-items-update
  existe (não vi no manifest) e se há outras escritas em planning_items
  que ainda fazem supabase.from() direto. usePlanningItems tem outras
  mutations além de reorderItems.

- **library_ideas** — `CrossAppActions.tsx` fallback foi removido (tabela
  não existe no schema). Confirmar com Gabriel se a feature "Salvar ideia
  global sem cliente" é desejada — se sim, criar migration + handler. Por
  ora, UI mostra toast pedindo pra selecionar cliente.

- **import_history.user_id** — schema tem `DEFAULT auth.uid()`. Handler
  novo passa user.id explícito (mais seguro). Verificar nenhum INSERT
  legado depende do default.
