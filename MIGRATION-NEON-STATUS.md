# KAI 2.0 — Migração Neon Status

**Iniciada:** 2026-05-07
**Repo:** `gmadureiraa/kai-app` branch `combo-viral-integration`
**Local:** `code/kai-app-combo/`

## Por que migramos
KAI atual roda em Supabase gerenciado pelo Lovable. Gabriel não tem acesso à API/admin. Solução: fork limpo apontando pra **Neon Postgres + Neon Auth (Stack/Better Auth) + Vercel Functions + Vercel Blob**.

## Status

### ✅ Completo

#### Schema aplicado no Neon
- **88 tabelas** (todas)
- **291 RLS policies**
- **263 indexes**
- **47 triggers**
- **231 functions** (66 customizadas + 47 trigger fns + extension fns)
- **8 enums**: activity_type, content_type, knowledge_category, plan_type, share_permission, subscription_status, token_transaction_type, workspace_role
- **Extensions ativas**: pg_stat_statements, pgcrypto, plpgsql, uuid-ossp, vector
- **Extensions skipadas (Neon não suporta):** pg_cron → Vercel Cron · pg_net → Vercel Functions · supabase_vault → env vars

#### Refactor Realtime → Polling
- 6 subscriptions Supabase migradas pra TanStack Query polling
- `useTaskChecklist` (10s), `useTaskComments` (5s), `useTeamTasks` (15s), `useNotifications` (30s + diff), `usePlanningRealtime` (15s + invalidate), `usePlanningItems` (15s)
- 0 ocorrências de `supabase.channel` em src/
- Build passa

#### Setup base
- `.env` apontando pra Neon (DB + Auth + Data API)
- `vercel.json` com framework Vite + 6 cron jobs + functions config
- Libs instaladas: `@neondatabase/auth`, `@neondatabase/auth-ui`, `@vercel/blob`, `@neondatabase/serverless`, `@vercel/node`
- Helpers criados em `src/integrations/neon/` (auth-client, db-client compat)
- Helpers backend em `api/_lib/` (db, auth, cors, handler, llm)

### 🔄 Em curso (agentes paralelos)

#### Auth — Supabase Auth → Stack Auth
- 46 chamadas `supabase.auth.*` ainda em src/
- Agente instalou `@stackframe/react`

#### Storage — Supabase Storage → Vercel Blob
- 19 chamadas `supabase.storage` ainda em src/
- Agente trabalhando

#### Edge Functions — 92 Deno → Vercel Functions
- 84 invokes `supabase.functions.invoke` ainda em src/
- 6 functions já criadas em `api/`: extract-docx, extract-pdf, scrape-website, transcribe-images, _lib/
- Agente migrando top 25 mais usadas

### 🔜 Após agentes terminarem

1. **Build E2E** — `bun run build` precisa passar 100%
2. **Dev local** — `bun run dev` pra Gabriel testar tela de login
3. **Stack Auth project setup** — Gabriel precisa criar projeto no Neon Console (Auth tab) e preencher `VITE_STACK_PROJECT_ID` + `VITE_STACK_PUBLISHABLE_KEY` no `.env`
4. **Vercel Blob token** — `BLOB_READ_WRITE_TOKEN` (Gabriel cria no Vercel quando deployar)
5. **Cron jobs** — verificar paths pós-migração de edge functions
6. **Sunset Lovable** — só após paridade end-to-end testada

## Stack final

| Layer | Antes (Lovable) | Agora (Neon) |
|---|---|---|
| Database | Supabase Postgres | Neon Postgres |
| Auth | Supabase Auth | Neon Auth (Stack/Better Auth) |
| Data API | Supabase REST (PostgREST) | Neon Data API (PostgREST, requer JWT) |
| Storage | Supabase Storage | Vercel Blob |
| Edge Functions | Supabase Edge Deno (92) | Vercel Functions Node |
| Realtime | Supabase Realtime | TanStack polling (intervalos por caso) |
| Cron | pg_cron | Vercel Cron (vercel.json) |
| Secrets | supabase_vault | env vars Vercel |

## Endpoints Neon

- **Postgres:** `postgresql://neondb_owner:***@ep-sparkling-moon-acbufmuw-pooler.sa-east-1.aws.neon.tech/neondb`
- **Auth:** `https://ep-sparkling-moon-acbufmuw.neonauth.sa-east-1.aws.neon.tech/neondb/auth`
- **JWKS:** `https://ep-sparkling-moon-acbufmuw.neonauth.sa-east-1.aws.neon.tech/neondb/auth/.well-known/jwks.json`
- **Data API:** `https://ep-sparkling-moon-acbufmuw.apirest.sa-east-1.aws.neon.tech/neondb/rest/v1`

## Riscos abertos

| Risco | Mitigação |
|---|---|
| Stack Auth project não configurado → login quebra | Gabriel cria no Neon Console (10min) |
| Vercel Blob token não configurado → uploads falham | Gabriel cria no Vercel após deployar (5min) |
| 67 edge functions não-top-25 não migradas | Stub 501 + TODO; migrar sob demanda |
| pg_cron jobs antigos no Lovable continuam rodando | Confirmar que Lovable Supabase não está mais sendo usado pelo client antes de sunset |
| Functions custom com `LANGUAGE c` (114 puladas) | São pgvector built-ins; já vem com extension `vector` |
| RLS policies podem ter quirks de role (anon ↔ anonymous, service_role ↔ neon_superuser) | Aliases criados; testar em produção |

## Arquivos novos/modificados

```
.env                                              modificado (Neon URLs)
vercel.json                                       NOVO (cron + framework)
package.json                                      atualizado (libs Neon + Vercel)
MIGRATION-NEON-STATUS.md                          NOVO (este arquivo)

src/integrations/neon/auth-client.ts              NOVO
src/integrations/neon/db-client.ts                NOVO
src/hooks/useTaskChecklist.ts                     polling
src/hooks/useTaskComments.ts                      polling
src/hooks/useTeamTasks.ts                         polling
src/hooks/useNotifications.ts                     polling + diff
src/hooks/usePlanningRealtime.ts                  setInterval invalidate
src/hooks/usePlanningItems.ts                     refetchInterval

api/_lib/db.ts                                    NOVO (Neon pool)
api/_lib/auth.ts                                  NOVO (JWT verify)
api/_lib/cors.ts                                  NOVO
api/_lib/handler.ts                               NOVO
api/_lib/llm.ts                                   NOVO
api/extract-docx.ts                               NOVO
api/extract-pdf.ts                                NOVO
api/scrape-website.ts                             NOVO
api/transcribe-images.ts                          NOVO

(... mais arquivos sendo modificados pelos agentes em curso)
```
