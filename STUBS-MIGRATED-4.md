# STUBS-4 — Migration Report

Branch: `combo-viral-integration`
Date: 2026-05-07
Scope: 15 endpoints assigned to STUBS-4 agent (cron jobs, scraping/metrics, notifications).

## Summary

| # | Handler                            | Status | LOC | Notes |
|---|------------------------------------|--------|-----|-------|
| 1 | `process-scheduled-posts.ts`       | ✅     | 344 | Cron-style; calls `late-post` in-process |
| 2 | `sync-all-metrics.ts`              | ✅     | 250 | Cron-style; fans out to fetch-* via internal HTTP |
| 3 | `batch-sync-posts.ts`              | ✅     | 232 | Authed; chains extract-instagram + transcribe-* |
| 4 | `process-due-date-notifications.ts`| ✅     |  54 | Cron-style; SQL RPC w/ graceful fallback |
| 5 | `process-recurring-content.ts`     | ✅     | 289 | Cron-style; calls unified-content-api for AI gen |
| 6 | `fetch-late-metrics.ts`            | ✅     | 599 | Late API analytics + follower stats → Neon |
| 7 | `fetch-linkedin-apify.ts`          | ✅     | 122 | Apify harvestapi/apimaestro scrapers |
| 8 | `fetch-tiktok-apify.ts`            | ✅     | 168 | Apify clockworks scraper |
| 9 | `transcribe-media.ts`              | ✅     | 141 | OpenAI Whisper; URL or base64 input |
|10 | `batch-transcribe-posts.ts`        | ✅     | 146 | Loops instagram_posts → transcribe-images |
|11 | `telegram-send-notification.ts`    | ✅     | 100 | Direct Telegram Bot API (no Lovable gateway) |
|12 | `telegram-notify.ts`               | ✅     | 178 | Direct Telegram Bot API; sendPhoto fallback to text |
|13 | `telegram-daily-report.ts`         | ✅     | 132 | Cron-style; daily kanban digest |
|14 | `process-email-notifications.ts`   | ✅     | 228 | Cron-style; drains queue via Resend HTTP |
|15 | `send-push-notification.ts`        | ✅     | 327 | Web Push (RFC8030) ported to Node Web Crypto + jose |

**All 15 stubs migrated. 0 skipped. Total: 3 310 LOC.**

## Build status

- `bun run build` → ✅ passes (~6s, 4997 modules transformed)
- `tsc --noEmit` (Node profile) over the 15 handlers → ✅ no errors after explicit `as any` casts on `fetch().json()` results

## Patterns used

### Cron-aware auth helper (inlined in each cron handler)
```ts
const cronSecret = process.env.CRON_SECRET;
const isCron =
  req.headers['x-vercel-cron'] === '1' ||
  (cronSecret && req.headers.authorization === `Bearer ${cronSecret}`);
if (!isCron) {
  const user = await tryAuth(req);
  if (!user) return jsonError(res, 401, 'Unauthorized');
}
```
This honors Vercel's automatic `x-vercel-cron: 1` header on scheduled invocations from `vercel.json` (already wired up for `sync-all-metrics` and `telegram-daily-report`), plus a fallback `CRON_SECRET` Bearer for manual or external triggers. Authed users can also call them.

### In-process internal calls
Three handlers (`process-scheduled-posts`, `process-recurring-content`, `sync-all-metrics`, `batch-sync-posts`, `batch-transcribe-posts`) call other migrated handlers via HTTP to the same Vercel function origin (`${proto}://${host}/api/<name>`), forwarding the original `Authorization` header. Mirrors the pattern STUBS-2 set up in `process-automations.ts`.

### Storage (Supabase Storage)
`batch-sync-posts` and `batch-transcribe-posts` still build `client-files` thumbnail URLs against `process.env.SUPABASE_URL` since the `transcribe-images`/`extract-instagram` handlers persist images to Supabase Storage (per existing convention in this repo). Will need a follow-up to migrate to `@vercel/blob` once those upstream handlers move.

### Telegram (no Lovable gateway)
Original called `https://connector-gateway.lovable.dev/telegram/*` with a Lovable API key. Ported to **direct Telegram Bot API** (`https://api.telegram.org/bot<TOKEN>/sendMessage` etc.) using `TELEGRAM_BOT_TOKEN`. Chat ID resolution priority: explicit override → `telegram_bot_config.chat_id` row → `TELEGRAM_CHAT_ID` env.

### Web Push (send-push-notification)
- Ported VAPID JWT signing from Deno `crypto.subtle.importKey('pkcs8', …)` to JWK-based `jose.importJWK` (cleaner Node-friendly path; same ES256 output).
- Encryption uses Node 20 native `globalThis.crypto.subtle` (ECDH P-256 + HKDF + AES-GCM). No third-party `web-push` dependency added.

## Env vars expected (already configured per task brief)
| Key                        | Used by                                                          |
|----------------------------|------------------------------------------------------------------|
| `DATABASE_URL`             | all (Neon pool)                                                  |
| `CRON_SECRET`              | optional auth bypass for cron handlers                           |
| `LATE_API_KEY`             | `fetch-late-metrics`                                             |
| `APIFY_API_KEY` / `APIFY_API_TOKEN` | `fetch-linkedin-apify`, `fetch-tiktok-apify`            |
| `OPENAI_API_KEY`           | `transcribe-media`                                               |
| `RESEND_API_KEY`           | `process-email-notifications`                                    |
| `EMAIL_FROM_ADDRESS`       | optional, defaults to `KAI <onboarding@resend.dev>`              |
| `TELEGRAM_BOT_TOKEN`       | `telegram-notify`, `telegram-send-notification`, `telegram-daily-report` |
| `TELEGRAM_CHAT_ID`         | optional fallback when `telegram_bot_config` row absent          |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | `send-push-notification`                           |
| `SUPABASE_URL`             | thumbnail URL builder in `batch-sync-posts`, `batch-transcribe-posts` |

## Open TODOs / blockers (non-blocking, just future work)

1. **`process-due-date-notifications`** depends on the SQL RPC `create_due_date_notifications()`. Falls back to `{ skipped: true }` if absent. Need to verify this function lives in the Neon DB or port it to a SQL CTE.
2. **`fetch-late-metrics`** assumes a unique constraint on `platform_metrics(client_id, platform, metric_date)` for the `ON CONFLICT` clause. Same assumption holds for `fetch-linkedin-apify` and `fetch-tiktok-apify`. Verify the migration matches.
3. **`process-scheduled-posts`** and `batch-sync-posts` chain calls to other handlers via internal HTTP (`/api/late-post`, `/api/extract-instagram`, etc.). If Vercel splits them across multiple instances later, they will still work but each call will round-trip through the edge.
4. **Auto-save to content library** (process-scheduled-posts) writes raw `INSERT INTO client_content_library`; if any column constraints differ from the original Supabase schema (e.g. workspace_id), it will fail silently (caught + logged).
5. **Cron schedule** for the new handlers (`process-scheduled-posts`, `process-recurring-content`, `process-due-date-notifications`, `process-email-notifications`, `batch-sync-posts`, `batch-transcribe-posts`) is **not yet wired in `vercel.json`**. Only `sync-all-metrics` (3am) and `telegram-daily-report` (9am) are. Caller should add cron entries when ready.
6. **`telegram-poll`** (the bot polling loop) was not in the STUBS-4 scope but lives in `supabase/functions/telegram-poll/`. The notification handlers send buttons whose callback_data is meant to be handled by that handler. Functionality of approve/reject/etc buttons depends on `telegram-poll` being migrated or replaced with a webhook.

## NOT touched (per scope)
- `kai-simple-chat` (KAI-CHAT agent owns it)
- `api/router.ts`, `api/handler-manifest.ts`
- `src/`
- All other handlers outside the 15-stub list

## No commits made (per instructions).
