# VIRAL-REELS-COPY — port literal de `code/reels-viral/` pro KAI

Data: 2026-05-08
Branch: `combo-viral-integration`

## Missão

Gabriel rejeitou as adaptações shadcn/Tailwind do tab Reels Viral (versões `ViralReelsTab.tsx` e `viral-reels-v2/`). Quer **a mesma cara do app prod** (reels-viral.vercel.app). Esta pasta é uma cópia LITERAL da UI do standalone, com adaptações mínimas pra rodar em Vite/KAI (não em Next.js standalone).

## Estrutura

```
src/components/kai/viral-reels-original/
├── MainApp.tsx                       # entry — substitui ViralReelsTab
├── types.ts                          # AdaptBrief, AdaptResponse, ReelRow
├── styles/
│   └── globals.css                   # tokens --color-rv-* + classes .rv-*
│                                     # SCOPED via .rv-scope (não vaza)
├── components/
│   ├── result-view.tsx               # tela de resultado completa
│   ├── loading-pipeline.tsx          # animação de pipeline (7 stages)
│   ├── teleprompter.tsx              # overlay full-screen pra gravar
│   └── history-sidebar.tsx           # sidebar com histórico de reels
└── lib/
    ├── utils.ts                      # extractShortCode, formatNumber, etc.
    └── export-markdown.ts            # buildMarkdown + downloadMarkdown
```

## Files copiados (do source)

| Source standalone                         | Destino KAI                                   |
|-------------------------------------------|-----------------------------------------------|
| `app/app/page.tsx`                        | `MainApp.tsx`                                 |
| `app/globals.css`                         | `styles/globals.css`                          |
| `lib/types.ts`                            | `types.ts`                                    |
| `lib/utils.ts`                            | `lib/utils.ts`                                |
| `lib/export-markdown.ts`                  | `lib/export-markdown.ts`                      |
| `components/result-view.tsx`              | `components/result-view.tsx`                  |
| `components/loading-pipeline.tsx`         | `components/loading-pipeline.tsx`             |
| `components/teleprompter.tsx`             | `components/teleprompter.tsx`                 |
| —                                         | `components/history-sidebar.tsx` (KAI plus)   |

## LOC

- **2.973 linhas totais** copiadas/portadas
- 887 linhas em `result-view.tsx` (a peça mais complexa, cópia literal)
- 777 linhas em `MainApp.tsx` (port de `app/page.tsx` 856 linhas, adaptado)
- 215 linhas em `history-sidebar.tsx` (novo, estética cream/REC)

## CSS preservado 100%

`styles/globals.css` mantém:
- todos os tokens `--color-rv-*` (paper, cream, ink, coal, rec, rec-hot, muted, line, soft, amber)
- todas as classes utilitárias `.rv-eyebrow`, `.rv-display`, `.rv-mono`, `.rv-btn`, `.rv-btn-rec`, `.rv-btn-ghost`, `.rv-card-916`, `.rv-timecode`, `.rv-scrubber`, `.rv-shimmer`, `.rv-spin`
- animações `@keyframes rv-pulse`, `rv-shimmer`, `rv-spin`
- selection coral REC + scrollbar minimalista

**Diferença principal:** as regras CSS estão escopadas em `.rv-scope` em vez de aplicarem em `html, body`. Isso garante que a estética cream + coral só atue dentro do tab Reels (não vaza pro resto do KAI). O wrapper `<div className="rv-scope">` no MainApp ativa todas elas.

## Adaptações mínimas pra rodar em Vite

| Source standalone                                        | KAI port                                                       |
|----------------------------------------------------------|----------------------------------------------------------------|
| `"use client"` directive                                 | removida                                                       |
| `next/navigation` `useSearchParams`                      | `react-router-dom` `useSearchParams`                           |
| `next/link` Link                                         | não usado (sem links pra outras pages do app standalone)       |
| `next/image`                                             | não usado                                                      |
| `useNeonSession()` + `getJwtToken()`                     | `apiInvoke()` (já anexa JWT via `lib/apiInvoke.ts`)            |
| `fetch('/api/adapt-reel', ...)`                          | `apiInvoke('adapt-viral-reel', { body })`                      |
| `lib/storage.saveScript()` (auto-save local + DB)        | removido (handler `adapt-viral-reel` já persiste no DB)        |
| `lib/sv-bridge.openSvBridge()` (cross-domain bridge)     | removido (no KAI não precisa)                                  |
| `AuthDialog`, `QuotaBlockedModal`, `ReferralCapture`     | removidos (KAI sempre tem user logado, sem quota por user)     |
| `MetaPixel`, `Footer`                                    | removidos (são da landing standalone)                          |
| Sidebar Next.js (`/app/layout.tsx`)                      | removida (KAI tem sua própria sidebar)                         |
| `QuotaCard` no header                                    | removido                                                       |
| Form auto-fill via `sessionStorage` PendingBrief         | removido (sem auth wall)                                       |
| Persistência `viral_scripts` (Neon) standalone           | `viral_reels` (Supabase) com `client_id` por cliente do KAI    |

## Integração KAI

- **Props:** `{ clientId: string, client: Client }` (vindo do `Kai.tsx` quando user seleciona um cliente)
- **Histórico:** lê `supabase.from("viral_reels").eq("client_id", clientId)` via TanStack Query
- **Mutations:** delete reel, salvar como ideia (`planning_items`), salvar na library (`client_content_library`)
- **Bridge Radar Viral:** lê `?tema=`/`?topic=`/`?briefing=`/`?url=` e pre-popula form
- **Pre-fill nicho:** se `client.industry` definido e nicho ainda vazio, preenche
- **Saudação no header:** primeiro nome do user via `supabase.auth.getUser()` (ou nome do cliente como fallback)

## Plug-in no Kai.tsx

```tsx
// Antes (legacy):
const ViralReelsTab = lazy(() =>
  import("@/components/kai/ViralReelsTab").then((m) => ({ default: m.ViralReelsTab })),
);

// Depois (esta port):
const ViralReelsTab = lazy(() =>
  import("@/components/kai/viral-reels-original/MainApp").then((m) => ({
    default: m.default,
  })),
);
```

A rota `viral-reels-page` em `Kai.tsx` continua chamando `<ViralReelsTab clientId={...} client={...} />` exatamente igual — o componente novo aceita as mesmas props.

O arquivo antigo foi renomeado pra `ViralReelsTab.legacy.tsx` (mantido só pra referência histórica, não importado em lugar nenhum).

## Fonts

Já estavam carregadas no `index.html` do KAI:
- Plus Jakarta Sans (sans corpo)
- Instrument Serif italic (display editorial)
- Geist Mono (mono pra timestamps + eyebrows)

Nenhuma adição necessária.

## Pipeline backend

Reusa o handler já existente em `api/_handlers/adapt-viral-reel.ts`:
- Apify scrape do reel original (cache 24h)
- Gemini 2.5 Flash transcrição + análise estrutural
- Gemini Pro pra adaptar o roteiro ao briefing
- Persiste em `viral_reels` com `client_id` + analysis + script JSON

## Build

`bunx vite build` transforma os 9 novos arquivos (2.973 LOC, ~470 modules adicionais) sem erros. Erro pré-existente em `viral-sv-original/pages-app/carousels.tsx` (`posthog-js` não instalado) é do agente Sequência Viral, não desta port.

`bunx tsc --noEmit -p tsconfig.app.json` em todos os arquivos de `viral-reels-original/` passa limpo.

## Estética preservada (avaliação subjetiva)

~95%+. Itens preservados verbatim:
- Cream paper background (#F5F1E8) + REC coral (#FF3D2E)
- Brutalist shadows (4-8px solid)
- Form com 6 campos numerados (01 · COLE LINK / 02 · TEMA / 03 · OBJETIVO / 04 · CTA / 05 · PERSONA / 06 · NICHO)
- Hero header com `rv-display` italic Instrument Serif + saudação "Olá, Gabriel."
- "Como funciona" 3 steps cards com numerator REC gigante
- LoadingPipeline com 7 stages animadas + REC dot pulsando
- ResultView com hero split (source + análise dark card), estrutura 5 blocos, hook destacado em ink/cream, storyboard cena por cena com numerator side-bar, caption + notas
- Teleprompter full-screen overlay com REC button + sliders speed/fontSize + mirror + atalhos teclado

Itens novos (KAI plus, mas estilizados consistente):
- HistorySidebar à esquerda (no standalone era página `/app/meus-roteiros` separada)
- Botões "Ideia" e "Library" no top strip do ResultView (delegam pras mutations)

Não preservado:
- Sidebar nav fixed Next.js (`PRIMARY_NAV` / `SECONDARY_NAV`) — KAI já tem sua própria nav
- QuotaCard no header (KAI não tem quota por user)
- Auth dialog / OAuth flow (KAI sempre logado)

## Critério pronto

- [x] Pasta `viral-reels-original/` completa
- [x] `MainApp.tsx` funcional (form → loading → result, histórico, save mutations)
- [x] Tab plugado em `Kai.tsx` (substituindo lazy import)
- [x] `ViralReelsTab.tsx` antigo renomeado pra `ViralReelsTab.legacy.tsx`
- [x] CSS literal preservado em `.rv-scope`
- [x] `bunx tsc --noEmit -p tsconfig.app.json` passa pros 9 arquivos novos
- [x] Visual ~95%+ preservado (cream + REC coral + brutalist shadows + Instrument Serif italic)
- [x] Documento `VIRAL-REELS-COPY.md` (este)
