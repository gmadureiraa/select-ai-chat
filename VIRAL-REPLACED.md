# VIRAL-REPLACED.md

Branch: `combo-viral-integration` · Sem commits novos (regra do agente).

Continuação do trabalho documentado em `VIRAL-PORTED.md`. Esta sessão consolidou
o **REPLACE** das tabs viral antigas + cleanup do duplicado e do legacy KAI-1.0.

---

## TL;DR

- **`ViralHunterTab` (KAI-1.0 legacy, 134 LOC) DELETADO.** Sem standalone equivalente. Backup em `_legacy/viral-replaced-2026-05-08/`.
- **`viral-hunter/` (12 arquivos: hooks, tabs, helpers) DELETADO.** Mesmo backup.
- **3 placeholders `.deprecated` REMOVIDOS** (`ViralCarrosselPlaceholderTab.tsx.deprecated`, `ViralReelsPlaceholderTab.tsx.deprecated`, `ViralRadarPlaceholderTab.tsx.deprecated`). Já não eram importados.
- **Sidebar consolidado**: grupo "Cliente" duplicado (que tinha Viral Hunter / Sequência Viral / Reels Viral / Radar Viral apontando pros mesmos componentes que o grupo "Viral") removido. Agora **um único grupo "Viral"** com Biblioteca, Carrossel, Reels, Radar.
- **`Kai.tsx`** dedupado: cases `"viral"`, `"sequence"`, `"reels"`, `"radar"` removidos. Só sobraram `"viral-carrossel"`, `"viral-reels-page"`, `"viral-radar-page"`, `"viral-library"`. Bookmarks/links antigos com `?tab=sequence` (etc) são redirecionados automaticamente via `legacyViralAlias` no useEffect de route protection.
- **`MobileBottomNav`** limpo: item Viral Hunter removido. Atalho ⌘I do desktop, que ia pro Hunter, agora vai pro Radar Viral (substituto natural).
- **Build OK** · TypeScript clean.

## Versões antigas removidas

| Arquivo                                                              | LOC  | Status                                  |
|----------------------------------------------------------------------|-----:|-----------------------------------------|
| `src/components/kai/ViralHunterTab.tsx`                              | 134  | Movido pra `_legacy/.../ViralHunterTab.tsx` |
| `src/components/kai/viral-hunter/`                                   |  ~1k | Movido pra `_legacy/.../viral-hunter/`  |
| `src/components/kai/ViralCarrosselPlaceholderTab.tsx.deprecated`     |  ~50 | DELETADO (já não importado)             |
| `src/components/kai/ViralReelsPlaceholderTab.tsx.deprecated`         |  ~50 | DELETADO                                |
| `src/components/kai/ViralRadarPlaceholderTab.tsx.deprecated`         |  ~50 | DELETADO                                |
| `KaiSidebar.tsx` grupo "Cliente" → 4 NavItems duplicados             |  ~50 | DELETADO inline                         |

## Versões novas (mantidas como source of truth)

Estas tabs JÁ ERAM ports atuais dos repos standalone (feito na sessão anterior — `VIRAL-PORTED.md`). Validei que continuam funcionando após o cleanup.

| Tab                       | Arquivo                                          | LOC  | Origem standalone                                    |
|---------------------------|--------------------------------------------------|-----:|------------------------------------------------------|
| `viral-carrossel`         | `src/components/kai/ViralSequenceTab.tsx`        | 952  | `code/sequencia-viral/` (Next 16 → Vite)             |
| `viral-reels-page`        | `src/components/kai/ViralReelsTab.tsx`           | 537  | `code/reels-viral/` (Next 16 → Vite)                 |
| `viral-radar-page`        | `src/components/kai/ViralRadarTab.tsx`           | 346  | `code/radar-viral/` (Next 16 → Vite)                 |
| `viral-library`           | `src/components/kai/ViralLibraryTab.tsx`         | ~330 | (KAI-only — curadoria global de ideias/reels)        |

Submódulos preservados:
- `src/components/kai/viral-sequence/` — templates (Manifesto, Futurista, Twitter, Autoral, Ambitious, Blank, Bohdan, Paper-Mono), `generateCopy.ts`, `imageSearch.ts`, `exportCarousel.ts` (PNG/PDF/ZIP), `publishCarousel.ts` (Late), `storage.ts` (Supabase + sessionStorage), `SlideEditor.tsx`, `SavedCarouselsSidebar.tsx`, `OffscreenSlideRenderer.tsx`, `CarouselFullPreview.tsx`, `TemplatePicker.tsx`. Já portado das libs do `code/sequencia-viral/lib/`.
- `src/components/kai/viral-radar/` — `niches.ts`, `sources-curated.ts` (portados de `code/radar-viral/lib/`).

API handlers (em `api/_handlers/`) já existiam e foram preservados:
- `generate-viral-carousel.ts` · `publish-viral-carousel.ts` · `adapt-viral-reel.ts` · `generate-radar-brief.ts`
- `extract-instagram.ts` · `extract-youtube.ts` · `youtube-search.ts`
- `cron-scrape-news.ts` · `cron-scrape-tiktok.ts` · `cron-scrape-instagram.ts` · `cron-generate-daily-brief.ts`

## Cobertura por app (% do app standalone que está no KAI)

### Sequência Viral · ~90% portado
- ✅ Briefing → geração single-shot (8 slides editoriais, copy + imagem)
- ✅ 8 templates visuais idênticos ao repo (Manifesto, Futurista, Twitter, Autoral, Ambitious, Blank, Bohdan, Paper-Mono)
- ✅ Edição por slide (texto + bold inline, swap imagem IA/Search/Upload)
- ✅ Autosave em sessionStorage + persist Supabase (`viral_carousels`)
- ✅ Sidebar de rascunhos salvos
- ✅ Export PNG / PDF / ZIP
- ✅ Mandar pro Planejamento (cria `planning_items`)
- ✅ Publicar via Late (`publish-viral-carousel`)
- ❌ Stripe paywall — REMOVIDO (KAI tem subscription via `BillingTab`)
- ❌ Onboarding multi-step da landing — não aplica (KAI tem onboarding próprio)
- ❌ Roadmap board / Plans page / Admin analytics — fora de escopo do tab
- ⚠️ Imagen 4 (Imagen 4.0) ainda chama `generate-image` handler que faz Gemini Imagen — paridade efetiva mas o tipo do prompt structured é mais simples que o do standalone

### Reels Viral · ~85% portado
- ✅ Cole link IG → Apify scrape → Gemini File API analysis
- ✅ Análise (porque viralizou + estrutura) + roteiro cena-a-cena + caption sugerida
- ✅ History sidebar por cliente
- ✅ Salvar como ideia / library
- ✅ Preview do reel original (thumbnail + meta)
- ✅ Pre-fill via query params `?url=` / `?tema=` (bridge com Radar)
- ❌ Quota paywall (Stripe) — não aplica
- ❌ Teleprompter visual (existe no standalone) — texto estruturado por enquanto
- ❌ Auth dialog / device fingerprint — KAI tem auth próprio

### Radar Viral · ~75% portado
- ✅ Briefing on-demand (`generate-radar-brief`) cruzando notícias + YT + posts próprios
- ✅ Narrativas dominantes · Hot topics · Carousel ideas · Cross-pollination
- ✅ History sidebar de briefings
- ✅ Bridge actions: virar carrossel (Sequência), virar reel, salvar como ideia
- ❌ Dashboard cards Top News / Top IG / Top YT (existem no standalone como `_components/top-*-section.tsx`) — KAI substitui pelo briefing consolidado
- ❌ Niche pill bar (multi-niche) — KAI usa o `client.industry` direto
- ❌ Saved page / Newsletters page / Settings de niche — fora de escopo
- ⚠️ Cron próprio populando news/IG/YT — KAI gera ao vivo via handler. Se quiser views read-only de feed, precisa rodar `cron-scrape-news` etc programado (handlers já existem em `api/_handlers/`).

## Mudanças nos pontos de entrada

### `src/pages/Kai.tsx`
- Import `ViralHunterTab` removido (substituído por comentário explicativo).
- 4 cases removidos: `"viral"`, `"sequence"`, `"reels"`, `"radar"`. 
- `legacyViralAlias` adicionado no useEffect de route protection: redireciona URLs antigas (`?tab=sequence` → `?tab=viral-carrossel` etc) — preserva bookmarks.
- Atalho ⌘J continua → `viral-carrossel`. ⌘I agora → `viral-radar-page` (era `viral` Hunter).

### `src/components/kai/KaiSidebar.tsx`
- Imports: `Flame` removido (era ícone do Hunter).
- Bloco "grupo Cliente" com 4 NavItems duplicados removido — substituído por comentário documentando a consolidação.
- Sidebar agora tem **um único grupo "Viral"** com 4 itens: Biblioteca Viral, Carrossel, Reels, Radar.

### `src/components/kai/MobileBottomNav.tsx`
- Item "Viral Hunter" do dropdown "Mais" removido.
- Import `Flame` removido.

### `src/components/kai/ViralRadarTab.tsx`
- `handleUseAsCarousel` agora usa `tab=viral-carrossel` (era `tab=sequence`).
- `handleUseAsReel` agora usa `tab=viral-reels-page` (era `tab=reels`).
- Mensagem de empty state não menciona mais "Viral Hunter" (que não existe mais).

## Estrutura final do menu Viral

```
Sidebar:
  ─── Viral ───
  · Biblioteca Viral          → tab=viral-library
  · Carrossel                 → tab=viral-carrossel  (Sequência Viral)
  · Reels                     → tab=viral-reels-page (Reels Viral)
  · Radar                     → tab=viral-radar-page (Radar Viral)
```

Sem mais duplicação. Sem Hunter v1.

## Convenções respeitadas

- React 18 + TS + Tailwind + Shadcn (KAI stack) — todos os componentes mantidos.
- `import { supabase } from "@/integrations/supabase/client"` — DB.
- `import { apiInvoke } from "@/lib/apiInvoke"` — chamar `/api/X` (handlers em `api/_handlers/`).
- `import { useAuth } from "@/hooks/useAuth"` — user.
- `import { useClients }` + `client.id` por tab — multi-cliente.
- Não tocou `code/sequencia-viral/`, `code/reels-viral/`, `code/radar-viral/` (read-only).
- Não tocou `api/_handlers/*` (backend já migrado).
- Sem commits — Gabriel revisa.

## Validação

```
✓ bunx tsc --noEmit -p tsconfig.app.json   # 0 erros
✓ bun run build                             # 13.03s, todos chunks gerados
✓ ViralSequenceTab-CPn_0KYR.js              # 105 KB (gzip 27 KB)
✓ ViralReelsTab-CEqbz4zL.js                 # 13 KB (gzip 4 KB)
✓ ViralRadarTab-DzAeAl2D.js                 # 9.6 KB (gzip 3 KB)
```

## Critério pronto — checklist

- [x] `ViralHunterTab.tsx` removido (movido pra `_legacy/`)
- [x] `viral-hunter/` folder removido (movido pra `_legacy/`)
- [x] 3 placeholders `.deprecated` deletados
- [x] `ViralSequenceTab` / `ViralReelsTab` / `ViralRadarTab` mantidos como source of truth (já eram ports atuais — VIRAL-PORTED documenta)
- [x] `Kai.tsx` ajustado (cases legacy removidos + alias redirect + atalho ⌘I)
- [x] `KaiSidebar.tsx` cleaned (grupo Cliente removido)
- [x] `MobileBottomNav.tsx` cleaned (Hunter removido)
- [x] `ViralRadarTab.tsx` URLs internas atualizadas pros novos nomes
- [x] `bun run build` passa
- [x] TypeScript clean
- [x] Sem commits
- [x] Doc `VIRAL-REPLACED.md` (este arquivo) com cobertura por app

## Bloqueios técnicos / TODOs futuros

- **Sequência Viral · Imagen 4**: standalone usa `imagen-4.0-generate-001` direto. KAI usa `generate-image` handler que faz Imagen via Gemini. Funcional mas o prompt structured (style guide injection coerência inter-slide) é simplificado — pra paridade total, portar `lib/server/image-strategy.ts` do `code/sequencia-viral/lib/server/`.
- **Reels Viral · teleprompter**: standalone tem `components/teleprompter.tsx` (UI scrolling). KAI mostra script como texto estruturado. Baixo valor pra integração, mas portável se Gabriel quiser.
- **Radar Viral · feed read-only**: standalone tem páginas separadas `/app/news`, `/app/youtube`, `/app/instagram` populadas pelo cron. KAI substitui pelo briefing consolidado. Se quiser as views read-only, dá pra adicionar tabs internos no `ViralRadarTab` consumindo as tabelas `viral_news_articles`, `viral_youtube_videos`, `viral_tiktok_posts` que JÁ existem no schema (e o cron já roda em `api/_handlers/cron-*`).
- **Multi-niche**: standalone Radar tem niche pill bar (acompanhar múltiplos nichos). KAI usa `client.industry` direto. Se quiser multi-niche por cliente, adicionar campo `niches: string[]` no client e adapter no handler.

## Reverter / rollback

Se algo quebrar em produção:
1. `_legacy/viral-replaced-2026-05-08/ViralHunterTab.tsx` → `src/components/kai/ViralHunterTab.tsx`
2. `_legacy/viral-replaced-2026-05-08/viral-hunter/` → `src/components/kai/viral-hunter/`
3. Restaurar imports em `Kai.tsx` (`const ViralHunterTab = lazy(...)` + cases `viral`/`sequence`/`reels`/`radar`)
4. Restaurar grupo "Cliente" em `KaiSidebar.tsx` (4 NavItems com Flame, Twitter, Film, Radar)
5. Restaurar item `{ tab: "viral", ... }` no `MORE_ITEMS` do `MobileBottomNav.tsx`
