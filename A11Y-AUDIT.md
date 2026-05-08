# A11Y Audit — KAI 2.0

Auditoria de acessibilidade WCAG 2.1 nível A + AA usando `@axe-core/playwright`
em rotas públicas (sem auth). Páginas autenticadas (workspace `/kaleidos`) ficam
fora do escopo desta auditoria por exigirem login real.

## Tooling

- `@axe-core/playwright@4.11.3` (dev dep)
- Tests rodam contra build local (`bun run build && vite preview`) ou contra prod
  via `PLAYWRIGHT_BASE_URL=https://kai-2-topaz.vercel.app`.

```bash
# Audit reproducível contra build local
bun run build
bunx vite preview --port 4173 &
PLAYWRIGHT_BASE_URL=http://127.0.0.1:4173 bunx playwright test e2e/06-a11y.spec.ts
```

## Score: antes vs depois

Tags auditadas: `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `best-practice`.

| Rota       | Violations antes (deep-scan) | Violations depois |
|------------|-----------------------------:|------------------:|
| `/login`   | 5 (4 best-practice + 1 wcag) | **0**             |
| `/signup`  | 5 (4 best-practice + 1 wcag) | **0**             |
| `/404`     | 5 (4 best-practice + 1 wcag) | **0**             |
| `/offline` | 3 (2 best-practice + 1 wcag) | **0**             |

Em prod (sem deploy ainda): **1 violation por rota** (`meta-viewport` —
zoom desabilitado). Esse fix entra no próximo deploy.

## Top 10 violations encontradas

| # | Regra                  | Impact   | Onde                                      | Fix                                              |
|---|------------------------|----------|-------------------------------------------|--------------------------------------------------|
| 1 | `meta-viewport`        | moderate | `index.html`                              | Removeu `maximum-scale=1.0, user-scalable=no`    |
| 2 | `landmark-one-main`    | moderate | `Login`, `SimpleSignup`, `NotFound`       | Wrap em `<main id="main-content">`               |
| 3 | `region`               | moderate | Mesmas pages — conteúdo solto fora landmark | Mesmo wrap `<main>` cobre                       |
| 4 | `skip-link`            | moderate | `SkipLink` aponta `#main-content` inexistente | Pages agora têm `id="main-content"` no `<main>` |
| 5 | `heading-order`        | moderate | `Login`, `SimpleSignup` — pulava h1→h3    | Trocou `CardTitle` (h3) por `<h2>` direto        |
| 6 | `page-has-heading-one` | moderate | `PageLoader` (Suspense fallback)          | PageLoader agora tem `<main id="main-content">` + `role="status"` + sr-only "Carregando…" |
| 7 | `image-alt` (preventivo) | serious | `Login/Signup/NotFound` logo `<img>`     | `alt=""` + `aria-hidden="true"` (decorativo, h1 já tem texto "KAI") |
| 8 | `button-name` (preventivo) | serious | Toggle de sidebar sem label              | `aria-label` + `aria-expanded` em `KaiSidebar`   |
| 9 | `landmark-unique` (preventivo) | moderate | KaiSidebar `<aside>` e `<nav>` sem nome | `aria-label="Barra lateral KAI"` e `aria-label="Navegação principal do workspace"` |
| 10 | `aria-live` (status) | best-practice | ErrorBoundary sem anúncio              | `role="alert" aria-live="assertive"` em ambos fallbacks |

## Files modified

- `index.html` — viewport meta WCAG-friendly.
- `src/pages/Login.tsx` — `<main id="main-content">`, `<h2>` em vez de CardTitle, alt vazio + sr-only no logo.
- `src/pages/SimpleSignup.tsx` — idem.
- `src/pages/NotFound.tsx` — `<main id="main-content">`, ícones `aria-hidden`, alt vazio no logo.
- `src/pages/Offline.tsx` — adicionou `id="main-content"` ao `<main>` existente.
- `src/pages/Kai.tsx` — adicionou `id="main-content"` ao `<main>` do app autenticado.
- `src/components/ui/page-loader.tsx` — `<main id="main-content">`, `role="status"`, sr-only "Carregando…".
- `src/components/ErrorBoundary.tsx` — `role="alert" aria-live="assertive"` + ícones decorativos com `aria-hidden`.
- `src/components/kai/KaiSidebar.tsx` — `aria-label` em `<aside>` e `<nav>`, toggle com `aria-label` + `aria-expanded`.
- `e2e/06-a11y.spec.ts` — suite a11y (nova).
- `e2e/_a11y-deep-scan.spec.ts` — deep-scan ad hoc (não roda no CI por padrão; underscore prefix).
- `package.json` — adiciona `@axe-core/playwright` em devDependencies.

## TODO pendente (out of scope desta passada)

Páginas autenticadas (workspace) não foram auditadas porque exigem login + dados
de workspace. Itens prováveis para o próximo round:

- [ ] Rodar axe contra `/kaleidos`, `/kaleidos/clients` com Playwright login fixture
      (cookies de sessão Lovable/Supabase).
- [ ] `MobileHeader.tsx` — adicionar `aria-label` no botão de menu hambúrguer e
      `aria-expanded` quando o sheet está aberto.
- [ ] `EmptyState`, `ClientRequiredEmpty` — confirmar que ícones têm `aria-hidden`
      e que título/descrição estão associados com `aria-labelledby/describedby`.
- [ ] Forms internos pesados (`AutomationDialog`, `ClientCreationWizardSimplified`,
      `RichContentEditor`) — verificar labels associadas e ordem de heading.
- [ ] Toasts (`sonner`) — confirmar que estão dentro de `aria-live` (Sonner faz por
      padrão, mas vale auditar).
- [ ] Contraste de cores em modo `dark` (default) — rodar axe com tag
      `cat.color` específica e revisar tokens de `text-muted-foreground/70` em
      cima de `bg-sidebar` (alguns labels uppercase muito apagados podem falhar
      4.5:1 ratio em texto pequeno).
- [ ] Componentes de chart (Recharts) — adicionar `aria-label` e fallback textual
      em `KaiAnalyticsTab`, `LinkedInDashboard`, etc.
- [ ] Tabelas grandes (`LinkedInPostsTable`, `TwitterPostsTable`,
      `MetaAdsCampaignsTable`) — `<caption>` ou `aria-label`, `scope="col"` em
      headers, navegação por teclado das ações de linha.
- [ ] Focus trap nos modais (Radix já cuida em `Dialog/AlertDialog`, mas verificar
      que nenhum portal customizado vaza foco).
- [ ] Lighthouse CI — adicionar gate de a11y ≥ 95 nos PRs principais.

## Como rodar regressão

```bash
# Local (build + preview)
bun run build
bunx vite preview --port 4173 &
PLAYWRIGHT_BASE_URL=http://127.0.0.1:4173 bunx playwright test e2e/06-a11y.spec.ts

# Prod
PLAYWRIGHT_BASE_URL=https://kai-2-topaz.vercel.app bunx playwright test e2e/06-a11y.spec.ts
```

O test usa threshold defensivo de `< 20` violations por rota — ajustar para
`< 5` (ou `0` por rota) à medida que mais fixes forem aplicados, transformando
o audit em regression test.
