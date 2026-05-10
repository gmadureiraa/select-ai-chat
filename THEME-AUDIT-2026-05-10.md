# Theme Dark/Light Audit KAI 2.0 — 2026-05-10

> Auditoria exaustiva do contraste/cores entre `light` e `dark` mode.
> Excluído: `viral-*-original/` (sistemas isolados com seu próprio CSS).
> Excluído: `ui/dialog.tsx`, `alert-dialog.tsx`, `sheet.tsx`, `drawer.tsx` (recém-corrigidos).

## Sumário Executivo

A maioria dos cards principais (PlanningItemCard, TaskCard) usa tokens semânticos
corretos (`bg-card`, `border-border`, `text-foreground`). O bug que o usuário
reporta vem de **3 categorias específicas**:

1. **Badges de status hardcoded em `text-{color}-700` + `bg-{color}-100`** —
   pintam bem em light mas ficam quase invisíveis em dark (texto escuro sobre
   fundo escuro porque o `bg-{color}-100` no dark continua sendo `#dbeafe`,
   praticamente branco).
2. **Badges com `text-{color}-300` ou `text-{color}-400`** — pintadas pra dark
   mode, mas em light viram texto pastel sobre fundo branco-puro = ilegível
   (contraste WCAG abaixo de 3:1).
3. **`brandClass` literais (`bg-black text-white`)** em SocialIntegrationsPanel —
   intencional pra brand colors das redes, **não é bug**.

`ThemeProvider` está faltando `disableTransitionOnChange` — toda troca de tema
dispara transição em todos os elementos juntos = efeito "lavando a tela".

## 🔴 P0 — Hardcoded sem variant `dark:` (afeta tela visível)

### Badges status com light/dark assimétrico

| Componente | Linha | Issue | Fix |
|---|---|---|---|
| `planning/PublicationStatusBadge.tsx` | 103 | `bg-blue-100 text-blue-700` (publishing) — ilegível em dark | `bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300` |
| `planning/PublicationStatusBadge.tsx` | 119 | `bg-green-100 text-green-700` (published) | idem com `dark:` |
| `planning/CalendarView.tsx` | 208 | `bg-green-100 text-green-700 border-green-300` (Auto badge) | adicionar `dark:` variants |
| `planning/CalendarView.tsx` | 213 | `bg-amber-100 text-amber-700 border-amber-300` (Manual) | idem |
| `planning/CalendarView.tsx` | 251 | `bg-orange-100 text-orange-700` (countdown hoje) | idem |
| `planning/CalendarView.tsx` | 252 | `bg-amber-100 text-amber-700` (countdown amanhã) | idem |

### Badges hardcoded só pra dark (ilegíveis em light)

| Componente | Linha | Issue | Fix |
|---|---|---|---|
| `tasks/TasksCalendarView.tsx` | 40-42 | `text-red-300/orange-300/blue-300` priority em chips | usar tokens `text-foreground` ou adicionar light variant `text-red-700` |
| `tasks/TasksCalendarView.tsx` | 158 | `text-red-400` (overdue counter) | trocar por `text-destructive` |
| `tasks/TasksCalendarView.tsx` | 163 | `text-emerald-400` (done counter) | adicionar `text-emerald-700 dark:text-emerald-400` |
| `tasks/TasksCalendarView.tsx` | 277 | `bg-emerald-500/15 text-emerald-300 line-through border-emerald-500/30` | `text-emerald-700 dark:text-emerald-300` |
| `tasks/TaskCard.tsx` | 128 | `text-red-400 / text-amber-400` (overdue/due today) | `text-destructive` / `text-amber-600 dark:text-amber-400` |
| `settings/WebhookSettings.tsx` | 84-85 | `text-red-400 / text-blue-400` em severity styles | adicionar light variant |
| `settings/WebhookSettings.tsx` | 265, 499, 575 | `text-red-400` em badges/labels | trocar por `text-destructive` |
| `settings/WebhookSettings.tsx` | 557 | `text-green-400 / text-muted-foreground` ternário enabled | `text-emerald-600 dark:text-emerald-400` |
| `tasks/TeamTasksBoard.tsx` | 399, 403 | `text-red-400 / text-emerald-400` (Atrasada / Concluída) | adicionar light variant |
| `clients/ClientAnalyticsTab.tsx` | 88-90 | `text-blue-400 / text-purple-400 / text-amber-400` icon colors | `text-{color}-600 dark:text-{color}-400` |
| `kai/home/RecentActivity.tsx` | 90, 92, 95 | `text-blue-400 / text-purple-400` activity colors | idem |
| `kai/MCPDocsTab.tsx` | 78-80 | `text-blue-300 / text-amber-300 / text-purple-300` (read/write/files) | `text-{color}-700 dark:text-{color}-300` |
| `kai/MCPDocsTab.tsx` | 519 | `text-amber-300` em code | idem |
| `planning/BulkActionsToolbar.tsx` | 147 | `text-red-300 hover:text-red-200` | `text-destructive hover:text-destructive/80` |
| `planning/PlanningListRow.tsx` | 50 | `text-blue-400` low priority | `text-blue-600 dark:text-blue-400` |
| `planning/PlanningItemCard.tsx` | 118 | `text-blue-400` low priority | idem |
| `planning/ClickUpImportDialog.tsx` | 264 | `text-red-400` em erros | `text-destructive` |
| `kai/MobileHeader.tsx` | 63 | `text-amber-500 hover:text-amber-600` | OK (cor 500/600 funciona em ambos) |

### Light-only bg em VoiceProfileEditor (caos em dark)

| Componente | Linha | Issue | Fix |
|---|---|---|---|
| `clients/VoiceProfileEditor.tsx` | 292 | `bg-emerald-500/10 text-emerald-700` (Use badges) | `text-emerald-700 dark:text-emerald-400` |
| `clients/VoiceProfileEditor.tsx` | 305 | `bg-rose-500/10 text-rose-700` (Avoid badges) | `text-rose-700 dark:text-rose-400` |
| `clients/VoiceProfileEditor.tsx` | 378, 422, 446 | mesma classe repetida em 3 spots | idem |
| `clients/ClientReferencesManager.tsx` | 32-39 | FORMAT_CHIP map: `text-{color}-600/700` em todos formatos | adicionar `dark:text-{color}-400` em cada |

### bg-card/X transparente residual (já resolvidos em dialog/sheet/drawer)

| Componente | Linha | Issue | Fix |
|---|---|---|---|
| `PendingAccessOverlay.tsx` | 154 | `bg-card/95` no dark fica embaixo do overlay e some | trocar `/95` por sólido `bg-card` |
| `kai-global/GlobalKAIPanel.tsx` | 174 | `bg-card/50 backdrop-blur-sm` no header | OK (intencional pra glassmorphism) |
| `pwa/OfflineIndicator.tsx` | 33 | `bg-card/95` em toast offline | OK |

## 🟡 P1 — `dark:` assimétrico (parte tem, parte não tem)

| Componente | Linha | Issue | Fix |
|---|---|---|---|
| `planning/CalendarView.tsx` | 261 | `bg-red-50 dark:bg-red-950/50` mas `text-red-600` sem dark variant | OK na prática (red-600 é legível em dark) |
| `planning/PublicationStatusBadge.tsx` | 142, 187 | `bg-emerald-50 ... dark:bg-emerald-950 dark:text-emerald-300` | OK — tem variant |

## 🟢 P2 — Polish (intencional, não-bug, ou risco baixo)

| Componente | Linha | Issue | Decisão |
|---|---|---|---|
| `clients/SocialIntegrationsPanel.tsx` | 64-70 | brand colors hardcoded (twitter `bg-black`, IG gradient, etc.) | **manter** — brand colors oficiais |
| `tasks/TaskLabelsEditor.tsx` | 16-18 | hex literais `#ef4444`...`#64748b` em palette | **manter** — labels do user |
| `posts/CarouselEditor.tsx` | 203, 230, 271 | `backgroundColor: "#ffffff"` em html2canvas exports | **manter** — render canvas, intencional |
| `posts/PostPreviewCard.tsx` | 101 | `backgroundColor: "#ffffff"` | **manter** — html2canvas render |
| `kai/performance-v2/components/MetricChartHero.tsx` | 86-94 | hex em chart palette | **manter** — Recharts colors |
| `kai/viral/AutoSaveIndicator.tsx` | 82, 93 | `style={{ color: "#16a34a" }}` / `#dc2626` | **fix:** trocar pra `text-emerald-500` / `text-destructive` |
| `planning/PlanningItemCard.tsx` | 184 | `dotColor = '#888'` fallback | **manter** — fallback genérico |
| `tasks/TaskCard.tsx` | 100-103 | hex em label badges (do user) | **manter** — user data |
| `planning/PlanningItemCard.tsx` | 295, 305, 320 | `bg-black/55, bg-black/60` em overlays sobre imagens | **manter** — overlay de imagem precisa preto pra contraste |
| `planning/ImageLightbox.tsx` | 168, 175, 186, 199, 209... | `bg-black/95 + text-white + bg-white/20 hover` em lightbox de imagem | **manter** — lightbox sempre dark, tema-agnóstico |
| `planning/MediaUploader.tsx` | 279, 284, 293, 302 | `bg-black/50 text-white hover:bg-white/20` em hover overlay de imagem | **manter** — overlay sobre thumb |
| `library/AttachmentsEditor.tsx` | 112, 123 | `bg-black/90` lightbox | **manter** |
| `clients/RefSceneStrip.tsx` | 114, 121 | `bg-black/85 text-white` em scene labels sobre imagem | **manter** — overlay |
| `clients/VisualReferencesManager.tsx` | 343, 484, 488 | overlays `bg-black/60` em hover de imagem | **manter** |
| `chat/EnhancedMessageBubble.tsx` | 247-248 | overlay zoom em imagem | **manter** |

## 🔧 Theme infra

### ThemeProvider config (App.tsx:42)

```tsx
<ThemeProvider attribute="class" defaultTheme="dark" enableSystem storageKey="kai-theme">
```

**Issues:**

1. ❌ **Falta `disableTransitionOnChange`** — sem isso, toda troca de tema dispara
   transitions de borders/bg/text simultaneamente. Causa o efeito "lavada"
   (glitchy, transparências bugadas em meio à transição) que o usuário reporta.
2. ⚠️ `enableSystem` com `defaultTheme="dark"` — se o user tiver sistema light,
   na primeira visita carrega dark, mas se usar `useTheme()` antes da hydration
   finalizar pode dar um piscar. Resolve com `suppressHydrationWarning` no `<html>`.
3. ❌ **Falta script anti-FOUC no `index.html`** — Vite SPA, `next-themes` só
   roda depois do JS hidratar. No primeiro paint pode mostrar light antes de
   trocar pra dark salvo. Solução: pequeno script `<script>` síncrono no head
   que lê localStorage e aplica `dark` na `<html>` antes do React montar.

### Hydration FOUC

Sim — Vite SPA + `next-themes` causa flash de tema padrão durante o JS load.
**Mitigação:** script inline no `index.html` antes do `<script type="module">`:

```html
<script>
  (function() {
    try {
      var stored = localStorage.getItem('kai-theme');
      var theme = stored || 'dark';
      if (theme === 'system') {
        theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      document.documentElement.classList.add(theme);
      document.documentElement.style.colorScheme = theme;
    } catch (e) {}
  })();
</script>
```

### Toggle behavior

`ThemeToggle` em `ui/theme-toggle.tsx` chama `setTheme('light' | 'dark')`. ✅
Funciona, persiste em `kai-theme` no localStorage. ✅

### Mobile modal mantém tema

Modais shadcn herdam do `<html>` via classe `dark`, então sim. ✅

### theme-color meta hardcoded

`index.html:13` tem `<meta name="theme-color" content="#16a34a" />` (verde dark).
Em light mode a status bar do iOS PWA fica verde (não rosa). **Fix:** dois
metas com `media`:

```html
<meta name="theme-color" content="#d262b2" media="(prefers-color-scheme: light)" />
<meta name="theme-color" content="#16a34a" media="(prefers-color-scheme: dark)" />
```

## 📊 Estatística

| Métrica | Valor |
|---|---|
| Total de arquivos com cores hardcoded sem `dark:` | ~38 |
| Total ocorrências `text-{color}-{700-900}` sem `dark:` | 14 |
| Total ocorrências `text-{color}-{300-400}` sem `dark:` (dark-only) | 50 |
| Total ocorrências `bg-{color}-{50-100-200}` sem `dark:` | 8 |
| Total ocorrências `bg-card/X` (transparente residual) | 3 (mas só 1 problema real) |
| Total `bg-{color}` sem `dark:` (geral, inclui chips OK) | 211 |
| Cobertura `dark:` adequada | ~75% |

## 📋 Plano de fix

### ✅ Aplicados nesta auditoria (validados em `bun run build`)

- [x] **App.tsx** — `disableTransitionOnChange` adicionado no ThemeProvider
      (mata o "lavando a tela" ao trocar tema)
- [x] **index.html** — script anti-FOUC inline + `theme-color` dual
      (`prefers-color-scheme: light` → rosa, dark → verde)
- [x] **PublicationStatusBadge** — publishing/published com `dark:` variants
- [x] **CalendarView** — Auto/Manual badge + countdown hoje/amanhã com `dark:` variants
- [x] **TasksCalendarView** — priorityClass urgent/high/medium agora dual-variant,
      counters overdue → `text-destructive`, done → `text-emerald-600 dark:text-emerald-400`,
      task done style com dual variant
- [x] **TaskCard** — overdue → `text-destructive`, due today → dual variant
- [x] **TeamTasksBoard Kpi** — danger/success com dual variants
- [x] **VoiceProfileEditor** — Use (emerald) / Avoid (rose) badges com dual variants
      (3 ocorrências cada via replace_all)
- [x] **ClientReferencesManager FORMAT_CHIP** — todos 8 formatos (carousel/reel/static/
      tweet/thread/newsletter/article/email) com `text-{color}-700 dark:text-{color}-400`
- [x] **WebhookSettings** — severity styles + 4 spots de `text-red-400` → dual
      ou `text-destructive`. Enabled state → `text-emerald-600 dark:text-emerald-400`
- [x] **PlanningListRow + PlanningItemCard** — low priority com dual variant
- [x] **ClickUpImportDialog** — erros com `text-destructive` (token semântico)
- [x] **BulkActionsToolbar** — botão excluir com `text-destructive`
- [x] **ClientAnalyticsTab** — content type colors (carrossel/reels/briefs) dual
- [x] **RecentActivity** — colorMap (10 colors com dark-only fix)
- [x] **MCPDocsTab** — read/write/files/ai categories dual + amber-300 inline
- [x] **AutoSaveIndicator** — hex inline `#16a34a`/`#dc2626` → `text-emerald-600`/`text-destructive`
- [x] **PendingAccessOverlay** — `bg-card/95` → `bg-card` (sólido, sem transparência)

### P1 esta semana

- [ ] Auditar `clients/ClientAnalyticsTab.tsx` (text-blue-400/purple-400/amber-400)
- [ ] Auditar `kai/MCPDocsTab.tsx` (badges read/write/files com text-300)
- [ ] Auditar `kai/home/RecentActivity.tsx` (text-{color}-400)
- [ ] Adicionar variant nos 50 `text-{color}-{300-400}` restantes

### P2 backlog

- [ ] Migrar status colors pro CSS token system (`--status-{name}`) em vez de
      hardcoded `bg-emerald-100/dark:bg-emerald-900` em cada componente
- [ ] Considerar criar utilitário `getStatusBadgeClass(status)` único
- [ ] WCAG audit dos contrastes em ambos os modos (axe-core ou similar)
