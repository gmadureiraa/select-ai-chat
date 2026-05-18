# ENV-VARS.md — KAI 2.0

Lista completa de todas as env vars usadas no codebase. Coverage: **100%** das ocorrências em `src/` e `api/`.

> Convenção:
> - Vars com prefixo `VITE_` são **expostas no bundle do client** (Vite as substitui em build-time). Nunca colocar segredos aí.
> - Sem prefixo = **server-side only** (lidas em `process.env` dentro de Vercel Functions).
> - Required marcado com **R**, opcional com **O**.

---

## Resumo rápido (mínimo viável)

Pra dev local + build + login funcionar:

```bash
# Database / Auth (R)
DATABASE_URL=postgresql://neondb_owner:***@ep-…-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require
VITE_SUPABASE_URL=https://ep-….apirest.sa-east-1.aws.neon.tech/neondb
VITE_NEON_AUTH_URL=https://ep-….neonauth.sa-east-1.aws.neon.tech/neondb/auth
VITE_NEON_JWKS_URL=https://ep-….neonauth.sa-east-1.aws.neon.tech/neondb/auth/.well-known/jwks.json
NEON_JWKS_URL=$VITE_NEON_JWKS_URL

# Storage (R em prod)
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_…

# LLM principal (R)
GEMINI_API_KEY=...    # OU GOOGLE_AI_STUDIO_API_KEY (alias usado em alguns handlers)
```

Com isso, o app sobe, faz login e consulta DB. APIs de OAuth/Apify/Telegram retornam **503 + `missing_env`** explicando o que falta — preencher só pra usar a feature correspondente.

---

## 1. Auth + Data API + DB (core)

| Var | R/O | Tipo | Origem | Uso |
|---|---|---|---|---|
| `DATABASE_URL` | **R** | server | Neon Console → Connection string (pooled) | `api/_lib/db.ts` Pool, todos os handlers |
| `VITE_SUPABASE_URL` | **R** | client | Neon Data API URL (`/neondb`) | `src/integrations/supabase/client.ts` PostgREST base |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | O | client | Pode ficar vazio (PostgREST aceita JWT no `apikey`) | `src/integrations/supabase/client.ts` |
| `VITE_SUPABASE_PROJECT_ID` | O | client | Identificador legado (`"kai-neon"`) | Compat — alguns componentes leem |
| `VITE_NEON_AUTH_URL` | **R** | client | Neon Console → Auth tab | `src/integrations/neon-auth/client.ts` |
| `VITE_NEON_JWKS_URL` | **R** | client | Neon Auth `/auth/.well-known/jwks.json` | `src/integrations/neon-auth/*` (debug) |
| `NEON_JWKS_URL` | **R** | server | mesmo valor de `VITE_NEON_JWKS_URL` (sem prefixo) | `api/_lib/auth.ts` JWT verify |

Exemplo de valores reais (sa-east-1):

```
DATABASE_URL="postgresql://neondb_owner:npg_***@ep-sparkling-moon-acbufmuw-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
VITE_SUPABASE_URL="https://ep-sparkling-moon-acbufmuw.apirest.sa-east-1.aws.neon.tech/neondb"
VITE_NEON_AUTH_URL="https://ep-sparkling-moon-acbufmuw.neonauth.sa-east-1.aws.neon.tech/neondb/auth"
VITE_NEON_JWKS_URL="https://ep-sparkling-moon-acbufmuw.neonauth.sa-east-1.aws.neon.tech/neondb/auth/.well-known/jwks.json"
NEON_JWKS_URL=$VITE_NEON_JWKS_URL
```

---

## 2. Storage (Vercel Blob)

| Var | R/O | Tipo | Origem | Uso |
|---|---|---|---|---|
| `BLOB_READ_WRITE_TOKEN` | **R** em prod | server | Vercel Project → Storage → Blob → Token | `api/blob/*.ts` (gera client tokens) |
| `VITE_BLOB_PUBLIC_HOST` | O | client | `https://<store-id>.public.blob.vercel-storage.com` | `src/integrations/storage/blob-client.ts` `getPublicUrl()` fallback. Default: `https://blob.vercel-storage.com` |

---

## 3. LLM providers

| Var | R/O | Origem | Uso |
|---|---|---|---|
| `GEMINI_API_KEY` | **R** | https://aistudio.google.com/apikey | LLM principal (Gemini 2.5 Flash/Pro). Usado em `kai-content-agent`, `generate-viral-carousel`, `cron-generate-daily-brief`, `extract-pdf` (Vision), etc. |
| `GOOGLE_AI_STUDIO_API_KEY` | O (alias) | mesmo que `GEMINI_API_KEY` | Alguns handlers legados leem este nome |
| `OPENAI_API_KEY` | O | https://platform.openai.com | Fallback em `_lib/llm.ts`, alguns insights |
| `LOVABLE_API_KEY` | O | Lovable AI Gateway | Legado — alguns handlers ainda referenciam (`kai-metrics-agent`, `validate-csv-import`) |
| `GROK_API_KEY` | O | https://x.ai | Web search no `kai-simple-chat` (fallback se ausente) |

> **Importante:** `_lib/llm.ts` faz retry/fallback automático. Sem `GEMINI_API_KEY` o app sobe mas qualquer feature de IA quebra.

---

## 4. Scrapers / Content APIs

| Var | R/O | Origem | Uso |
|---|---|---|---|
| `APIFY_API_KEY` | O | https://console.apify.com/account/integrations | Scrapers (TikTok, YouTube, Twitter, IG fallback). Sem isso, handlers retornam 503 |
| `APIFY_API_KEY_INSTAGRAM` | O | mesma conta Apify (segregação opcional) | `extract-instagram`, `cron-scrape-instagram` |
| `APIFY_API_TOKEN` | O | alias legado | Compat |
| `APIFY_API_TOKEN_2` | O | secundário (rotação) | Backup |
| `FIRECRAWL_API_KEY` | O | https://www.firecrawl.dev | `firecrawl-scrape`, `fetch-reference-content` |
| `SUPADATA_API_KEY` | O | https://supadata.ai | YouTube transcript em `extract-youtube` (fallback YT Inner API) |
| `YOUTUBE_API_KEY` | O | Google Cloud Console | `youtube-search`, `fetch-youtube-metrics`, `resolve-youtube-channel` |
| `YT_API_KEY` | O | alias | Compat |
| `PEXELS_API_KEY` | O | https://www.pexels.com/api | `image-search` (Pexels) |
| `BEEHIIV_API_KEY` | O | Beehiiv dashboard | `fetch-beehiiv-metrics` |

---

## 5. OAuth / Social publishing

### LinkedIn
| Var | R/O | Origem | Uso |
|---|---|---|---|
| `LINKEDIN_CLIENT_ID` | O | https://developer.linkedin.com → app | `linkedin-oauth-start`, `linkedin-oauth-callback`, `linkedin-post` |
| `LINKEDIN_CLIENT_SECRET` | O | mesmo | callback + post |
| `LINKEDIN_REDIRECT_URI` | O | configurar no LI app settings | default: `https://<host>/api/linkedin-oauth-callback` |

### Twitter / X
| Var | R/O | Origem | Uso |
|---|---|---|---|
| `TWITTER_CONSUMER_KEY` | O | https://developer.twitter.com | OAuth 1.0a/2.0 |
| `TWITTER_CONSUMER_SECRET` | O | mesmo | OAuth |
| `TWITTER_REDIRECT_URI` | O | default `https://<host>/api/twitter-oauth-callback` | OAuth callback |

### Late.so / Zernio (publisher único — 2026-05-17)
Late/Zernio é o agregador de publicação ativo no KAI. Cobre 14 redes (Instagram, TikTok, X, LinkedIn, YouTube, Threads, Facebook, ...) + inbox + métricas. Substituiu Metricool (sunset 2026-05-08) e o experimento Postiz (sunset 2026-05-17).

| Var | R/O | Origem | Uso |
|---|---|---|---|
| `LATE_API_KEY` | **R** | https://getlate.dev → Settings → API Keys | Bearer auth em todos os handlers `late-*.ts` (post, oauth-start, oauth-callback, accounts, analytics, inbox, ...) |
| `LATE_WEBHOOK_SECRET` | **R** | gerar localmente (`openssl rand -hex 32`) e colar em Settings → Webhooks → Create Webhook | HMAC SHA-256 de `late-webhook.ts` (eventos `post.published/failed/partial/scheduled/cancelled/recycled`, `account.disconnected/expired`) |
| `LATE_OAUTH_CALLBACK_BASE` | O | default monta de `req.headers.host` | OAuth callback base. Override só se o callback precisar de domínio diferente do app. |

### Postiz (DEPRECATED 2026-05-17 — vars mantidas pra evitar erro de boot em ambientes antigos)
Handlers `postiz-*.ts` foram arquivados. Não preencher essas vars em ambientes novos.

| Var | R/O | Status |
|---|---|---|
| `POSTIZ_API_KEY` | DEPRECATED | Ignorado. Removido em handlers vivos. |
| `POSTIZ_API_URL` | DEPRECATED | Ignorado. |
| `POSTIZ_WEBHOOK_SECRET` | DEPRECATED | Ignorado. |
| `POSTIZ_OAUTH_CALLBACK_BASE` | DEPRECATED | Ignorado. |
| `POSTIZ_CONNECT_URL_TEMPLATE` | DEPRECATED | Ignorado. |

### Metricool (DEPRECATED 2026-05-08 — sunset confirmado)
Tabelas `metricool_posts`, `metricool_daily_snapshots` e `metricool_inbox` mantêm o nome histórico no schema, mas são populadas via webhooks Late/Zernio. Vars `METRICOOL_*` foram removidas do `get-integrations-status` em 2026-05-18.

| Var | R/O | Status |
|---|---|---|
| `METRICOOL_USER_TOKEN` | REMOVIDO | Não usado em handlers vivos. |
| `METRICOOL_USER_ID` | REMOVIDO | Não usado em handlers vivos. |
| `METRICOOL_API_URL` | REMOVIDO | Não usado em handlers vivos. |

---

## 6. Notificações

### Telegram
| Var | R/O | Origem | Uso |
|---|---|---|---|
| `TELEGRAM_BOT_TOKEN` | O | @BotFather | `telegram-poll`, `telegram-notify`, `telegram-daily-report`, `telegram-send-notification` |
| `TELEGRAM_API_KEY` | O | legado | Compat (não usado pelo poll migrado) |
| `TELEGRAM_CHAT_ID` | O | ID do chat default | `telegram-daily-report` |

### Email
| Var | R/O | Origem | Uso |
|---|---|---|---|
| `RESEND_API_KEY` | O | https://resend.com | `send-invite-email` |
| `EMAIL_FROM_ADDRESS` | O | domínio verificado no Resend | sender de invites |

### Push (Web Push)
| Var | R/O | Origem | Uso |
|---|---|---|---|
| `VAPID_PUBLIC_KEY` | O | gerar com `web-push generate-vapid-keys` | `get-vapid-public-key`, `send-push-notification` |
| `VAPID_PRIVATE_KEY` | O | mesmo gen | server-only signing |

---

## 7. Integrações externas (terceiros)

| Var | R/O | Origem | Uso |
|---|---|---|---|
| `CLICKUP_API_TOKEN` | O | ClickUp app settings | `import-clickup` (ou header `x-clickup-token` por request) |
| `STRIPE_SECRET_KEY` | O | Stripe dashboard | Pagamentos (legado, atualmente sem feature ativa) |
| `MCP_ACCESS_TOKEN` | O | Token MCP do KAI | `mcp-reader` |

---

## 8. Cron / segurança

| Var | R/O | Origem | Uso |
|---|---|---|---|
| `CRON_SECRET` | **R** em prod | gerado: `openssl rand -hex 32` | Auth dos endpoints `/api/cron-*`. Vercel Cron usa `x-vercel-cron: 1`; manual usa `Authorization: Bearer $CRON_SECRET` |
| `RADAR_IG_CRON_ENABLED` | O (`=1`) | feature flag | habilita custos Apify pro IG scrape |
| `RADAR_TIKTOK_CRON_ENABLED` | O (`=1`) | feature flag | habilita custos Apify pro TikTok scrape |

---

## 9. Internal / dev

| Var | R/O | Origem | Uso |
|---|---|---|---|
| `INTERNAL_API_BASE_URL` | O | default monta de `req.headers.host` ou cai em prod URL | Chamadas internas entre handlers (`kai-simple-chat` → `late-post` etc.) |
| `INTERNAL_SERVICE_TOKEN` | O | gerar `openssl rand -hex 32` | Bearer auth pra chamadas internas (Telegram bot etc.) |
| `FRONTEND_URL` | O | default `https://kai-2-topaz.vercel.app` | Redirect target em OAuth callbacks |
| `VERCEL_OIDC_TOKEN` | O (auto) | Vercel injeta em runtime | OIDC pra alguns serviços Vercel |

---

## 10. Compat com Supabase legado (durante migração)

| Var | R/O | Status | Uso |
|---|---|---|---|
| `SUPABASE_URL` | O | server, legado | Usado por `extract-instagram` que ainda faz upload via `@supabase/supabase-js` admin. Deprecar quando storage migrar 100% |
| `SUPABASE_SERVICE_ROLE_KEY` | O | server, legado | Idem. Aceito como fallback de `INTERNAL_SERVICE_TOKEN` em Telegram bot auth |

---

## 11. Built-in Vite

| Var | Origem | Uso |
|---|---|---|
| `import.meta.env.DEV` | injetado pelo Vite | branch dev-only |
| `import.meta.env.PROD` | injetado pelo Vite | branch prod-only |

---

## Onde configurar

### Local (dev)

`.env` na raiz (commitado com valores não-secretos da Neon dev) + `.env.local` (não commitado, valores secretos como `BLOB_READ_WRITE_TOKEN`).

`.env.local` é gerado via:

```bash
vercel env pull .env.local --environment=development
```

### Vercel (preview + prod)

Dashboard → Project `kai-2` → Settings → Environment Variables.
Ou via CLI:

```bash
vercel env add VAR_NAME production
vercel env ls
```

Lembrete: novas env vars **não** afetam deploys existentes. Pra ativar precisa redeploy:

```bash
vercel deploy --prod
```

---

## Coverage check

Comando que gera a lista completa:

```bash
grep -rh "process\.env\.\|import\.meta\.env\." src/ api/ \
  --include="*.ts" --include="*.tsx" |
  grep -oE "(process\.env|import\.meta\.env)\.[A-Z_]+" |
  sort -u
```

Resultado atual (52 vars distintas):

```
import.meta.env.DEV
import.meta.env.PROD
import.meta.env.VITE_BLOB_PUBLIC_HOST
import.meta.env.VITE_NEON_AUTH_URL
import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
import.meta.env.VITE_SUPABASE_URL
process.env.APIFY_API_KEY
process.env.APIFY_API_KEY_INSTAGRAM
process.env.APIFY_API_TOKEN
process.env.APIFY_API_TOKEN_2
process.env.BEEHIIV_API_KEY
process.env.BLOB_READ_WRITE_TOKEN
process.env.CLICKUP_API_TOKEN
process.env.CRON_SECRET
process.env.DATABASE_URL
process.env.EMAIL_FROM_ADDRESS
process.env.FIRECRAWL_API_KEY
process.env.FRONTEND_URL
process.env.GEMINI_API_KEY
process.env.GOOGLE_AI_STUDIO_API_KEY
process.env.GROK_API_KEY
process.env.INTERNAL_API_BASE_URL
process.env.INTERNAL_SERVICE_TOKEN
process.env.LATE_API_KEY
process.env.LATE_OAUTH_CALLBACK_BASE
process.env.LATE_WEBHOOK_SECRET
process.env.POSTIZ_API_KEY
process.env.POSTIZ_API_URL
process.env.POSTIZ_WEBHOOK_SECRET
process.env.POSTIZ_OAUTH_CALLBACK_BASE
process.env.POSTIZ_CONNECT_URL_TEMPLATE
process.env.LINKEDIN_CLIENT_ID
process.env.LINKEDIN_CLIENT_SECRET
process.env.LINKEDIN_REDIRECT_URI
process.env.LOVABLE_API_KEY
process.env.MCP_ACCESS_TOKEN
process.env.NEON_JWKS_URL
process.env.OPENAI_API_KEY
process.env.PEXELS_API_KEY
process.env.RADAR_IG_CRON_ENABLED
process.env.RADAR_TIKTOK_CRON_ENABLED
process.env.RESEND_API_KEY
process.env.STRIPE_SECRET_KEY
process.env.SUPABASE_SERVICE_ROLE_KEY
process.env.SUPABASE_URL
process.env.SUPADATA_API_KEY
process.env.TELEGRAM_API_KEY
process.env.TELEGRAM_BOT_TOKEN
process.env.TELEGRAM_CHAT_ID
process.env.TWITTER_CONSUMER_KEY
process.env.TWITTER_CONSUMER_SECRET
process.env.TWITTER_REDIRECT_URI
process.env.VAPID_PRIVATE_KEY
process.env.VAPID_PUBLIC_KEY
process.env.VITE_NEON_JWKS_URL
process.env.VITE_SUPABASE_URL
process.env.YOUTUBE_API_KEY
process.env.YT_API_KEY
```

Se aparecer var nova nesta lista, atualizar este doc.
