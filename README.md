# KAI 2.0 — Kaleidos AI Platform

Plataforma multi-tenant da Kaleidos pra criação de conteúdo, planejamento, métricas, performance e automação social — incluindo 3 apps virais integrados (Sequência Viral, Radar Viral, Reels Viral). Single-page React app que roda em Vercel.

> **Live:** https://kai.kaleidos.com.br
> **Repo:** `gmadureiraa/kai-app`
> **Branch ativa desta migração:** `combo-viral-integration`

## Features principais

- **KAI Chat** — assistente IA com 23 tools tool-calling (criação de conteúdo, scheduling, planning, métricas, OAuth, billing). Streaming SSE, persistência de histórico, exports MD/PDF.
- **Planejamento** — kanban editorial multi-cliente com drag-and-drop, mentions (`@cliente`), filtros avançados, view list/calendar/board.
- **Tarefas do time** — board interno com prioridade, atribuição, calendário; separado do conteúdo.
- **Library** — bancos de conteúdo, refs visuais, case studies, relatórios e visuais (5 tabs).
- **Performance** — dashboards Instagram, Twitter, LinkedIn, YouTube, Newsletter e Meta Ads. CSV upload, sync automático, métricas, learnings via Gemini.
- **Automations** — RSS → IA → Publicação. Workflows com triggers de schedule/RSS/webhook + AI Agents.
- **Viral apps** — 3 apps full integrados:
  - **Sequência Viral** — gera carrossel completo (texto + imagem + voz) single-shot via Gemini 2.5 Pro/Flash + Imagen 4.
  - **Radar Viral** — alerta de conteúdo viral (IG, YouTube, News, Newsletters) + briefs de remix.
  - **Reels Viral** — engenharia reversa de reels: análise multimodal (Gemini Flash) + script + storyboard cena por cena.
- **Late/Zernio** — agendamento e publicação social (Instagram, Twitter, LinkedIn, YouTube, TikTok, Threads, Facebook, Meta Ads). Publisher único do KAI desde a migração Metricool→Postiz→Late (2026-05-17).
- **Late Inbox** — comentários e DMs centralizados de todas as redes conectadas.
- **Performance multi-plataforma** — dashboards por cliente com snapshots diários populados via webhooks Late/Zernio.

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

- **Frontend:** React 18 + Vite 5 + TypeScript + Tailwind CSS + Shadcn/ui (Radix UI primitives)
- **Database:** Neon Postgres (88 tabelas, 291 RLS policies, 263 indexes, 47 triggers)
- **Auth:** Neon Auth (Better Auth) via `@neondatabase/auth` com `SupabaseAuthAdapter` pra retro-compat
- **Data API:** Neon Data API (PostgREST-compatible). JWT do Neon Auth injetado em cada request.
- **Backend:** Vercel Functions (Node 20) — 1 catch-all router que carrega 184 handlers sob demanda
- **Storage:** Vercel Blob (buckets simulados como prefixos de path)
- **Realtime:** TanStack Query polling — não há WebSocket
- **Cron:** Vercel Cron (`vercel.json`)
- **Social:** Late/Zernio (agendamento, publicação, inbox) — bearer token único por workspace (`LATE_API_KEY`)
- **LLMs:** Gemini 2.5 Flash/Pro (default), OpenAI, Anthropic, Grok (web search)
- **Forms/State:** React Hook Form + Zod, Zustand (state global), TanStack Query
- **Charts:** Recharts (lazy)
- **Drag-and-drop:** dnd-kit (Kanban + Tasks board)
- **Package manager:** Bun

A migração de Supabase (Lovable) → Neon foi feita em 2026-05-07. Toda a história está em [`MIGRATION-NEON-STATUS.md`](./MIGRATION-NEON-STATUS.md).

---

## Quick start (local)

```bash
# 1. Clone + dependências
git clone git@github.com:gmadureiraa/kai-app.git
cd kai-app
git checkout combo-viral-integration  # branch ativa
bun install

# 2. Env vars (puxar tudo da Vercel)
vercel link            # uma vez por máquina, escolhe o projeto kai-2
vercel env pull .env.local --environment=development

# 3. Dev server
bun run dev            # Vite só (localhost:5173) — usa /api da prod via rewrite
# OU pra testar /api local:
vercel dev             # Front + Vercel Functions juntos
```

### Env vars obrigatórias

| Var | Pra quê |
|---|---|
| `DATABASE_URL` | Neon connection string com pooler |
| `VITE_SUPABASE_URL` | Neon Data API URL (PostgREST) |
| `VITE_SUPABASE_ANON_KEY` | Token público pra Data API |
| `VITE_NEON_AUTH_URL` | Neon Auth base URL |
| `VITE_NEON_JWKS_URL` | JWKS pra verificação de JWT no backend |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token |
| `GEMINI_API_KEY` | LLM principal (Gemini 2.5 Flash/Pro) |
| `CRON_SECRET` | Token Bearer pros Vercel Crons |

### Env vars opcionais (features específicas)

| Var | Feature |
|---|---|
| `OPENAI_API_KEY` | Provider alternativo no chat |
| `ANTHROPIC_API_KEY` | Provider alternativo no chat |
| `XAI_API_KEY` | Grok (web search) |
| `APIFY_API_KEY` + `APIFY_API_KEY_FALLBACK` | Scraping IG/Twitter (Sequência + Reels + Radar) |
| `SUPADATA_API_KEY` | Transcrição de áudio (reels) |
| `SERPER_API_KEY` | Search agent (newsletters / temas) |
| `RESEND_API_KEY` | Envio de email transacional |
| `STRIPE_SECRET_KEY` | Billing (signature `STRIPE_WEBHOOK_SECRET`) |
| `LATE_API_KEY` + `LATE_WEBHOOK_SECRET` | Publisher único (Late.so/Zernio) — agendamento, publicação, inbox, métricas |
| `META_ACCESS_TOKEN` + `META_AD_ACCOUNT_ID` + `META_PAGE_ID` | Meta Ads single-tenant (sem App Review) |
| `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` | Daily report |

Detalhes completos em [`ENV-VARS.md`](./ENV-VARS.md) e setup do zero em [`SETUP.md`](./SETUP.md).

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
| `bun run test:e2e:prod` | E2E contra a URL de produção |
| `vercel deploy` | Deploy preview no Vercel |
| `vercel deploy --prod --yes` | Deploy de produção |
| `vercel env pull .env.local` | Sincronizar vars locais com a Vercel |
| `bunx tsx scripts/<script>.ts` | Rodar scripts TS soltos (seed, migration tooling, etc.) |

---

## Estrutura

```
kai-app-combo/
├── api/                          # Vercel Functions
│   ├── router.ts                 # catch-all /api/* — despacha pra _handlers/<slug>
│   ├── handler-manifest.ts       # mapa { slug → import lazy do handler }
│   ├── _handlers/                # 184 handlers (1 arquivo por endpoint)
│   ├── _lib/                     # db, auth, cors, handler wrapper, llm, stub
│   └── blob/                     # 5 endpoints diretos pro Vercel Blob
├── migrations/                   # SQL aplicadas no Neon (numeradas, ordem cresc.)
│   ├── 0002_library_global.sql
│   ├── 0003_radar_full.sql
│   └── 0004_seed_rss_sources.sql
├── scripts/                      # scripts TS rodáveis com `bunx tsx <script>`
├── src/
│   ├── App.tsx                   # rotas + providers + ErrorBoundary
│   ├── main.tsx
│   ├── pages/                    # 9 páginas top-level (Login, Kai, etc.)
│   ├── components/               # áreas:
│   │   ├── admin/                # painel admin (workspace, billing global)
│   │   ├── automations/          # AutomationsTab, AutomationDialog
│   │   ├── billing/              # BillingTab, planos, tokens
│   │   ├── chat/                 # FloatingInput, EnhancedMessageBubble, KaiToolsTray
│   │   ├── clients/              # CRUD cliente, brand assets, refs
│   │   ├── content/              # geração de conteúdo single-shot
│   │   ├── kai/                  # Kai shell + tabs + viral-* (3 apps virais)
│   │   ├── library/              # bancos de conteúdo / refs / case studies
│   │   ├── notifications/
│   │   ├── onboarding/
│   │   ├── performance/          # dashboards Instagram / Twitter / LI / YT / Newsletter / Meta
│   │   ├── planning/             # PlanningBoard + KanbanView + dialogs
│   │   ├── posts/                # PostPreviewCard, CarouselEditor
│   │   ├── settings/             # workspace settings + members
│   │   ├── tasks/                # TeamTasksBoard
│   │   ├── ui/                   # shadcn primitives
│   │   └── workspace/            # WorkspaceGuard, WorkspaceRouter
│   ├── hooks/                    # ~80 hooks (data + UI state)
│   ├── lib/                      # apiInvoke, validation, exports, utils
│   ├── integrations/
│   │   ├── neon-auth/            # Neon Auth client (SupabaseAuthAdapter)
│   │   ├── supabase/             # client.ts → aponta pra Neon Data API + JWT
│   │   ├── storage/blob-client   # wrapper Vercel Blob com API tipo Supabase
│   │   └── neon/                 # legacy compat shim
│   ├── contexts/                 # WorkspaceContext, GlobalKAIContext
│   ├── store/                    # Zustand stores
│   └── types/
├── public/                       # assets estáticos
├── docs/                         # docs antigas (referência)
├── supabase/                     # legacy edge functions (referência apenas)
├── _legacy/                      # cópias arquivadas pré-migração viral
├── vite.config.ts                # bundling + manualChunks (split de export-vendor)
├── vercel.json                   # framework + crons + rewrites + headers
├── package.json
└── tsconfig*.json
```

---

## Production

| Item | Valor |
|---|---|
| **URL** | https://kai.kaleidos.com.br |
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

## Bundle / Performance

Pós Audit B (2026-05-08), o `export-vendor` consolidado (~960kB raw / 314kB gzip) foi quebrado em chunks por feature pra reduzir o initial download:

| Chunk | Raw | Gzip | Carrega quando |
|---|---|---|---|
| `export-html-vendor` (html-to-image) | 13kB | 5kB | Export PNG |
| `html2canvas.esm` (sub-dep) | 201kB | 48kB | Export PNG |
| `export-zip-vendor` (jszip) | 97kB | 30kB | Export ZIP |
| `export-pdf-vendor` (jspdf) | 415kB | 136kB | Export PDF |
| `export-xlsx-vendor` (xlsx) | 429kB | 143kB | CSV/XLSX upload |

Outros chunks pesados — `chart-vendor` (recharts, 433kB / 114kB gzip), `auth-vendor` (323kB / 84kB gzip) — só carregam dentro das tabs lazy-loaded.

Todo call-site de export usa `await import(...)` dentro do handler. As tabs principais (`Kai`, `KaiAssistantTab`, `PlanningBoard`, viral apps) são `lazy()` no router.

## Próximos passos

- [ ] Cron `cron-scrape-news` rodando manualmente — automatizar quando upgrade Pro
- [ ] Validar OAuth real de todas as redes via Late/Zernio (LinkedIn + Twitter + IG + TikTok + YouTube + Threads) — ver [`STUBS-MIGRATED-FINAL.md`](./STUBS-MIGRATED-FINAL.md)
- [ ] Sunset do Lovable Supabase — só após paridade end-to-end testada
- [ ] Regenerar `src/integrations/supabase/types.ts` a partir do Neon (atualmente é o gerado pelo Lovable; tabelas novas dos 0003/0004 estão acessadas via `(supabase as any).from(...)`)
- [ ] Code splitting de pages do app standalone (viral-sv-original/pages-app/onboarding.tsx tem 2700+ linhas)

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
