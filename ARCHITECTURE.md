# ARCHITECTURE.md — KAI 2.0

Documento técnico do app pós-migração Supabase (Lovable) → Neon (2026-05-07).

> Ver também: [`README.md`](./README.md) (overview) · [`SETUP.md`](./SETUP.md) (setup) · [`ENV-VARS.md`](./ENV-VARS.md) (env) · [`MIGRATION-NEON-STATUS.md`](./MIGRATION-NEON-STATUS.md) (history)

---

## 1. Diagrama geral

```
                                  Browser (React 18 / Vite)
              ┌──────────────────────────────────────────────────────────┐
              │  src/App.tsx                                             │
              │  ├── ThemeProvider (dark)                                │
              │  ├── QueryClientProvider (TanStack Query)                │
              │  ├── BrowserRouter                                       │
              │  └── WorkspaceProvider → GlobalKAIProvider               │
              │       └── Routes (Login, Kai, NoWorkspace, ...)          │
              │                                                          │
              │  src/integrations/                                       │
              │  ├── neon-auth/client.ts ──────────► Neon Auth (login)   │
              │  ├── supabase/client.ts ───────────► Neon Data API       │
              │  │     (PostgREST + JWT injection)                       │
              │  ├── storage/blob-client.ts ───────► /api/blob/*         │
              │  └── lib/apiInvoke.ts ─────────────► /api/<handler>      │
              └─────────────────────────┬────────────────────────────────┘
                                        │ HTTPS
                                        │
       ┌────────────────────────────────┼────────────────────────────────┐
       │                                │                                │
       ▼                                ▼                                ▼
┌────────────┐              ┌──────────────────────┐         ┌──────────────────┐
│  Neon Auth │              │  Neon Data API       │         │  Vercel          │
│  (Better   │              │  (PostgREST)         │         │  Functions       │
│   Auth)    │              │  Authorization:      │         │  + Vercel Blob   │
│            │              │   Bearer <jwt>       │         │  + Vercel Cron   │
│  /signup   │              │  ↓                   │         │                  │
│  /login    │              │  ┌─────────────────┐ │         │  /api/router ──┐ │
│  /session  │              │  │ Neon Postgres   │ │         │  /api/blob/* ─┐│ │
│  /reset    │              │  │ 88 tabelas      │◄┼─────────┤              ││ │
│            │              │  │ 291 RLS pols    │ │  pg     │  /api/<slug> ─┘│ │
│  emite JWT │──── JWT ────►│  │ pgvector        │ │ Pool    │   ▼            │ │
│  + JWKS    │              │  └─────────────────┘ │  via    │  loads:        │ │
│            │              │                      │ Database │  _handlers/    │ │
│            │              │  RLS lê auth.uid()   │  _URL    │  <slug>.ts     │ │
│            │              │  do JWT             │         │                  │ │
└────────────┘              └──────────────────────┘         └────────────────┘ │
                                                                                │
                                  ┌─────────────────────────────────────────────┘
                                  │ External APIs invoked from handlers:
                                  ├── Gemini, OpenAI, Anthropic, Grok (LLMs)
                                  ├── Apify (IG/TikTok/YouTube/Twitter scrapers)
                                  ├── Late/Zernio API (publishing + inbox + metrics)
                                  ├── LinkedIn, Twitter (OAuth via Late/Zernio)
                                  ├── Resend (email)
                                  ├── Telegram Bot API
                                  ├── ClickUp API
                                  ├── Firecrawl, Pexels (images)
                                  ├── YouTube Data API + Supadata
                                  └── Beehiiv (newsletter metrics)
```

---

## 2. Fluxo de Auth

**Lib client:** `@neondatabase/auth` + `SupabaseAuthAdapter` (mantém API surface 100% compatível com `supabase.auth.*` legado).

```
[Browser]                        [Neon Auth]                      [Neon Data API]
   │                                  │                                  │
   │ neonAuth.signInWithPassword({…}) │                                  │
   │─────────────────────────────────►│                                  │
   │                                  │ valida creds                     │
   │                            ◄─────│ retorna { session: { token } }   │
   │                                  │                                  │
   │ supabase.from('clients').select()│                                  │
   │      (fetchWithNeonAuth injeta:  │                                  │
   │       Authorization: Bearer JWT) │                                  │
   │─────────────────────────────────────────────────────────────────────►
   │                                                                     │
   │                                            verifica JWT vs JWKS     │
   │                                            extrai sub (= user.id)   │
   │                                            aplica RLS auth.uid()    │
   │                                                                     │
   │ ◄───────────────────────────────────────────────────────────────────│
   │   rows filtradas por RLS                                            │
```

Pontos-chave:

- O JWT do Neon Auth é o **único token** usado em todas as chamadas.
- `src/integrations/supabase/client.ts` injeta o JWT em **todo** request via `fetchWithNeonAuth`.
- RLS policies do Neon leem `auth.uid()` exatamente como faziam no Supabase.
- Backend (Vercel Functions) verifica o mesmo JWT via JWKS (`api/_lib/auth.ts` → `jose.jwtVerify`).
- A migração foi shim-based: 45 chamadas `supabase.auth.*` legadas continuam funcionando sem refactor.

OAuth providers (Google, GitHub etc.) passam pelo Neon Auth — `neonAuth.signInWithOAuth(provider)`.

---

## 3. Fluxo de Data (browser → DB)

```
src/integrations/supabase/client.ts
  └── createClient(VITE_SUPABASE_URL, "", { global: { fetch: fetchWithNeonAuth }})
       ├── auth = neonAuth (SupabaseAuthAdapter)  ← override do auth namespace
       └── PostgREST queries vão pra:
           https://ep-…-apirest.sa-east-1.aws.neon.tech/neondb/rest/v1/<table>

fetchWithNeonAuth(req):
  1. headers["Authorization"] = "Bearer " + getNeonAuthJWT()
  2. headers["apikey"] = JWT (PostgREST exige header existir)
  3. fetch(req)
```

- Mesma API do `@supabase/supabase-js` (`from('x').select()`, `.insert()`, `.update()`, etc.) — zero refactor de call sites.
- RPCs custom (ex: `accept_pending_invite`, `add_workspace_member_or_invite`) chamadas via `supabase.rpc('name', args)` — precisam existir no Neon.
- Tipos vêm de `src/integrations/supabase/types.ts` (gerados originalmente do Lovable; **TODO:** regenerar a partir do Neon).
- Tabelas adicionadas pós-migração (0003+) acessadas via `(supabase as any).from('viral_tracked_sources')` até codegen rodar.

---

## 4. Fluxo de Edge Functions (browser → API)

Pattern adotado: **catch-all router** carrega 184 handlers sob demanda. Razão: Hobby plan da Vercel limita 12 functions; este pattern usa só 2 (router + blob).

```
src/lib/apiInvoke.ts
  apiInvoke('extract-pdf', { body: {...} })
  └─► fetch('/api/extract-pdf', { method: POST, headers: { Authorization: Bearer <JWT> }, body })

vercel.json rewrites:
  /api/blob/:path*  → /api/blob/:path*           (passa direto pros 5 endpoints blob)
  /api/router       → /api/router
  /api/:slug*       → /api/router?slug=:slug*    (catch-all)

api/router.ts (entrypoint):
  1. handlePreflight (CORS)
  2. extrai slug do query param `slug` ou path
  3. handler-manifest.ts → handlerLoaders[slug] (lazy import)
  4. cache em memory entre invocações warm
  5. delega: handler(req, res)

api/_handlers/<slug>.ts:
  - export default authedPost(async ({ user, body }) => { … })
  - usa _lib/db.ts (query/queryOne/insertRow) pra Neon
  - usa _lib/auth.ts (verifyAuth/tryAuth) pra JWT
  - usa _lib/llm.ts pra Gemini/OpenAI
  - usa _lib/cors.ts (applyCors, jsonError)
  - usa _lib/handler.ts (authedPost, anonPost wrappers)
```

- 184 handlers em `api/_handlers/` (1 arquivo por endpoint).
- `_lib/handler.ts` provê `authedPost` (auth obrigatória) e `anonPost` (auth opcional). Ambos cuidam de CORS + JSON parsing + erro padronizado.
- SSE streams (`kai-content-agent`, `kai-simple-chat`, `kai-metrics-agent`) usam `res.write(...)` com `Content-Type: text/event-stream`. `apiInvokeStream(name)` no client devolve a `Response` raw pra leitura via `EventSource`/`getReader`.
- Chamadas internas entre handlers usam `fetch('${INTERNAL_API_BASE_URL}/api/<other>')` propagando o `Authorization` header. `INTERNAL_API_BASE_URL` resolvido via env → `req.headers.host` → fallback `https://kai-2-topaz.vercel.app`.

Para adicionar um handler novo, ver [`CONTRIBUTING.md`](./CONTRIBUTING.md).

---

## 5. Fluxo de Storage

Vercel Blob substituiu Supabase Storage. Buckets simulados como prefixos de path: `<bucket>/<rest-of-path>`.

```
src/integrations/storage/blob-client.ts
  blobStorage.from('client-files').upload(path, file)
  │
  └─► @vercel/blob/client `upload()` (browser-safe)
        ├── 1) POST /api/blob/upload-token { handleUpload payload }
        │        └── server gera token client de upload (consome JWT do user)
        ├── 2) browser PUT direto pro Vercel Blob (com token)
        └── 3) callback opcional onUploadCompleted

  blobStorage.from('x').download(path)        → GET /api/blob/download?path=…
  blobStorage.from('x').remove([paths])       → POST /api/blob/delete
  blobStorage.from('x').list(prefix)          → POST /api/blob/list
  blobStorage.from('x').createSignedUrl(p, e) → POST /api/blob/signed-url
  blobStorage.from('x').getPublicUrl(p)       → constrói URL ${VITE_BLOB_PUBLIC_HOST}/<bucket>/<path>
```

Endpoints diretos em `api/blob/`:

| Endpoint | Descrição |
|---|---|
| `api/blob/upload-token.ts` | `handleUpload` do `@vercel/blob/client` (browser → Blob direto) |
| `api/blob/download.ts` | Stream do byte content via proxy (esconde token) |
| `api/blob/delete.ts` | `del([paths])` |
| `api/blob/list.ts` | `list({ prefix })` |
| `api/blob/signed-url.ts` | URL temporária assinada (fallback proxy) |

> Vercel Blob com `access: 'public'` retorna URL permanente. Preferir armazenar a URL completa no DB ao invés do path quando possível.

Env vars: `BLOB_READ_WRITE_TOKEN` (server) + `VITE_BLOB_PUBLIC_HOST` (client, opcional).

---

## 6. Fluxo de Realtime (não tem)

A migração removeu Supabase Realtime (WebSocket). Tudo virou polling com TanStack Query.

| Hook | Intervalo | Estratégia |
|---|---|---|
| `useTaskChecklist` | 10s | `refetchInterval` |
| `useTaskComments` | 5s | `refetchInterval` |
| `useTeamTasks` | 15s | `refetchInterval` |
| `useNotifications` | 30s | `refetchInterval` + diff (toast novo) |
| `usePlanningRealtime` | 15s | `setInterval` → `queryClient.invalidateQueries` |
| `usePlanningItems` | 15s | `refetchInterval` |

Não há `supabase.channel(...)` no codebase — `grep -r 'supabase.channel' src/` retorna 0.

Trade-off: latência subjetiva (até intervalo) em troca de zero infra de WS. Aceitável pra usecases atuais (planning, notifications, tasks).

---

## 7. Fluxo de Cron

```
vercel.json:
  "crons": [
    { "path": "/api/cron-generate-daily-brief", "schedule": "0 8 * * *" },
    { "path": "/api/telegram-daily-report",     "schedule": "0 9 * * *" }
  ]

Trigger Vercel:
  GET https://kai-2-topaz.vercel.app/api/cron-generate-daily-brief
    Headers: x-vercel-cron: 1

Handler (api/_handlers/cron-*.ts):
  if (req.headers['x-vercel-cron'] !== '1' &&
      req.headers.authorization !== `Bearer ${CRON_SECRET}`) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  // ... lógica
```

- Hobby plan da Vercel permite só 2 daily crons. Os outros (`cron-scrape-news`, `cron-scrape-tiktok`, `cron-scrape-instagram`, `sync-all-metrics`) ficam disponíveis em `/api/<slug>` mas só rodam manualmente via curl com `Bearer $CRON_SECRET`.
- Pro plan: ver [`RADAR-CRON-DONE.md`](./RADAR-CRON-DONE.md) seção "Para Pro plan".
- Idempotência: `cron-generate-daily-brief` insere 1 brief por client por dia (UNIQUE constraint).
- Feature flags: `RADAR_IG_CRON_ENABLED=1` e `RADAR_TIKTOK_CRON_ENABLED=1` controlam custos Apify.

---

## 8. Estrutura de diretórios

### `api/` — Vercel Functions

```
api/
├── router.ts                    # entrypoint catch-all
├── handler-manifest.ts          # mapa { slug → loader lazy }
├── _lib/                        # shared utilities (server)
│   ├── db.ts                    # Pool Neon + query/queryOne/insertRow
│   ├── auth.ts                  # verifyAuth / tryAuth via JWKS (jose)
│   ├── cors.ts                  # corsHeaders, applyCors, handlePreflight, jsonError
│   ├── handler.ts               # authedPost / anonPost wrappers
│   ├── llm.ts                   # callLLM (Gemini + OpenAI + retry/fallback + log)
│   ├── stub.ts                  # notImplemented(name) helper
│   ├── shared/                  # ports de _shared/* legacy (formato/qualidade)
│   └── kai-chat-tools/          # 13 tools do kai-simple-chat
├── _handlers/                   # 184 handlers (1 arquivo cada)
│   ├── extract-pdf.ts           # autenticado, Gemini Vision
│   ├── kai-simple-chat.ts       # SSE, function-calling, 43 tools
│   ├── cron-*.ts                # crons (news, ig, tiktok, daily-brief, radar, ...)
│   ├── linkedin-*.ts            # OAuth + post (auth via Late/Zernio)
│   ├── twitter-*.ts             # OAuth + post (auth via Late/Zernio)
│   ├── late-*.ts                # Late/Zernio publishing + inbox + metrics (11 handlers)
│   ├── publish-viral-carousel.ts # Pipeline carrossel viral → Late.post
│   ├── telegram-*.ts            # bot poll + notify + daily report
│   └── ... (resto)
└── blob/                        # 5 endpoints diretos pro Vercel Blob
    ├── upload-token.ts
    ├── download.ts
    ├── delete.ts
    ├── list.ts
    └── signed-url.ts
```

### `src/` — React frontend

```
src/
├── App.tsx                      # rotas + providers + ErrorBoundary global
├── main.tsx                     # React root
├── index.css / App.css
├── pages/                       # 9 top-level routes
│   ├── Login.tsx · SimpleSignup.tsx · WorkspaceLogin.tsx · NoWorkspacePage.tsx
│   ├── Kai.tsx                  # main app (dezenas de tabs lazy)
│   ├── ExportMadureira.tsx      # rota temp pra export
│   ├── Documentation.tsx · JoinWorkspace.tsx · NotFound.tsx
├── components/
│   ├── kai/                     # main shell (Sidebar, Library, Performance, Analytics, Settings, viral-*)
│   ├── kai-global/              # Global kAI Assistant (FAB que aparece em qualquer página)
│   ├── workspace/               # Settings, Members, PendingInvitesAlert
│   ├── clients/                 # ClientList, ClientsListPage, ClientDocumentsManager, ...
│   ├── planning/                # Kanban, Cards, Automations, Comments, Realtime
│   ├── posts/                   # ImageGallery, PostPreviewCard, ...
│   ├── content/ · library/ · references/ · automations/
│   ├── performance/             # PerformanceContext + report
│   ├── engagement/              # OpportunityFeed
│   ├── notifications/ · onboarding/ · settings/ · tasks/
│   ├── images/ · chat/
│   ├── admin/                   # RadarSourcesManager (super_admin only)
│   ├── ui/                      # Shadcn primitives
│   ├── ErrorBoundary.tsx        # global error boundary
│   ├── WorkspaceGuard.tsx · WorkspaceRouter.tsx · PendingAccessOverlay.tsx
│   ├── Header.tsx · SecondaryLayout.tsx · MessageActions.tsx
├── hooks/                       # ~80 hooks (data + UI state)
│   ├── useAuth.ts               # supabase.auth = neonAuth
│   ├── useClients.ts · useClientContext.ts · useClientDocuments.ts ...
│   ├── usePlanningItems.ts · usePlanningRealtime.ts (polling)
│   ├── useTaskChecklist.ts · useTaskComments.ts · useTeamTasks.ts (polling)
│   ├── useKAISimpleChat.ts · useKAIConversations.ts · useKAIActions.ts
│   ├── useSuperAdmin.ts (gate de admin global)
│   └── ... (mais ~70)
├── lib/
│   ├── apiInvoke.ts             # POST /api/<name> com JWT
│   ├── contentGeneration.ts · exportConversation.ts · exportReport.ts
│   ├── formatDetection.ts · formatRulesData.ts
│   ├── imageUtils.ts · mentionParser.ts · parseOpenAIStream.ts
│   ├── postDetection.ts · storage.ts · text-utils.ts
│   ├── transcribeImages.ts · validation.ts · utils.ts
├── integrations/
│   ├── neon-auth/
│   │   ├── client.ts            # neonAuth (SupabaseAuthAdapter) + getNeonAuthJWT
│   │   └── auth-shim.ts
│   ├── supabase/
│   │   ├── client.ts            # PostgREST → Neon Data API + JWT injection
│   │   └── types.ts             # Database types (gerados, big file)
│   ├── storage/
│   │   └── blob-client.ts       # API tipo Supabase, fala com /api/blob/*
│   ├── neon/
│   │   ├── auth-client.ts
│   │   └── db-client.ts         # DEPRECATED, re-export de supabase/client
│   └── lovable/                 # shim pra @lovable.dev/cloud-auth-js (delega pro Neon Auth)
├── contexts/                    # WorkspaceContext, GlobalKAIContext
├── config/ · types/ · utils/
└── assets/
```

### `migrations/` — SQL aplicado no Neon

```
migrations/
├── 0002_library_global.sql      # library_ideas + library_reels
├── 0003_radar_full.sql          # viral_tracked_sources + viral_news_articles + viral_tiktok_posts
└── 0004_seed_rss_sources.sql    # seed 15 fontes RSS + admin policy
```

> Aplicação manual: `psql "$DATABASE_URL" -f migrations/<arquivo>.sql`. Não há tooling de migração estruturada (TODO: drizzle/atlas/etc.).

### Arquivos de config

| Arquivo | Função |
|---|---|
| `vercel.json` | framework Vite + 4 rewrites + 2 crons + functions config (maxDuration 60s + memory 1024 + includeFiles) + headers de segurança |
| `vite.config.ts` | aliases (`@/`), SWC plugin react, lovable-tagger só em dev |
| `tsconfig.json` / `tsconfig.app.json` / `tsconfig.node.json` | config TS por target |
| `tailwind.config.ts` + `postcss.config.js` | Tailwind v3 + tipografia plugin |
| `eslint.config.js` | flat config, react-hooks + react-refresh |
| `playwright.config.ts` | E2E |
| `components.json` | Shadcn config |

---

## 9. Decisões importantes

| Decisão | Justificativa |
|---|---|
| **Catch-all router 1 function** | Hobby plan limita 12 functions; consolidação reduz pra 2 (router + blob). Trade-off: cold start único compartilhado entre 184 endpoints. |
| **Late/Zernio como publisher único** | Migração Metricool → Postiz → Late/Zernio fechada em 2026-05-17. Late cobre 14 redes (IG, TikTok, X, LinkedIn, YouTube, Threads, Facebook, ...) + inbox + métricas via webhooks. Tabelas legacy (`metricool_posts`, `metricool_daily_snapshots`, `metricool_inbox`) mantidas com nome histórico, mas populadas pelos handlers `late-*.ts` + `late-webhook.ts`. |
| **Performance multi-platform** | Métricas chegam por: (1) webhooks `post.published/post.failed/post.partial` → `late-webhook.ts`, (2) fetch sob demanda via `fetch-*-posts-apify.ts` quando a API do publisher não devolve analytics (ex: perfis pessoais LinkedIn). |
| **Polling > Realtime WS** | Reduz infra; uses cases atuais toleram 5–30s de latência. |
| **`SupabaseAuthAdapter` pra Neon Auth** | Mantém 45 callsites legados `supabase.auth.*` sem refactor. |
| **Tipos do Supabase mantidos** | `types.ts` ainda é o gerado pelo Lovable. Tabelas novas usam `(supabase as any)` até regenerarmos do Neon. |
| **Stubs 503 em vez de 501** | Handlers que dependem de credencial faltando retornam 503 com `missing_env` listando o que precisa. Quando Gabriel preenche o env, o handler ativa sozinho. |
| **JSON.stringify nos jsonb inserts** | Workaround do pg driver — coluna `metadata` precisa cast `::jsonb` em UPDATE. |
| **`INTERNAL_API_BASE_URL` resolution chain** | env var → `req.headers.host` → `https://kai-2-topaz.vercel.app`. Permite chamadas internas funcionarem em dev/preview/prod. |

---

## 10. O que ainda falta (não-bloqueante)

- pgvector + função `search_knowledge_semantic` no Neon (fallback ILIKE funciona)
- Codegen `types.ts` a partir do Neon
- pg_cron jobs antigos no Lovable Supabase: confirmar que ninguém depende deles antes de sunset
- Tooling de migração estruturada (drizzle-kit / atlas)
- Code splitting agressivo no front (chunk único de ~4MB)
- Validar OAuth real LinkedIn + Twitter + IG via Late/Zernio (handlers prontos, falta validar fluxo end-to-end por cliente)
