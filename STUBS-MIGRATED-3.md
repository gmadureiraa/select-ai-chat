# STUBS-3 — Migration Report

Branch: `combo-viral-integration`
Date: 2026-05-07
Scope: 9 endpoints assigned to STUBS-3 agent.

## Summary

| # | Handler | Status | LOC | Notes |
|---|---------|--------|-----|-------|
| 1 | `unified-content-api.ts` | done | 324 | Full Writer→Validate→Repair→Review pipeline |
| 2 | `scrape-newsletter.ts` | done | 320 | Firecrawl primary + regex fallback |
| 3 | `publish-viral-carousel.ts` | done | 186 | Reuses Supabase Storage; calls late-post in-process |
| 4 | `process-knowledge.ts` | skipped (conflict) | 121 | STUBS-2 already implemented — left untouched |
| 5 | `late-post.ts` | skipped (conflict) | 252 | STUBS-2 already implemented |
| 6 | `late-oauth-start.ts` | skipped (conflict) | 109 | STUBS-2 already implemented |
| 7 | `generate-radar-brief.ts` | skipped (conflict) | 272 | STUBS-2 already implemented |
| 8 | `analyze-client-onboarding.ts` | done | 313 | Firecrawl branding + scrape + Gemini/OpenAI tool-calling |
| 9 | `adapt-viral-reel.ts` | done | 332 | Apify scrape → MP4 download → Gemini File API → JSON |

**Implemented by STUBS-3:** 5 handlers (`unified-content-api`, `scrape-newsletter`, `publish-viral-carousel`, `analyze-client-onboarding`, `adapt-viral-reel`).
**Skipped (conflict with STUBS-2):** 4 handlers (`process-knowledge`, `late-post`, `late-oauth-start`, `generate-radar-brief`).

## New shared modules

- `api/_lib/shared/content-validator.ts` (319 LOC) — port of `supabase/functions/_shared/content-validator.ts`. Provides `parseOutput`, `validateContent`, `buildRepairPrompt`, `needsRepair`, `getValidationSummary`. Required by `unified-content-api`.
- `api/_lib/llm.ts` — added `isLLMConfigured()` helper (5 LOC).

## Build status

`bun run build` passes cleanly in ~6s. No TypeScript errors. All migrated handlers respect the convention:
- `import { authedPost } from '../_lib/handler.js'` (or `anonPost` for `scrape-newsletter`)
- `process.env.*` instead of `Deno.env.get`
- Neon SQL via `query()` / `getPool()` for DB access; `@supabase/supabase-js` only retained for Storage uploads in `publish-viral-carousel` (bucket `viral-carousel-renders`).
- ESM imports with explicit `.js` extension.

## Implementation notes per handler

### `unified-content-api`
- Requires LLM (Google or OpenAI) configured.
- Verifies user→workspace membership before generating.
- Loads context via `buildWriterSystemPrompt` (already-ported helper).
- Pipeline: Writer (`callLLM`) → Parse + Validate → Repair (configurable attempts) → Reviewer.
- Logs aggregate run to `ai_usage_logs` (per-step rows are already logged inside `callLLM`).
- Throws on full-LLM failure (no `createLLMUnavailableResponse` polyfill — caller gets a 500 with the message).

### `scrape-newsletter`
- `anonPost` (no auth required, matches original Deno behavior).
- Firecrawl primary path with 2s `waitFor` for dynamic content; falls back to regex parse.
- Strips tracking pixels, normalizes relative URLs, extracts headings/paragraphs/highlights, builds 7-slide carousel.
- Returns `{ success, data: { ... carouselSlides ... stats } }`.

### `publish-viral-carousel`
- `authedPost` + workspace membership check via SQL join (`clients` ⨝ `workspace_members`).
- Validates ≤10 slides, ≤8MB per slide, caption ≤2200 chars.
- Decodes data URL (`Buffer.from(b64, 'base64')`) and uploads each PNG to Supabase Storage bucket `viral-carousel-renders` (still required — no Neon storage equivalent yet).
- Re-invokes `late-post` handler **in-process** via a stubbed Vercel req/res to avoid HTTP round-trip and keep auth context.
- Updates `viral_carousels` row with media URLs and final status.

### `analyze-client-onboarding`
- Firecrawl branding extraction + markdown scrape (parallel) when website URL provided.
- Gemini Flash with function-calling preferred; OpenAI `gpt-4o-mini` fallback.
- Merges branding colors/logo into the AI's `visual_identity` if AI didn't surface them.
- Returns the same shape as the Deno original (`{ success, analysis: {…} }`).

### `adapt-viral-reel`
- Strict IG URL validation; only `reel`/`reels`/`p`/`tv` paths allowed.
- Inserts pending row in `viral_reels` (`status='processing'`), updates with result or error.
- Apify `instagram-scraper` actor → downloads MP4 → uploads to Gemini File API (multipart with polling until ACTIVE, max 90s).
- Gemini Flash with `responseSchema` returns strict JSON `{ analysis, script }`.
- Buffer-based (Node), not Uint8Array — the only meaningful Deno→Node port adjustment.

## API keys / secrets required

Already known. Listed for completeness so deploys catch missing envs:

| Key | Used by |
|-----|---------|
| `GOOGLE_AI_STUDIO_API_KEY` (or `GEMINI_API_KEY`) | unified-content-api, analyze-client-onboarding, adapt-viral-reel |
| `OPENAI_API_KEY` | unified-content-api, analyze-client-onboarding (fallback) |
| `FIRECRAWL_API_KEY` | scrape-newsletter, analyze-client-onboarding |
| `APIFY_API_KEY_INSTAGRAM` (or `APIFY_API_KEY`) | adapt-viral-reel |
| `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | publish-viral-carousel (Storage uploads) |
| `LATE_API_KEY` | indirect, via `late-post` invocation in publish-viral-carousel |

No new secret demands beyond what STUBS-1/2 already documented.

## Open TODOs / known gaps

- `publish-viral-carousel` re-invokes `late-post` via a mock Vercel response. Works because both run in the same Function instance. If the project later splits handlers across multiple Functions, swap to an HTTP fetch with the original `Authorization` header.
- `unified-content-api` does not currently emit a 503 with `Retry-After` header on LLM exhaustion (the Deno helper `createLLMUnavailableResponse` wasn't ported because the new handler envelope responds with 500 + JSON message instead). If clients depend on the 503 contract, add the helper later.
- No token-cost gating (`checkWorkspaceTokens` / `debitWorkspaceTokens`) was added to `unified-content-api` since the original didn't gate either.
- `late-post`, `late-oauth-start`, `process-knowledge`, `generate-radar-brief` were touched by STUBS-2 — STUBS-3 left them as-is per the conflict-avoidance rule. Verify those handlers separately if anything looks off.
