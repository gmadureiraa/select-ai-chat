# VIRAL-SV-COPY · Cópia Literal do Sequência Viral standalone

**Data:** 2026-05-08
**Branch:** `combo-viral-integration`
**Source repo:** `/Users/gabrielmadureira/GOS/code/sequencia-viral` (Next.js 16, prod em `viral.kaleidos.com.br`)
**Destino:** `src/components/kai/viral-sv-original/`

---

## Objetivo

Substituir a aba `ViralSequenceTab` do KAI por uma cópia LITERAL da UI
do app standalone, preservando ~95%+ da estética: paper textures,
fontes Atelier/Gridlite/Inter custom + Plus Jakarta + Instrument Serif
italic + JetBrains Mono, cores REC coral `#FF3D2E`, brutalist
shadows e tokens `--sv-*` originais.

A versão antiga (estilo Tailwind do KAI) ficou em
`src/components/kai/ViralSequenceTab.legacy.tsx` pra referência histórica.

---

## Estrutura final

```
src/components/kai/viral-sv-original/
├── MainApp.tsx                # entry — registrado em Kai.tsx como ViralSequenceTab
├── styles/
│   └── globals.css            # 1279 linhas — paper textures, @font-face local, tokens
├── pages-app/                 # pages do Next standalone (ex-`app/app/*`)
│   ├── dashboard.tsx          # ex-`app/page.tsx` (page principal autenticada)
│   ├── layout.tsx             # ex-`app/layout.tsx` (sidebar do SV — não usado pelo MainApp)
│   ├── carousels.tsx
│   ├── create-index.tsx
│   ├── create-new.tsx         # gerador principal (~1700 LOC)
│   ├── create-id/
│   │   ├── edit.tsx           # editor (~890 LOC)
│   │   ├── preview.tsx        # ~1330 LOC
│   │   ├── concepts.tsx
│   │   └── templates.tsx
│   ├── settings/page.tsx      # ~2900 LOC
│   ├── plans.tsx
│   ├── help.tsx
│   ├── login.tsx
│   ├── onboarding.tsx
│   └── roadmap.tsx
├── components/
│   ├── app/                   # 18 components do editor (template-*, image-picker, …)
│   │   ├── templates/         # 9 templates de slide (manifesto, futurista, twitter, …)
│   │   └── zernio/            # 4 components do scheduler (require-business, …)
│   ├── ui/sonner.tsx
│   ├── facebook-login-button.tsx
│   ├── ReferralCapture.tsx
│   └── MetaPixel.tsx
├── lib/
│   ├── auth-context.tsx       # AuthProvider (adaptado pra Neon Auth do KAI)
│   ├── supabase.ts            # bridge → re-exporta supabase do KAI
│   ├── stripe.ts              # stub (referrals/subscription são server)
│   ├── carousel-storage.ts
│   ├── carousel-templates.ts
│   ├── pricing.ts
│   ├── editorial-fonts.ts
│   ├── create/                # hooks do gerador (use-draft, use-images, etc)
│   ├── email/templates/       # 13 templates React-Email (server-only)
│   └── integrations/resend/
└── shims/                     # bridges Next → Vite
    ├── next-link.tsx          # next/link → react-router-dom Link (mas aqui não chama RR)
    ├── next-image.tsx         # next/image → <img> com fill suportado
    ├── next-navigation.ts     # useRouter + usePathname + useSearchParams + useParams (HASH ROUTING)
    ├── next-script.tsx
    ├── next-font-google.ts    # factory no-op (fontes vêm via <link> em index.html)
    ├── next.ts                # type Metadata
    ├── posthog-js.ts          # stub no-op (KAI tem analytics próprio)
    ├── posthog-node.ts
    ├── google-genai.ts        # server-only stub
    ├── react-email-components.tsx
    └── resend.ts
```

---

## Adaptações Next 16 → Vite (mecânicas)

| Next 16                                 | Vite (KAI integrado)                                         |
|-----------------------------------------|--------------------------------------------------------------|
| `'use client';` no topo                 | Removido (linhas vazias não-significativas)                  |
| `next/link Link`                        | Shim: `react-router-dom Link` com fallback pra hash + anchor |
| `next/image Image`                      | Shim: `<img>` com `fill` simulado via `position:absolute`    |
| `next/navigation useRouter()`           | Shim: navega via `window.location.hash`                      |
| `next/navigation usePathname()`         | Shim: deriva de `window.location.hash` (com prefixo `/app`)  |
| `next/navigation useSearchParams()`     | Shim: lê `window.location.search`                            |
| `next/navigation useParams()`           | Shim: extrai segmentos do hash atual                         |
| `next/font/google` (Plus_Jakarta, …)    | Factory no-op — fontes carregadas via `<link>` em `index.html` |
| `next/script Script`                    | Shim: cria `<script>` nativo no head                         |
| `params: Promise<{id}>` + `use(p)`      | Plain object `params: { id }` (Promise removida, `use()` removido) |
| `app/api/*` rotas server                | JÁ portado pra `api/_handlers/` (outro agente). `fetch('/api/X')` continua funcionando |
| Stripe SDK (server)                     | Stub null em `lib/stripe.ts`                                 |
| Resend SDK (server)                     | Shim em `shims/resend.ts`                                    |

### Aliases adicionados (`vite.config.ts` + `tsconfig.app.json`)

```ts
{ find: "@sv", replacement: ".../viral-sv-original" },
{ find: /^next\/link$/, replacement: ".../shims/next-link.tsx" },
{ find: /^next\/image$/, replacement: ".../shims/next-image.tsx" },
{ find: /^next\/navigation$/, replacement: ".../shims/next-navigation.ts" },
{ find: /^next\/font\/google$/, replacement: ".../shims/next-font-google.ts" },
{ find: /^next\/script$/, replacement: ".../shims/next-script.tsx" },
{ find: /^next$/, replacement: ".../shims/next.ts" },
{ find: /^posthog-js$/, ... },
{ find: /^posthog-node$/, ... },
{ find: /^@google\/genai$/, ... },
{ find: /^@react-email\/components$/, ... },
{ find: /^resend$/, ... },
```

### Imports rewriting

Todos os `from "@/lib/..."` e `from "@/components/..."` do código copiado
foram reescritos para `@sv/lib/...` e `@sv/components/...` (35 arquivos
afetados via script Python idempotente, em `/tmp/fix_imports.py`).

`@/integrations/supabase/client` continua apontando pro KAI (única ponte
fora do alias `@sv`).

---

## Mini hash-router (MainApp)

Como o `viral-sv-original` vive DENTRO do shell do KAI (que tem seu
próprio react-router top-level governando `/`, `/clients`, `/kai`),
navegar pelo react-router daqui conflitaria com a sidebar.

Solução: o `MainApp.tsx` mantém um state local que escuta
`window.location.hash` e renderiza a page certa:

```
#/                 → DashboardPage
#/carousels        → CarouselsPage
#/create/new       → CreateNewPage
#/create/<id>/edit → CreateIdEditPage  (params: { id })
#/settings         → SettingsPage
…
```

Os shims do `next/navigation` convertem `router.push("/app/carousels")`
em `window.location.hash = "/carousels"` automaticamente
(`stripAppPrefix`).

---

## Fontes carregadas

`index.html` foi extendido com `<link>` pra:

- Plus Jakarta Sans (300–800)
- Instrument Serif (regular + italic)
- JetBrains Mono (400–700)
- DM Serif Display, Playfair Display, Outfit, Source Sans 3, Literata
  (família editorial pro picker do editor)
- Geist Mono (já tinha pelo Radar)

`@font-face` locais (Atelier.ttf, Gridlite.otf, Inter.ttf) foram
copiadas pra `public/fonts/` — paths absolutos no `globals.css` resolvem
naturalmente.

`public/brand/` também foi sincronizada (logo SV mark, paper textures,
hero assets).

---

## Auth bridge (KAI integration)

`lib/supabase.ts` re-exporta o client do KAI (`@/integrations/supabase/client`)
com cast pra `SupabaseClient`. Em runtime é o `ClientWithNeonAuth` do
Neon Auth + Data API, mas a interface (`from`, `auth.signIn`, etc) é a
mesma.

`lib/auth-context.tsx` segue como AuthProvider próprio do SV — tenta
fazer `supabase.from("profiles").select("*")`. Se a tabela não existir
no Neon do KAI, o fetch falha silenciosamente e `profile` fica `null` —
componentes têm fallbacks pra esse caso (`profile?.usage_count ?? 0`).

---

## Build status

```
$ bun run build
✓ 2668 modules transformed.
✓ built in 9–15s
```

Bundles relevantes gerados:

```
dist/assets/MainApp-iQsQSamN.js   98.85 kB │ gzip: 23.18 kB   (SV chunk)
dist/assets/MainApp-BoA_sq-1.css  26.04 kB │ gzip:  5.91 kB   (globals.css do SV)
dist/assets/use-draft-cUyZLyaB.js 75.47 kB │ gzip: 14.83 kB
dist/assets/edit-BtadR-aX.js      42.91 kB │ gzip: 12.24 kB
dist/assets/preview-B1JrPF63.js   57.31 kB │ gzip: 16.51 kB
dist/assets/page-BqTuqjUq.js      54.40 kB │ gzip: 14.77 kB   (settings)
dist/assets/onboarding-DrmmMYh5.js 46.22 kB │ gzip: 12.96 kB
```

TypeScript ainda reporta ~25 warnings em arquivos server-only não
exercitados pelo client (referrals.ts, posthog-server.ts) e mismatches
de tipo entre `ClientWithNeonAuth` ↔ `SupabaseClient`. **Nenhum
bloqueante pro build de runtime.**

---

## Stats

- **Total LOC:** 40 583 (TS/TSX/CSS)
- **TS/TSX files:** 116
- **CSS files:** 1 (globals.css, 1279 linhas)
- **Adaptações Next→Vite:** 11 shims + 1 grand path-rewrite
- **Pages copiadas:** 16 (dashboard, carousels, create-new, 4 sub-routes
  de create/[id], settings, plans, help, login, onboarding, roadmap,
  create-index, layout standalone)
- **Componentes copiados:** 22 (`components/app/*` + ui/sonner +
  facebook-login-button + 9 templates de slide + 4 zernio + extras)
- **Lib copiada:** 38 arquivos (carousel-storage, carousel-templates,
  pricing, auth-context, create/*, email/templates/*, integrations/resend, etc)

---

## Known issues / Pendências futuras

1. **Tabela `profiles`** — schema do KAI Neon difere do schema standalone
   (campos `usage_count`, `usage_limit`, `plan` etc não existem do mesmo
   jeito). Profile fica null e componentes mostram fallbacks. Resolver
   requer migration ou mapping explícito quando Gabriel quiser mexer no
   billing dentro do KAI.

2. **Stripe paywall** — bloco da página `/plans` ainda existe no source
   copiado, mas Stripe SDK foi stubado. Em runtime o usuário vê os
   tiers mas o checkout não dispara. KAI tem billing próprio (`BillingTab`)
   que cobre isso.

3. **Hash routing** — links que vão de fora do MainApp (KAI sidebar)
   pra dentro do SV não passam um hash inicial. A rota default é
   `dashboard.tsx`. Pra sub-pages (carousels, create/new) o user precisa
   clicar nos botões internos do dashboard, que setam `#/carousels`.

4. **Onboarding/Plans/Login** — essas pages do SV são pensadas pra fluxo
   solo. Dentro do KAI (que já tem seu próprio onboarding/login), elas
   ficam acessíveis mas redundantes. Decidir mais tarde se some-las da
   navegação interna do SV.

5. **23 CSS files** — o briefing original mencionava 23, mas o standalone
   na verdade tem **1 só** (`globals.css`). O número deve vir do
   handoff/design files. Tudo cabe no `globals.css` de 1279 linhas que
   foi importado intacto no `MainApp.tsx`.

---

## Como rodar

```bash
cd /Users/gabrielmadureira/GOS/code/kai-app-combo
bun install     # se precisar
bun run build   # produção
bun run dev     # local — abrir em /kai?tab=viral-carrossel
```

A tab `Sequência Viral` na sidebar do KAI agora carrega o app standalone
copiado. Visual: paper bege, headers serif italic, eyebrows mono, REC
coral nos CTAs.

---

## Files alterados

- `vite.config.ts` — aliases `@sv` + 11 shims
- `tsconfig.json` + `tsconfig.app.json` — paths
- `index.html` — fonts Plus Jakarta + Instrument Serif italic + JetBrains
  Mono + DM Serif + Playfair + Outfit + Source Sans + Literata + Geist Mono
- `src/pages/Kai.tsx` — `ViralSequenceTab` agora aponta pra `viral-sv-original/MainApp`
- `src/components/kai/ViralSequenceTab.tsx` → renomeado pra `.legacy.tsx`
- `public/fonts/{Atelier.ttf,Gridlite.otf,Inter.ttf}` — copiados
- `public/brand/*` — sincronizado com standalone
