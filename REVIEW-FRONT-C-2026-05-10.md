# Review Macro Final — Frente C: Sequência Viral + Reels + Radar

**Data:** 2026-05-10
**Escopo:** `src/components/kai/viral-sv-original/`, `viral-reels-original/`, `viral-radar-original/`, `viral/CrossAppActions.tsx`
**Regiões intocadas:** `src/components/ui/`, `src/components/planning/`, `src/components/performance-v2/`, `src/components/kai/library/`

## TL;DR

3 módulos viral estão funcionalmente OK. Build + `tsc --noEmit` 100% limpos. 2 fixes aplicados (1 bug P1 no Radar, 1 schema mismatch no handler de feedback). Endpoints todos resolvem via router fallback. Settings com endpoints quebrados degrada gracioso (try/catch + toast), igual era no standalone.

---

## STATUS POR MÓDULO

### Sequência Viral (Carrossel) — `viral-sv-original/`

**Status:** OK funcional.

| Tela | Endpoint | Handler | OK? |
|---|---|---|---|
| `pages-app/dashboard` | `/api/suggestions` (legado) | desligado intencionalmente | gracioso (catch silencioso) |
| `pages-app/carousels` | Supabase direto (`fetchUserCarousels`) | n/a | OK |
| `pages-app/create-new` | `/api/upload`, `/api/generate/interview`, `/api/images` | `upload.ts`, `generate-interview.ts` (kebab fallback), `images.ts` | OK |
| `pages-app/create-id/concepts` | `/api/generate-concepts`, `/api/generate` | `generate-concepts.ts`, `generate.ts` (adapter SV → `generate-viral-carousel`) | OK |
| `pages-app/create-id/templates` | reuso do `useGenerate` | `/api/generate` | OK |
| `pages-app/create-id/edit` | `/api/upload`, `/api/img-proxy` | OK | OK |
| `pages-app/create-id/preview` | `apiInvoke("publish-viral-carousel")`, `/api/feedback/carousel` | `publish-viral-carousel.ts`, `feedback-carousel.ts` (kebab fallback) | OK |
| `pages-app/settings/page` | `/api/brand-aesthetic`, `/api/auth/delete`, `/api/data-export`, `/api/data-import` | NÃO existem | gracioso via try/catch (toast erro, não trava) |
| `pages-app/settings/page` | `/api/profile-scraper`, `/api/brand-analysis`, `/api/voice-ingest` | OK | OK |
| `pages-app/onboarding` | `/api/post-transcripts`, `/api/suggestions` | NÃO existem | gracioso (`.then(r => r.ok ? json : null).catch(() => null)`) |
| `lib/auth-context.tsx` | `/api/email/welcome`, `/api/referrals/track` | `email-welcome.ts` (no-op), `referrals-track.ts` (no-op) | OK fire-and-forget |

**Visual:** paper cream `--sv-paper #F7F5EF` + ink `--sv-ink #0A0A0A` + REC coral `#FF3D2E` preservado. Tokens isolados via prefix `sv-*`, sem leakage no resto do KAI.

**Shims:**
- `next-link.tsx` → hash router interno + redirect billing→settings (correto, fix recente preservado)
- `next-navigation.ts` → mesmo padrão; `useSearchParams()` combina shell + hash (`?template=manifesto` no hash funciona)
- Anti-loop em `CrossAppActions` quando `source === target` (clica → Carrossel dentro do próprio SV abre `#/create/new` sem disparar bridge)

### Reels Viral — `viral-reels-original/`

**Status:** OK.

- Pipeline: cole link IG → `apiInvoke("adapt-viral-reel")` → `AdaptResponse` com analysis + script + storyboard → ResultView
- Handler `adapt-viral-reel.ts` existe e está no manifest
- Histórico via Supabase `viral_reels` (RLS user_id) — consistente com KAI
- `AutoSaveIndicator` + `useViralAutoSave` integrados
- `ClientReferencesPanel` puxa refs do cliente
- `CrossAppActions` no ResultView para "Salvar como ideia" / "Salvar na library"
- Visual: `rv-*` scope com cream + REC coral preservado

### Radar Viral — `viral-radar-original/`

**Status:** OK funcional após fix P1.

**6 seções renderizam:**

| Section | Handler |
|---|---|
| `top-instagram-section.tsx` (Reels + Carrosseis) | `radar-data-instagram.ts` |
| `top-youtube-section.tsx` | `radar-data-youtube.ts` |
| `top-news-section.tsx` | `radar-data-news.ts` |
| `top-threads-section.tsx` | `radar-data-threads.ts` |
| `top-twitter-section.tsx` | `radar-data-twitter.ts` |
| `top-linkedin-section.tsx` | `radar-data-linkedin.ts` |

Todos os 6 expõem `<CrossAppActions source="radar" ...>` com Carrossel + Reel + Ideia + Biblioteca. Aba Salvos removida (substituida por Biblioteca KAI via CrossAppActions).

**Outras telas:** Newsletters (`data-newsletters` via fallback `data/newsletters → data-newsletters` ✓), Admin (`radar-admin-stats` ✓).

Tab "sources" foi movida pro Perfil do Cliente → ClientViralSettingsTab; `ClientSourcesManager.tsx` está orfão dentro do radar mas é importado por fora.

---

## BUGS ENCONTRADOS + FIXES APLICADOS

### [P1 — fix aplicado] Radar `<Link href="/app/precos">` e `<Link href="/app/news">` saíam da tab

**Problema:** O shim `Link` em `viral-radar-original/lib/next-shims.tsx` repassava `/app/*` direto pro `react-router-dom Link`. O App.tsx do KAI tem `Route path="/:slug" element={<Navigate to="/kaleidos" replace />}` — então clicar nesses links redirecionava o user pra `/kaleidos/clients`, tirando ele da tab Radar.

**Locais afetados:**
- `pages/Dashboard.tsx:236-242` — banner "Ver Pro" (só aparece quando `sub.isPaid === false`, raro no KAI interno)
- `pages/Dashboard.tsx:1213-1220` — botão "Ver fontes" (mais visível, dentro de cards de narrativas)

**Fix:** `next-shims.tsx` agora detecta `href.startsWith("/app")` e renderiza um `<a role="button">` com `preventDefault` no click — o link mantém estilo mas não navega. cmd/ctrl-click ainda deixa abrir em nova aba como fallback amigável.

### [P0 — fix aplicado] `feedback-carousel.ts` schema mismatch

**Problema:** `FeedbackModal.tsx` envia `{ carouselId: id|null, rawText: string }`. O stub original aceitava `{ carouselId, score, message, tags }` e fazia `if (!carouselId) throw 'carouselId is required'`. Resultado:

1. Sempre falhava porque `rawText` ≠ `message`
2. Quebrava se user abrisse o modal antes do save persistir o carouselId

**Fix:** Handler agora aceita ambos shapes:
- `rawText` → `message` (legado SV)
- `message + score + tags` (novo)
- `carouselId` opcional (null OK)
- Valida que pelo menos `message` ou `score` está preenchido (400 se vazio)

---

## TODOs RESTANTES (não-bloqueantes)

### Settings page do SV — endpoints fantasma
3 botões secundários chamam endpoints que não existem (mas degradam graciosos via toast):

- `/api/brand-aesthetic` (analyze brand visual via Gemini Vision) — ~30 linhas no `settings/page.tsx:476`
- `/api/auth/delete` (delete account) — `settings/page.tsx:694`. KAI tem `delete-account.ts` que poderia substituir, mas o FE manda payload diferente.
- `/api/data-export` / `/api/data-import` — `settings/page.tsx:2593, 2644`. Pra implementar precisaria definir schema de export do workspace inteiro.

**Recomendação:** esconder esses 3 botões (toggles com `if (false)` ou prop `compact`) ao invés de deixar o user clicar e ver toast de erro. Não foi aplicado pra preservar paridade visual com o standalone (decisão consciente).

### `/api/post-transcripts` (onboarding)
Vision em massa de posts pra brand_analysis. `onboarding.tsx:376` já tem `.catch(() => null)` então é gracioso. Implementação real exigiria portar handler `transcribe-images.ts` adaptado pra batch de URLs IG.

### `/api/suggestions` (onboarding + dashboard)
Decisão Gabriel 2026-04-28 — desligada por simplificação. Comentário claro no código. Manter desligado.

### Radar `100vh` em sidebar fixed
Sidebar do Radar usa `position: sticky; top: 0; height: 100vh` dentro de wrapper `h-full overflow-hidden`. Funciona mas pode ter pixel diff em mobile (drawer drawer-mobile já trata o caso). Não bloqueante.

### CrossAppActions: anti-loop testado
Confirmado: clicar "→ Carrossel" dentro do SV não dispara bridge, só pula pra `#/create/new`. Mesmo pra Reels.

---

## VERIFICAÇÕES FINAIS

```
bun run build  → ✓ 6.43s, sem warnings
bunx tsc --noEmit  → ✓ clean
```

Endpoints críticos do flow E2E:

- Carrossel: `/api/generate-concepts` ✓ → `/api/generate` ✓ (adapter pra `generate-viral-carousel`) → `apiInvoke("publish-viral-carousel")` ✓
- Reels: `apiInvoke("adapt-viral-reel")` ✓
- Radar: `radar-data-{instagram,youtube,news,threads,twitter,linkedin}` ✓ + `radar-brief` ✓ + `radar-admin-stats` ✓ + `radar-img-proxy` ✓

Cross-app bridge (Zustand `pendingBriefing` + tab swap + hash route):

- Radar → Carrossel: `setPending() + ?tab=viral-carrossel#/create/new` ✓
- Radar → Reels: `setPending() + ?tab=viral-reels-page` ✓
- Radar → Ideia: `planning_items` insert (com `column_id` resolved pro Kanban) ✓
- Radar → Biblioteca: `client_reference_library` insert com idempotência por `source_url` ✓

---

## ARQUIVOS MODIFICADOS NESTA REVISÃO

1. `/Users/gabrielmadureira/GOS/code/kai-app-combo/src/components/kai/viral-radar-original/lib/next-shims.tsx` — `Link` shim trata `/app/*` como no-op (preventDefault) pra não cair no `/:slug` redirect do App.tsx
2. `/Users/gabrielmadureira/GOS/code/kai-app-combo/api/_handlers/feedback-carousel.ts` — aceita `rawText` (legado SV) além de `message`, `carouselId` opcional, validação de payload mínimo
