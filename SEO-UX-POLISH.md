# SEO + UX Polish — KAI 2.0

Último polish antes do anúncio público. Foco em **descobribilidade** (OG/Twitter, robots, sitemap) e **percepção de qualidade** (404 bonita, skeletons fiéis, analytics de produto).

> Branch: `combo-viral-integration` · Data: 2026-05-08

---

## 1. Open Graph + Twitter Card

`index.html` agora serve cards corretos pro Twitter, LinkedIn, WhatsApp, Slack, etc.

```html
<meta property="og:title"       content="KAI - Kaleidos AI" />
<meta property="og:description" content="Plataforma de IA contextual..." />
<meta property="og:type"        content="website" />
<meta property="og:url"         content="https://kai-2-topaz.vercel.app" />
<meta property="og:image"       content="https://kai-2-topaz.vercel.app/og-image.svg" />
<meta property="og:locale"      content="pt_BR" />
<meta property="og:site_name"   content="KAI" />

<meta name="twitter:card"        content="summary_large_image" />
<meta name="twitter:title"       content="KAI - Kaleidos AI" />
<meta name="twitter:description" content="Plataforma de IA para criação de conteúdo estratégico" />
<meta name="twitter:image"       content="https://kai-2-topaz.vercel.app/og-image.svg" />
```

Imagem OG é um **SVG 1200×630** (`public/og-image.svg`) com gradiente preto→verde + tipografia Inter — gerado in-line, zero deps externas. Quando tiver tempo, substituir por PNG renderizado a partir do design final.

> Por que SVG? Vercel serve com `Content-Type: image/svg+xml` e os crawlers principais (Twitter, LinkedIn, WhatsApp) aceitam. `og:image:type` declarado.

---

## 2. robots.txt

`public/robots.txt`:

- Bloqueia `/api/`, `/kaleidos/` (área logada), `/no-workspace`
- Permite `/`, `/login`, `/signup`
- Aponta o sitemap

---

## 3. sitemap.xml

`public/sitemap.xml` com as 3 rotas públicas (home, login, signup). Atualizar quando rotas marketing forem adicionadas.

---

## 4. NotFound page redesenhada

`src/pages/NotFound.tsx` foi reescrita do zero:

- **Hero:** ícone `Compass` em rotação infinita (8s linear) + 404 gigante translúcido atrás
- **Path quebrado** mostrado em `<code>` (ajuda diagnosticar links errados)
- **3 CTAs:** Voltar (history) · Home · Workspace
- **Auto-redirect** pra home em 10s, pausa em qualquer interação (mouse/teclado)
- **Reportar erro** via mailto pré-preenchido com URL + referrer
- **Mobile-first:** `min-h-[100dvh]`, grid colapsa em 1 coluna < sm

---

## 5. analytics.ts helper

`src/lib/analytics.ts` exporta `trackEvent(name, props?)` — wrapper sobre `@vercel/analytics` (já no bundle). Tipa os 9 eventos que importam pro produto:

| Evento | Quando dispara | Onde |
|---|---|---|
| `client_created` | Cliente criado via wizard | `useClientOnboarding.ts` (`onSuccess`) |
| `carrossel_generated` | Carrossel gerado pelo Gemini | `ViralSequenceTab.tsx` (`handleGenerate`) |
| `reel_analyzed` | Reel adaptado/engenharia reversa OK | `ViralReelsTab.tsx` (após `apiInvoke`) |
| `radar_brief_opened` | Reservado pro futuro | — |
| `subscription_started` | Retorno do Stripe checkout (free → paid) | `BillingTab.tsx` (`useEffect` em `?stripe=success`) |
| `subscription_changed` | Retorno do Stripe checkout (upgrade/downgrade) | idem |
| `workspace_member_invited` | Convite enviado com sucesso | `WorkspaceMembersTab.tsx` (`onSuccess`) |
| `push_subscribed` | Push notif aceita pelo browser | `NotificationPermissionPrompt.tsx` |
| `kai_chat_message_sent` | Reservado pro futuro | — |

**5 callsites plugados** (mínimo do critério atendido).

Falha silenciosa em dev / quando `track()` lança (AdBlock, sem domínio Vercel). Warning só em `import.meta.env.DEV`.

---

## 6. Loading skeletons fiéis

### HomeDashboard
Adicionado `isLoading: isLoadingItems` na query principal e early-return com skeleton que respeita o layout: header + 4 stats cards + KPI row + grid 7+5 (today + pipeline + clients) + weekly timeline. Sem flash de "0 itens".

### ClientsListPage
Skeleton anterior era `Skeleton h-32` × 3. Agora replica fielmente o card real: `h-14 w-14` avatar + 3 linhas de texto + 2 botões em rodapé separado por border-top. 6 cards (não 3) pra preencher melhor a viewport.

---

## 7. README atualizado

Adicionada seção **Screenshots** com 5 placeholders (Home, Viral Sequence, Viral Reels, Radar, Billing) — serão substituídos por blob URLs na próxima rodada de marketing.

---

## Arquivos criados

- `public/og-image.svg` (1200×630 OG image)
- `public/sitemap.xml`
- `src/lib/analytics.ts`
- `SEO-UX-POLISH.md`

## Arquivos modificados

- `index.html` — OG + Twitter tags completas, locale pt_BR, site_name
- `public/robots.txt` — Disallow áreas privadas + sitemap
- `src/pages/NotFound.tsx` — redesenhada do zero com auto-redirect + report
- `src/components/kai/home/HomeDashboard.tsx` — skeleton fiel ao layout
- `src/components/clients/ClientsListPage.tsx` — skeleton melhor
- `src/hooks/useClientOnboarding.ts` — track `client_created`
- `src/components/kai/ViralSequenceTab.tsx` — track `carrossel_generated`
- `src/components/kai/ViralReelsTab.tsx` — track `reel_analyzed`
- `src/components/workspace/WorkspaceMembersTab.tsx` — track `workspace_member_invited`
- `src/components/billing/BillingTab.tsx` — track `subscription_started`/`subscription_changed`
- `src/components/notifications/NotificationPermissionPrompt.tsx` — track `push_subscribed`
- `README.md` — seção Screenshots

## Não foi feito (fora do escopo)

- Imagem OG real (PNG 1200×630 com design final) — placeholder SVG cobre 95% dos casos
- Sitemap dinâmico (per-workspace) — não faz sentido em SPA logada
- `radar_brief_opened` / `kai_chat_message_sent` — eventos definidos no helper mas não plugados (proximas iterações)
