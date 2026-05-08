# KAI 2.0 — Kaleidos AI Platform

Plataforma multi-tenant da Kaleidos pra criação de conteúdo, planejamento, métricas e automação social. Single-page app que roda em Vercel.

> **Live:** https://kai-2-topaz.vercel.app
> **Repo:** `gmadureiraa/kai-app`
> **Branch ativa desta migração:** `combo-viral-integration`

## Screenshots

> Placeholders abaixo — serão substituídos por blob URLs após o próximo deploy.

| Tela | Preview |
|---|---|
| Home dashboard (workspace) | _screenshot pendente_ |
| Viral Sequence (geração de carrossel) | _screenshot pendente_ |
| Viral Reels (engenharia reversa) | _screenshot pendente_ |
| Radar (alertas + briefs) | _screenshot pendente_ |
| Billing (planos + tokens) | _screenshot pendente_ |

---

## Stack

- **Frontend:** React 18 + Vite 5 + TypeScript + Tailwind CSS + Shadcn/ui
- **Database:** Neon Postgres (88 tabelas, 291 RLS policies, 47 triggers)
- **Auth:** Neon Auth (Better Auth) via `@neondatabase/auth` com `SupabaseAuthAdapter`
- **Data API:** Neon Data API (PostgREST). JWT do Neon Auth injetado em cada request.
- **Backend:** Vercel Functions (Node 20) — 1 catch-all router que carrega 97 handlers sob demanda
- **Storage:** Vercel Blob (buckets simulados como prefixos de path)
- **Realtime:** TanStack Query polling — não há WebSocket
- **Cron:** Vercel Cron (`vercel.json`)
- **LLMs:** Gemini 2.5 Flash/Pro (default), OpenAI, Anthropic, Grok (web search)
- **Package manager:** Bun

A migração de Supabase (Lovable) → Neon foi feita em 2026-05-07. Toda a história está em [`MIGRATION-NEON-STATUS.md`](./MIGRATION-NEON-STATUS.md).

---

## Quick start (local)

```bash
# 1. Clone + dependências
git clone git@github.com:gmadureiraa/kai-app.git
cd kai-app
bun install

# 2. Env vars (mínimo pra subir)
cp .env.example .env  # se não existir, ver SETUP.md
# preencher:
#   DATABASE_URL          (Neon connection string com pooler)
#   VITE_SUPABASE_URL     (Neon Data API URL)
#   VITE_NEON_AUTH_URL    (Neon Auth base URL)
#   VITE_NEON_JWKS_URL    (JWKS pra verificação de JWT no backend)
#   BLOB_READ_WRITE_TOKEN (Vercel Blob)
#   GEMINI_API_KEY ou GOOGLE_AI_STUDIO_API_KEY (LLM principal)

# 3. Dev server (front + API local via vercel dev)
bun run dev          # vite dev, só front
# OU
vercel dev           # front + Vercel Functions juntos (recomendado pra testar /api)
```

Detalhes completos em [`SETUP.md`](./SETUP.md).

---

## Comandos

| Comando | Faz |
|---|---|
| `bun run dev` | Vite dev server (apenas front, em localhost:5173) |
| `vercel dev` | Front + Vercel Functions locais (testa `/api/*`) |
| `bun run build` | Build de produção em `dist/` |
| `bun run build:dev` | Build com source maps + mode development |
| `bun run preview` | Servir o `dist/` local |
| `bun run lint` | ESLint em todo o repo |
| `bunx tsc --noEmit -p tsconfig.app.json` | Type-check sem emitir (CI) |
| `bunx playwright test` | Testes E2E (config em `playwright.config.ts`) |

---

## Estrutura

```
kai-app-combo/
├── api/                          # Vercel Functions
│   ├── router.ts                 # catch-all que despacha pra _handlers/<slug>
│   ├── handler-manifest.ts       # mapa { slug → import lazy do handler }
│   ├── _handlers/                # 97 handlers (1 arquivo por endpoint)
│   ├── _lib/                     # db, auth, cors, handler wrapper, llm, stub
│   └── blob/                     # 5 endpoints diretos pro Vercel Blob
├── migrations/                   # SQL aplicadas no Neon (numeradas)
│   ├── 0002_library_global.sql
│   ├── 0003_radar_full.sql
│   └── 0004_seed_rss_sources.sql
├── src/
│   ├── App.tsx                   # rotas + providers + ErrorBoundary
│   ├── main.tsx
│   ├── pages/                    # 9 páginas top-level (Login, Kai, etc.)
│   ├── components/               # ~25 áreas (kai, planning, posts, viral, ...)
│   ├── hooks/                    # ~80 hooks (data + UI state)
│   ├── lib/                      # apiInvoke, validation, exports, utils
│   ├── integrations/
│   │   ├── neon-auth/            # Neon Auth client (SupabaseAuthAdapter)
│   │   ├── supabase/             # client.ts → aponta pra Neon Data API + JWT
│   │   ├── storage/blob-client   # wrapper Vercel Blob com API tipo Supabase
│   │   └── neon/                 # legacy compat shim
│   ├── contexts/                 # WorkspaceContext, GlobalKAIContext
│   └── types/
├── docs/                         # docs antigas (referência)
├── public/                       # assets estáticos
├── supabase/                     # legacy edge functions (referência apenas)
├── vercel.json                   # framework + crons + rewrites + headers
├── package.json
└── tsconfig*.json
```

---

## Production

| Item | Valor |
|---|---|
| **URL** | https://kai-2-topaz.vercel.app |
| **Vercel Project** | `kai-2` (team `gfmadureiraa-3391s-projects`) |
| **Framework** | Vite (autodetect) |
| **Build cmd** | `bun run build` |
| **Output dir** | `dist` |
| **Deploy** | `vercel deploy --prod` ou push em `main` (branch `combo-viral-integration` ainda não está em prod) |
| **DB** | Neon project com endpoint `ep-sparkling-moon-acbufmuw` (sa-east-1) |

Cron jobs ativos (Hobby plan permite só 2 daily):

| Path | Schedule UTC | O que faz |
|---|---|---|
| `/api/cron-generate-daily-brief` | `0 8 * * *` (08:00 UTC) | Agrega 24h de news/IG/TikTok por client + brief Gemini |
| `/api/telegram-daily-report` | `0 9 * * *` (09:00 UTC) | Daily report no Telegram |

Schedules adicionais (Pro plan) listados em [`RADAR-CRON-DONE.md`](./RADAR-CRON-DONE.md).

---

## Próximos passos

- [ ] Cron `cron-scrape-news` rodando manualmente — automatizar quando upgrade Pro
- [ ] Ativar OAuth real (LinkedIn + Twitter + Late) preenchendo env vars — ver [`STUBS-MIGRATED-FINAL.md`](./STUBS-MIGRATED-FINAL.md)
- [ ] Sunset do Lovable Supabase — só após paridade end-to-end testada
- [ ] Regenerar `src/integrations/supabase/types.ts` a partir do Neon (atualmente é o gerado pelo Lovable; tabelas novas dos 0003/0004 estão acessadas via `(supabase as any).from(...)`)
- [ ] Code splitting agressivo — bundle atual tem chunk de ~4MB

---

## Documentação

| Doc | Pra quê |
|---|---|
| [`README.md`](./README.md) | Você está aqui |
| [`SETUP.md`](./SETUP.md) | Setup do zero pra dev novo (10–20 min) |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Diagrama + fluxos (auth, data, functions, storage, realtime, cron) |
| [`ENV-VARS.md`](./ENV-VARS.md) | Tabela completa de todas as env vars (server + client) |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md) | Convenções, como adicionar handler/page, como contribuir |
| [`MIGRATION-NEON-STATUS.md`](./MIGRATION-NEON-STATUS.md) | History da migração Supabase → Neon (alto-nível) |
| [`MIGRATION-EDGE-FUNCTIONS.md`](./MIGRATION-EDGE-FUNCTIONS.md) | Detalhe da migração das 92 Edge Functions Deno → Vercel Node |
| [`STUBS-MIGRATED.md`](./STUBS-MIGRATED.md) → [`...-FINAL.md`](./STUBS-MIGRATED-FINAL.md) | Trilha de stubs implementados nas levas (1→5+final) |
| [`KAI-CHAT-MIGRATED.md`](./KAI-CHAT-MIGRATED.md) | Migração específica do `kai-simple-chat` (2335 LOC + 13 tools) |
| [`RADAR-CRON-DONE.md`](./RADAR-CRON-DONE.md) | Cron próprio do Radar Viral dentro do KAI |
| [`RADAR-SEED-DONE.md`](./RADAR-SEED-DONE.md) | Seed de fontes RSS + admin UI + `CRON_SECRET` |
| [`VIRAL-PORTED.md`](./VIRAL-PORTED.md) | Integração dos 3 apps virais (Sequência, Reels, Radar) |
| [`WORKSPACE-FLOW.md`](./WORKSPACE-FLOW.md) | UI de workspace (settings, members, invites) |
| [`AUDIT-CLIENT.md`](./AUDIT-CLIENT.md) | Auditoria final do `src/` pós-migração |
| [`FRONTEND-POLISH.md`](./FRONTEND-POLISH.md) | ErrorBoundary global + empty states + toasts |
| [`AUTOMATIONS.md`](./AUTOMATIONS.md) | Sistema de automações de planejamento |
| [`GUIA-ORGANIZACAO-CLIENTES.md`](./GUIA-ORGANIZACAO-CLIENTES.md) | Guia editorial de organização dos clientes |
