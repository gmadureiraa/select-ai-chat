# Sequência Viral v2 — Port report

**Path:** `src/components/kai/viral-sequence-v2/`
**Entry:** `viral-sequence-v2/index.tsx` → default export `ViralSequenceV2({ clientId, client })`
**Total LOC:** 8.569 (27 arquivos)
**Branch:** `combo-viral-integration` (uncommitted)
**Build:** `bun run build` ✅ passa. `tsc --noEmit` 0 erros nos arquivos v2.

## Estrutura

```
viral-sequence-v2/
├── index.tsx                          # MainPanel (entry, orquestra tudo)
├── types.ts                           # ViralCarousel/Slide/Profile/Variant
├── templates/                         # 8 templates visuais (1080×1350)
│   ├── index.tsx                      # TemplateRenderer + TEMPLATES_META
│   ├── types.ts                       # SlideProps, TemplateId, TemplateMeta
│   ├── utils.ts                       # renderRichText, resolveImgSrc, isColorDark
│   ├── media-tag.tsx
│   ├── template-twitter.tsx           # Twitter v2 (default)
│   ├── template-manifesto.tsx
│   ├── template-futurista.tsx
│   ├── template-autoral.tsx
│   ├── template-ambitious.tsx
│   ├── template-blank.tsx
│   ├── template-bohdan.tsx
│   └── template-paper-mono.tsx
├── components/
│   ├── BriefingPanel.tsx              # Form: briefing + tom + língua + slide count + atalhos
│   ├── SlideEditor.tsx                # Edita 1 slide (heading+body, image, layers)
│   ├── SlideRenderer.tsx              # Adapter ViralSlide → SlideProps do template
│   ├── TemplatePicker.tsx             # Picker (compact + large)
│   ├── CarouselFullPreview.tsx        # Modal full-screen com nav ← →
│   ├── OffscreenSlideRenderer.tsx     # Renderiza scale=1 fora da tela pra captura
│   └── SavedCarouselsSidebar.tsx      # Lista carrosséis salvos do cliente
├── hooks/
│   ├── useGenerateCarousel.ts         # POST /api/generate-viral-carousel
│   ├── useAutoImages.ts               # Gemini → keywords → Pexels (batch)
│   └── useSavedCarousels.ts           # TanStack Query: list + delete
└── lib/
    ├── storage.ts                     # sessionStorage draft + Supabase persist
    ├── imageSearch.ts                 # POST /api/image-search (Pexels)
    └── exportCarousel.ts              # ZIP / PNG / PDF (html-to-image + jszip + jspdf)
```

## Features portadas (% do standalone)

### Cobertas (~85% do core do standalone)

- ✅ Briefing form completo (textarea + tom + língua + slide count + 4 atalhos clicáveis)
- ✅ Geração de slides via Gemini Flash (`/api/generate-viral-carousel`)
- ✅ 8 templates visuais (1080×1350) com `TemplateRenderer` polimórfico
- ✅ TemplatePicker em 2 modos: compact (chips horizontais) + large (grid 4 col)
- ✅ Edição por slide: heading + body separados, contadores 80/280, layers (title/body/bg)
- ✅ Imagem por slide: IA (`/api/generate-content-v2` Nano Banana), Buscar (Pexels), Upload, Sem-imagem
- ✅ Auto-imagens: gera 2-4 keywords inglês via Gemini Flash → Pexels batch (CTA pulado, dedup URL)
- ✅ Preview por slide (1080×1350 escalado) + preview full-screen com navegação ← →
- ✅ Atalho "P" abre/fecha preview full-screen
- ✅ Export: ZIP (recomendado), PNGs separados, PDF, JSON
- ✅ Persistência: sessionStorage draft (autosave) + Supabase `viral_carousels` (save/load/delete)
- ✅ Sidebar com carrosséis salvos do cliente, AlertDialog confirm pra delete
- ✅ "Mandar pro Planejamento": cria `planning_items` linkado em coluna `draft`/`idea`
- ✅ Pré-popula briefing vindo do Viral Hunter (`?seedBriefing=&seedTitle=`)
- ✅ Carrega carrossel salvo via `?carouselId=` na URL
- ✅ Reset entre clientes
- ✅ Empty state com 3 passos visuais

### Omitidas (deliberadamente — não aplicáveis ao KAI)

- ❌ Stripe paywall + plan limits + DiscountPopup (KAI tem subscription model próprio)
- ❌ Onboarding/Login/Account/Help/Plans pages (KAI tem auth próprio via Stack/Neon Auth)
- ❌ Dashboard estilo "editorial brutalist" do `app/page.tsx` (vira responsabilidade da home KAI)
- ❌ Landing page + Roadmap board + Blog (não fazem parte do tab dentro do KAI)
- ❌ "Zernio" — produto separado do SV (calendário próprio + autopilot + connected)
- ❌ Admin pages (`admin/`, `admin/zernio/`, `admin/feedback/`, `admin/regras/`, `admin/users/`)
- ❌ Referrals + Coupons + Feedback modal pública
- ❌ Variations 3-em-1 do `/api/generate` Pro (3 ângulos: data/story/provocative)
  - Standalone tem fluxo `/concepts` → 3 variations → user escolhe → `/templates` → `/edit` → `/preview`.
  - V2 simplifica em 1 variação direto pro grid de slides — fluxo "single-shot" mais alinhado ao MVP do KAI.
  - Pode ser estendido depois adicionando step "variations" entre BriefingPanel e SlideEditor.
- ❌ `<source-link>` extraction (YouTube transcript / Instagram post / blog scraping) — handler `extract-instagram` existe no KAI mas não está cabeada no v2 ainda. Hooks ficaram preparados pra plugar (passar `sourceType` + `sourceUrl` no body do `useGenerateCarousel`).
- ❌ Template "Madureira" (#9 do standalone): não está na lista do legacy `viral-sequence/templates/` então deixei fora pra preservar set de 8.
- ❌ Publicar direto no Instagram via Late/LATE (nada implementado no v2 — usa export → publica manualmente)

### Comportamentos novos vs standalone

- ✨ Layers toggle (title/body/bg) por slide — não existia no standalone, vem do `lib/create/types.ts`
- ✨ Heurística automática heading vs body com `**bold**` no início — preserva tipografia editorial mesmo se a IA retornar só body

## Conversões Next 16 → Vite + React 18 aplicadas

- `"use client"` removido em todos os arquivos
- `next/navigation useRouter` → `react-router-dom useNavigate`
- `next/navigation useSearchParams` → `react-router-dom useSearchParams`
- `next/image` → `<img>` simples
- `next/link` → não usado (não tinha link inter-page no fluxo)
- API routes `/api/generate` standalone → `/api/generate-viral-carousel` handler KAI (via `apiInvoke`)
- API routes `/api/images/search` → `/api/image-search` handler KAI
- Auth: `useAuth()` do `@/lib/auth-context` standalone → não preciso (componente recebe `clientId` + `client` como prop, o tab pai já validou auth)
- DB direto: `@neondatabase/serverless` → `supabase.from("viral_carousels")` (Supabase aponta pra Neon Data API no KAI)

## Paths NOVOS criados (não toquei em legacy)

- `src/components/kai/viral-sequence-v2/**` (27 arquivos novos)
- `VIRAL-SEQUENCE-V2.md` (este doc)

## NÃO toquei (per spec)

- `src/components/kai/ViralSequenceTab.tsx` (agente paralelo)
- `src/components/kai/viral-sequence/**` (legado, preservado intacto)
- `code/sequencia-viral/**` (read-only)
- `api/**` (handlers já prontos)
- Sem commits

## Como wirear

Pra usar, basta importar e renderizar passando `clientId` + `client`:

```tsx
import ViralSequenceV2 from "@/components/kai/viral-sequence-v2";
// ...
<ViralSequenceV2 clientId={client.id} client={client} />
```

A pasta é completamente autosuficiente — não importa do legacy `viral-sequence/`.
Pode rodar lado-a-lado com o ViralSequenceTab atual sem conflito de chaves de
storage (`kai-viral-sequence-v2-draft` vs `kai-viral-sequence-draft`).

## Bloqueios

- Nenhum bloqueio crítico. v2 compila e roda standalone.
- Wiring no Tab/Sidebar fica a cargo do agente REPLACE-VIRAL ou do Gabriel — basta
  trocar o componente renderizado em `KaiSidebar` quando o tab "viral_sequence" estiver ativo.
- O handler `generate-viral-carousel` retorna SÓ `body` (sem heading separado).
  v2 faz split heurístico via `**bold**` no início, mas idealmente o handler poderia
  retornar `{ heading, body }` separados. Funciona OK como está, é cosmético.
