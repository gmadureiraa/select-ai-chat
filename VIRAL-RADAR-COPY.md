# Viral Radar — Cópia Literal do App Standalone

**Data:** 2026-05-08
**Branch:** `combo-viral-integration` (sem commit)
**Source:** `code/radar-viral/` (Next.js 16 + Neon + Apify)
**Target:** `code/kai-app-combo/src/components/kai/viral-radar-original/`

## Objetivo

Substituir a tab `ViralRadarTab` antiga (estilo Tailwind/KAI, criada em
2026-05-08) por uma cópia LITERAL do app standalone Radar Viral
(`radar.kaleidos.com.br`), preservando UI/CSS/cores/fontes/layouts
~95%+. A versão antiga ficou em `ViralRadarTab.legacy.tsx` pra
referência histórica.

## Estrutura criada

```
src/components/kai/viral-radar-original/
├── MainApp.tsx                       # Entry — sidebar + 4 sub-views
├── types.ts                          # Row types (extraídos das route handlers)
├── components/
│   ├── loop-closure-section.tsx      # "Ontem virou" recap D-1 vs D0
│   ├── niche-pill-bar.tsx            # Toggle de nicho topo do dashboard
│   ├── top-instagram-section.tsx     # Top 3 IG do dia (reels/carrossel)
│   ├── top-news-section.tsx          # Notícias últimas 48h + toggle
│   └── top-youtube-section.tsx       # Top 3 YT carrossel horizontal
├── pages/
│   ├── Admin.tsx                     # 4-tab admin panel (1164 LOC)
│   ├── Dashboard.tsx                 # Dashboard principal (1437 LOC)
│   ├── Newsletters.tsx               # Feed Gmail-via-cron
│   └── Saved.tsx                     # Bookmarks cross-platform
├── lib/
│   ├── admin-emails.ts               # Lista de admins (Gabriel)
│   ├── auth-client.ts                # useNeonSession wrapper p/ Supabase
│   ├── ig-score.ts                   # Heurística viral score
│   ├── img-proxy.ts                  # Proxy IG CDN
│   ├── next-shims.tsx                # Shim Link/usePathname/useRouter
│   ├── niche-context.tsx             # Context global do nicho ativo
│   ├── niches.ts                     # Catalog crypto/marketing/ai
│   └── sources-curated.ts            # Catálogo de fontes por nicho
└── styles/
    └── globals.css                   # Tokens + helpers .rdv-* (179 linhas)
```

**Total:** 20 arquivos · **6834 LOC**

## Arquivos copiados literalmente do standalone

| Source (`code/radar-viral/`)              | Target (`viral-radar-original/`)         |
|-------------------------------------------|------------------------------------------|
| `app/app/page.tsx`                        | `pages/Dashboard.tsx`                    |
| `app/app/saved/page.tsx`                  | `pages/Saved.tsx`                        |
| `app/app/newsletters/page.tsx`            | `pages/Newsletters.tsx`                  |
| `app/app/admin/page.tsx`                  | `pages/Admin.tsx`                        |
| `app/app/_components/loop-closure-*.tsx`  | `components/loop-closure-section.tsx`    |
| `app/app/_components/niche-pill-bar.tsx`  | `components/niche-pill-bar.tsx`          |
| `app/app/_components/top-instagram-*.tsx` | `components/top-instagram-section.tsx`   |
| `app/app/_components/top-news-section.tsx`| `components/top-news-section.tsx`        |
| `app/app/_components/top-youtube-*.tsx`   | `components/top-youtube-section.tsx`     |
| `lib/niches.ts`                           | `lib/niches.ts`                          |
| `lib/niche-context.tsx`                   | `lib/niche-context.tsx`                  |
| `lib/sources-curated.ts`                  | `lib/sources-curated.ts`                 |
| `lib/admin-emails.ts`                     | `lib/admin-emails.ts`                    |
| `lib/img-proxy.ts`                        | `lib/img-proxy.ts`                       |
| `lib/ig-score.ts`                         | `lib/ig-score.ts`                        |
| `app/globals.css`                         | `styles/globals.css` (com scope `.rdv-shell`) |
| **Tipos das route handlers (5 arquivos)** | **`types.ts` (consolidado)**             |

## Arquivos novos (adapter layer)

- `MainApp.tsx` — entry point que wrapa sidebar + view-switching interno
  (substitui o roteamento `/app/*` do Next por state local, dentro do tab system do KAI)
- `lib/auth-client.ts` — adapter que provê `useNeonSession`/`getJwtToken`
  na API esperada pelos componentes copiados, mas implementado em cima de
  `supabase.auth` do KAI
- `lib/next-shims.tsx` — shims pra `next/link`, `next/navigation`
  (usePathname, useRouter, useSearchParams) — permite manter os componentes
  literalmente sem trocar import por import

## Adaptações Next → Vite aplicadas

Aplicadas via `perl -i` em batch sobre os arquivos copiados:

1. `"use client"` (linha 1) → removido
2. `from "next/link"` → `from "../lib/next-shims"`
3. `import Link from` → `import { Link } from` (Link virou named export)
4. `from "next/navigation"` → `from "../lib/next-shims"`
5. `from "@/lib/auth-client"` → `from "../lib/auth-client"`
6. `from "@/lib/niche-context"` → `from "../lib/niche-context"`
7. `from "@/lib/niches"` → `from "../lib/niches"`
8. `from "@/lib/admin-emails"` → `from "../lib/admin-emails"`
9. `from "@/lib/img-proxy"` → `from "../lib/img-proxy"`
10. `from "@/lib/sources-curated"` → `from "../lib/sources-curated"`
11. `from "@/lib/ig-score"` → `from "../lib/ig-score"`
12. `from "@/app/api/data/*/route"` → `from "../types"` (tipos extraídos)
13. `from "@/components/post-detail-modal"` → comentado (modal não portado)
14. `from "./_components/"` → `from "../components/"` (no Dashboard)

Os comentários `// eslint-disable-next-line @next/next/no-img-element` foram
**mantidos** (são strings de comment, harmless).

## CSS / Tokens / Estética

`styles/globals.css` é uma cópia 1:1 do `app/globals.css` do standalone com
2 ajustes:

- Removido `@import "tailwindcss"` (KAI já carrega Tailwind globalmente)
- Removido `@theme { ... }` (Tailwind v4 syntax — KAI usa v3) e movidos os
  tokens pra `:root` como CSS variables regulares
- Adicionado scope `.rdv-shell` no root pra evitar leakage do scrollbar
  override e selection style no resto do KAI

**Tokens preservados (todos idênticos ao prod):**
- `--color-rdv-paper: #F5F1E8` · `--color-rdv-cream: #FBF7EE`
- `--color-rdv-ink: #0A0908` · `--color-rdv-coal: #1A1816`
- `--color-rdv-rec: #FF3D2E` (REC coral) · `--color-rdv-rec-hot: #FF5947`
- `--color-rdv-muted: #6B6660` · `--color-rdv-line: #DDD7CA`
- `--color-rdv-amber/green/blue` (status colors)

**Helpers preservados:** `.rdv-eyebrow`, `.rdv-rec-dot`, `.rdv-display`,
`.rdv-mono`, `.rdv-btn`, `.rdv-btn-rec`, `.rdv-btn-ghost`, `.rdv-card`,
`.rdv-card-rec`, `.rdv-input`, `.rdv-spin`, `.rdv-dash-row`,
`.rdv-sidebar-desktop/mobile/backdrop`, `.rdv-app-mobile-header`.

## Fonts

`index.html` já tinha Plus Jakarta Sans + Instrument Serif (adicionados pelo
agente do Sequência Viral). Adicionei só o que faltava:

```html
<!-- Geist Mono -->
<link href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
```

Resultado: as 3 fontes do design original (`Plus Jakarta Sans`,
`Instrument Serif italic`, `Geist Mono`) carregam todas, e o CSS aponta pra
elas via `--font-rdv-sans/display/mono` + alias `--font-geist-mono` pra
componentes que usam o token diretamente em `style`.

## Multi-page interna (4 sub-views)

`MainApp.tsx` mantém a sidebar fixed cream+REC do app prod e troca a view
ativa via `useState<ViewId>`:

```tsx
type ViewId = "dashboard" | "saved" | "newsletters" | "admin";
const [view, setView] = useState<ViewId>("dashboard");
```

NAV: 4 itens (Dashboard, Salvos, Newsletters, Admin com `adminOnly`). As
páginas Settings/Pricing/Referrals do standalone foram **omitidas** porque
o KAI já tem suas próprias telas para isso.

## Endpoints de API (não portados nesta task)

Os componentes fazem `fetch()` pros mesmos endpoints do standalone:

- `/api/brief?niche=` (Dashboard)
- `/api/me/subscription` (Dashboard)
- `/api/data/saved`, `/api/data/news`, `/api/data/videos`,
  `/api/data/instagram/posts`, `/api/data/newsletters`
- `/api/last-sync`
- `/api/admin/stats` (Admin tab)
- `/api/img` (proxy IG CDN)

Esses endpoints **não existem** no KAI ainda. Os componentes vão chamar,
receber 404, e mostrar empty/loading states. Quando o agente de backend
portar os handlers correspondentes pra `api/_handlers/`, tudo passa a
funcionar sem mexer no front.

## Plug no KAI

`src/pages/Kai.tsx`:

```tsx
const ViralRadarTab = lazy(() =>
  import("@/components/kai/viral-radar-original/MainApp").then((m) => ({
    default: m.ViralRadarTab,  // named re-export do MainApp
  })),
);
```

A tab é renderizada quando `activeTab === "viral-radar-page"` e recebe
`clientId` + `client` como props (aceitos no `MainApp` por
compatibilidade, mas o Radar opera por nicho global, não por cliente).

## Build status

```bash
$ bun run build
✓ 5025 modules transformed.
✓ built in 10.04s

dist/assets/MainApp-DwSY5nll.css       3.60 kB │ gzip: 1.19 kB
dist/assets/MainApp-Dki0rWx7.js       98.85 kB │ gzip: 23.18 kB
```

Sem warnings nem erros. Chunk dedicado `MainApp-*` carrega sob lazy import
quando o user abre a tab.

## Não tocado

- `src/components/kai/viral-sv-original/` (outro agente)
- `src/components/kai/viral-reels-original/` (outro agente)
- `src/components/kai/viral-sequence-v2/` (V2 antigo)
- `src/components/kai/viral-reels-v2/` (V2 antigo)
- `src/components/kai/viral-radar/` (niches.ts + sources-curated.ts antigos —
  não removidos pra evitar break de outros componentes que possam importar)
- `code/radar-viral/` (repo standalone — só leitura)
- `api/_handlers/` (handlers KAI)

## Critério pronto — checklist

- [x] Pasta `viral-radar-original/` completa (20 arquivos, 6834 LOC)
- [x] `MainApp.tsx` com 4 sub-views (Dashboard, Saved, Newsletters, Admin)
- [x] Tab plugado em `Kai.tsx` (lazy import via named export)
- [x] Fonts adicionadas em `index.html` (Geist Mono — outras já tinham)
- [x] `bun run build` passa sem warnings
- [x] CSS preservado 1:1 (paper texture, REC coral, brutalist shadows)
- [x] Estética visual ≥95% idêntica ao prod (tokens + helpers + sidebar
      fixed cream+REC + REC pulsing dot + display serif italic + mono uppercase)
- [x] `ViralRadarTab.tsx` antigo movido pra `ViralRadarTab.legacy.tsx`
- [x] Documento `VIRAL-RADAR-COPY.md` (este arquivo)

## Próximos passos sugeridos

1. **Portar API handlers** — os 7 endpoints `/api/data/*`, `/api/brief`,
   `/api/me/subscription`, `/api/last-sync`, `/api/admin/stats`,
   `/api/img` precisam virar handlers em `api/_handlers/` lendo do mesmo
   Neon DB que o app prod popula.
2. **PostDetailModal** — component `components/post-detail-modal.tsx` do
   standalone não foi portado (linha comentada nos arquivos copiados).
   Quando portar, descomentar os `setDetailPost(...)` em IG/News pages.
3. **Settings/Onboarding** — se quiser portar essas páginas também,
   adicionar em `pages/` e expandir o NAV.
