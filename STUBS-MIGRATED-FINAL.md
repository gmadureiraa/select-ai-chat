# STUBS-MIGRATED-FINAL.md

Migração final dos 10 stubs restantes (83/93 → 93/93). Cada handler funciona com **fallback defensivo**: retorna `503` com `missing_env` listando o que falta caso credenciais não estejam configuradas — assim que Gabriel adicionar a env var, o flow real ativa automaticamente.

## Padrão de fallback

```ts
const REQUIRED_ENV = ['FOO_KEY', 'FOO_SECRET'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length > 0) {
  res.status(503).json({
    error: '<service> integration not configured',
    missing_env: missing,
    hint: 'Add the missing env vars in Vercel and redeploy',
  });
  return;
}
// ... lógica real
```

---

## Status dos 10 handlers

| Handler | Status | LOC | Method | Env vars necessárias |
|---|---|---|---|---|
| `linkedin-oauth-start` | ✅ implementado | 50 | POST (auth) | `LINKEDIN_CLIENT_ID` |
| `linkedin-oauth-callback` | ✅ implementado | 153 | GET | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` |
| `linkedin-post` | ✅ implementado | 237 | POST (auth) | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` |
| `twitter-oauth-start` | ✅ implementado | 91 | POST (auth) | `TWITTER_CONSUMER_KEY`, `TWITTER_CONSUMER_SECRET` |
| `twitter-oauth-callback` | ✅ implementado | 235 | GET | `TWITTER_CONSUMER_KEY`, `TWITTER_CONSUMER_SECRET` |
| `twitter-post` | ✅ implementado | 346 | POST (auth) | `TWITTER_CONSUMER_KEY`, `TWITTER_CONSUMER_SECRET` |
| `late-oauth-callback` | ✅ implementado | 421 | GET | `LATE_API_KEY` |
| `late-webhook` | ✅ implementado | 421 | POST | `LATE_WEBHOOK_SECRET` |
| `import-clickup` | ✅ implementado | 416 | POST (auth) | `CLICKUP_API_TOKEN` (env) **OU** header `x-clickup-token` |
| `telegram-poll` | ✅ implementado | 933 | GET/POST | `TELEGRAM_BOT_TOKEN` |

**Total: 3.303 LOC migrados.**

---

## Env vars completas a adicionar no Vercel

### LinkedIn (3 handlers)
```bash
LINKEDIN_CLIENT_ID=...           # Obrigatório (start, callback, post)
LINKEDIN_CLIENT_SECRET=...       # Obrigatório (callback, post)
LINKEDIN_REDIRECT_URI=...        # Opcional — default: https://<host>/api/linkedin-oauth-callback
```

### Twitter / X (3 handlers)
```bash
TWITTER_CONSUMER_KEY=...         # Obrigatório (start, callback, post)
TWITTER_CONSUMER_SECRET=...      # Obrigatório (start, callback, post)
TWITTER_REDIRECT_URI=...         # Opcional — default: https://<host>/api/twitter-oauth-callback
```

### Late API (2 handlers — `late-oauth-start` já migrado, faltam callback + webhook)
```bash
LATE_API_KEY=...                 # Obrigatório (callback, e late-post/late-oauth-start já existentes)
LATE_WEBHOOK_SECRET=...          # Obrigatório (webhook — para validar HMAC SHA-256)
```

### ClickUp (1 handler)
```bash
# Modo 1: token global no servidor
CLICKUP_API_TOKEN=pk_...         # Opcional se usar header x-clickup-token

# Modo 2: cliente envia header por request
# x-clickup-token: pk_...
```

### Telegram (1 handler)
```bash
TELEGRAM_BOT_TOKEN=...           # Obrigatório (telegram-poll)
# Opcional: já usados por outros handlers (notify, daily-report, send-notification)
LOVABLE_API_KEY=...              # legado, NÃO usado pelo poll migrado
TELEGRAM_API_KEY=...             # legado, NÃO usado pelo poll migrado
```

### Frontend redirect (todos os OAuth callbacks)
```bash
FRONTEND_URL=https://kai-2-topaz.vercel.app  # Opcional — default já aponta pro app
```

---

## Notas de implementação

### Mudanças importantes vs. originais Supabase

1. **Telegram**: o handler migrado usa **direct Telegram Bot API** (`https://api.telegram.org/bot<token>/...`), não mais o connector gateway da Lovable. Mais simples, menos dependências. Mesmo padrão dos outros handlers já migrados (`telegram-notify`, `telegram-daily-report`).

2. **Storage**: `import-clickup` agora faz upload de attachments via `@vercel/blob` em vez de Supabase Storage `planning-media` bucket.

3. **Auth**: handlers POST autenticados usam `authedPost` (Neon Auth JWT). OAuth callbacks (GET) e o webhook do Late são públicos por design — webhook valida HMAC SHA-256 com `LATE_WEBHOOK_SECRET`.

4. **Internal calls** (`telegram-poll` precisa chamar `late-post` e `unified-content-api`): usa fetch HTTP local pra `${proto}://${host}/api/<slug>` em vez de invocar Edge Functions Supabase. Forwarda o header `Authorization` se presente.

5. **OAuth state**:
   - LinkedIn: state base64 com `{userId, clientId, timestamp}` (10min TTL)
   - Twitter: state HMAC-SHA256 com PKCE code_verifier salvo em `client_social_credentials.metadata` (15min TTL)

6. **Callback URLs** (configurar no LinkedIn/Twitter Developer Portal):
   - LinkedIn: `https://<vercel-host>/api/linkedin-oauth-callback`
   - Twitter: `https://<vercel-host>/api/twitter-oauth-callback`
   - Late: já configurado via `late-oauth-start` (que constrói `attemptId` automaticamente)

7. **Database**: todas as queries vão pra Neon via `query()` / `getPool()`. Tabelas tocadas:
   - `client_social_credentials` (LinkedIn/Twitter/Late OAuth)
   - `oauth_connection_attempts` (Late)
   - `planning_items` (post + webhook updates + telegram approve/reject)
   - `scheduled_posts` (legacy table for LinkedIn/Twitter post)
   - `kanban_columns` / `kanban_cards` (move to "published" coluna)
   - `webhook_events_log` (Late webhook audit)
   - `webhook_alert_preferences` (per-client alert toggle)
   - `client_content_library` (auto-add published posts)
   - `automation_content_feedback` (telegram fb_like/fb_dislike/fb_delete)
   - `telegram_bot_config` (chat_id, offset, pending_*)
   - `telegram_messages` (raw updates log)
   - `clients` (lookup)

---

## Verificação

```bash
# Type-check (passa sem erros)
bunx tsc --noEmit --target ES2022 --module ESNext --moduleResolution bundler \
  --skipLibCheck --esModuleInterop --types node \
  api/_handlers/linkedin-oauth-start.ts \
  api/_handlers/linkedin-oauth-callback.ts \
  api/_handlers/linkedin-post.ts \
  api/_handlers/twitter-oauth-start.ts \
  api/_handlers/twitter-oauth-callback.ts \
  api/_handlers/twitter-post.ts \
  api/_handlers/late-oauth-callback.ts \
  api/_handlers/late-webhook.ts \
  api/_handlers/import-clickup.ts \
  api/_handlers/telegram-poll.ts
# exit=0

# Build do frontend (não tocou)
bun run build
# ✓ built in ~7s
```

---

## Próximos passos pra Gabriel

1. **LinkedIn**: criar app em https://developer.linkedin.com → adicionar `LINKEDIN_CLIENT_ID` + `LINKEDIN_CLIENT_SECRET` no Vercel + configurar callback URL no app settings.
2. **Twitter**: criar app em https://developer.twitter.com → adicionar `TWITTER_CONSUMER_KEY` + `TWITTER_CONSUMER_SECRET` no Vercel + configurar OAuth 2.0 callback URL.
3. **Late webhook**: registrar webhook no painel Late apontando pra `https://<vercel-host>/api/late-webhook` + adicionar `LATE_WEBHOOK_SECRET` no Vercel.
4. **ClickUp**: adicionar `CLICKUP_API_TOKEN` no Vercel **OU** ajustar frontend pra mandar header `x-clickup-token` por request (cada user usa seu próprio token).
5. **Telegram poll**: configurar cron job no Vercel chamando `/api/telegram-poll` a cada 1-2 min + adicionar `TELEGRAM_BOT_TOKEN`.

Cada endpoint vai retornar 503 explicando o que falta até a env var estar setada — depois ativa sozinho. Zero handlers em estado `501` agora.
