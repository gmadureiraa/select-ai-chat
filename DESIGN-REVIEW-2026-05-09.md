# Design Review KAI 2.0 — 2026-05-09

> Audit visual focado em Planning, Library, Performance, Home, Clients, Settings.
> Contexto: `--background` light virou `320 15% 98%` (off-white rosa), `--card` light é `0 0% 100%` (branco puro).
> Dark: `--background: 0 0% 3%` / `--card: 0 0% 7%`. Diferença sutil — qualquer transparência sobre card "vaza" pro background.

---

## 🐛 Bugs visuais (transparências quebradas)

> Padrão: `bg-card/[30-80]` em containers que NÃO estão aninhados em outro tom forte vão renderizar quase indistinguíveis do background.

### P0 — Cards primários transparentes (vão sumir)

| Path:linha | Diagnóstico | Fix sugerido |
|---|---|---|
| `src/components/clients/ClientList.tsx:84` | Card de cliente `bg-card/50` direto sobre página `bg-background`. No light vira branco-rosa-clarinho com 50% — borda some. | `bg-card hover:bg-accent/30 hover:border-border shadow-sm` |
| `src/components/performance/PerformanceOverview.tsx:253` | KPI cards `bg-card/50` sobre `bg-background` — mesmo bug do ClientList. | `bg-card shadow-sm hover:border-border` |
| `src/components/performance/PerformanceOverview.tsx:279` | Card de gráfico "Evolução (30 dias)" também `bg-card/50`. | `bg-card shadow-sm` |
| `src/components/performance/StatsGrid.tsx:67` | Stats grid principal — `bg-card/50` sobre background. | `bg-card shadow-sm` |
| `src/components/performance/AIInsightsCard.tsx:151` | Card de IA insights `bg-card/50`. | `bg-card shadow-sm` |
| `src/components/performance/AutoInsightsCard.tsx:195` | Idem. | `bg-card shadow-sm` |
| `src/components/performance/PerformanceTable.tsx:95,110` | Tabela performance `bg-card/50` (2 instâncias). | `bg-card shadow-sm` |
| `src/components/performance/TopPerformersCard.tsx:33` | `bg-card/50`. | `bg-card shadow-sm` |
| `src/components/performance/GoalGauge.tsx:67,85` | Gauge container `bg-card/50` (vazio + ativo). | `bg-card shadow-sm` |
| `src/components/performance/MixedBarLineChart.tsx:56` | Chart wrapper `bg-card/50`. | `bg-card shadow-sm` |
| `src/components/performance/GoalProgressCard.tsx:55` | `bg-card/50`. | `bg-card shadow-sm` |
| `src/components/performance/AudienceSentimentGauge.tsx:65` | `bg-card/50`. | `bg-card shadow-sm` |
| `src/components/performance/DonutChart.tsx:37` | `bg-card/50`. | `bg-card shadow-sm` |
| `src/components/performance/BestPostCard.tsx:25` | `bg-card/50`. | `bg-card shadow-sm` |
| `src/components/performance/NewsletterInsightsCard.tsx:166` | `bg-card/50`. | `bg-card shadow-sm` |
| `src/components/performance/GoalsPanel.tsx:120,140` | 2 cards `bg-card/50`. | `bg-card shadow-sm` |
| `src/components/performance/InstagramStoriesSection.tsx:122` | `bg-card/50 hover:bg-card/80` — duplo problema, ambos transparentes. | `bg-card hover:bg-accent/30` |
| `src/components/planning/CalendarView.tsx:454` | Grid de calendário inteiro com `bg-card/50 backdrop-blur-sm`. Sem imagem por baixo, blur não faz nada e o /50 deixa quase invisível. | `bg-card shadow-sm` (remover backdrop-blur) |
| `src/components/kai/home/MyTasksWidget.tsx:36` | Widget "Suas tarefas" no Home Dashboard com `bg-card/50 border-border/40`. | `bg-card shadow-sm border-border/60` |
| `src/components/kai/home/HomeDashboard.tsx:1040` | Card de atividade recente `bg-card/40`. | `bg-card hover:bg-accent/40 hover:border-border` |

### P1 — Containers secundários questionáveis (revisar caso a caso)

| Path:linha | Diagnóstico | Fix sugerido |
|---|---|---|
| `src/components/planning/PlatformOptionsPanel.tsx:126` | `bg-card/40` dentro de Dialog (que já é `bg-card`). Aqui pode ficar — efeito de card-aninhado. | OK manter, ou trocar pra `bg-muted/40` pra ficar mais semântico. |
| `src/components/clients/BrandAssetsEditor.tsx:643` | `LogoUploadCard` interno usa `bg-card/30` dentro de aba editor. Provavelmente aninhado, mas /30 é forte demais. | `bg-muted/40` (semanticamente é container interno, não card primário) |
| `src/components/kai-global/GlobalKAIChat.tsx:262` | Botão de prompt em painel KAI com `bg-card/50` dentro de `GlobalKAIPanel` (já `bg-card/50`). | `bg-muted/30` ou `bg-secondary/40` |
| `src/components/kai-global/GlobalKAIPanel.tsx:174` | Header do painel KAI `bg-card/50 backdrop-blur-sm`. Painel flutua sobre app — backdrop-blur faz sentido aqui. | OK, mas verificar se painel container tem `bg-card`. |
| `src/components/kai/TasksPanel.tsx:29` | `bg-card/80 backdrop-blur-sm`. | OK se for overlay, senão `bg-card` |
| `src/components/kai/MCPDocsTab.tsx` (10 ocorrências `bg-card/30` e `bg-card/50`) | Cards aninhados dentro de tabs MCP. /30 é fraco demais. | Padronizar `bg-muted/40` (eles são sub-cards informativos, não primários). Linhas: 265, 284, 344, 387, 391, 395, 423, 461, 475, 517 |
| `src/components/kai/home/_legacy/*.tsx` (3 arquivos) | Pasta `_legacy` — pode ignorar se não estiver renderizando. | Confirmar se é dead code. Se sim, deletar. |
| `src/components/PendingAccessOverlay.tsx:154` | Modal central com `bg-card/95 backdrop-blur-sm`. /95 ainda é OK porque é quase opaco. | OK manter, ou subir pra `bg-card` puro. |
| `src/pages/Documentation.tsx:880` | Header sticky `bg-card/50 backdrop-blur-md`. Faz sentido (header flutuante sobre conteúdo). | OK |
| `src/components/pwa/OfflineIndicator.tsx:33` | Toast `bg-card/95 backdrop-blur`. | OK (overlay flutuante) |

### Bug visual já consertado (ref do que NÃO mexer)
- `src/components/references/ReferenceCard.tsx:57` — `bg-card border-border/60 shadow-sm`. ✅ correto, usar como template.
- `src/components/planning/VirtualizedKanbanColumn.tsx:160` — `bg-muted/40 dark:bg-muted/20 border border-border/40`. ✅ correto.
- `src/components/planning/PlanningItemCard.tsx:178` — `bg-card border border-border/60 shadow-sm`. ✅ correto.

---

## ⚠️ Tokens hardcoded

> Cores fixas que não respondem a light/dark mode. Categorizadas por urgência.

### P0 — Categorias visuais (badges/dots) que não respeitam dark mode

| Path:linha | Hardcoded | Trocar por |
|---|---|---|
| `src/components/ui/badge.tsx:21` | `bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300` (`published` variant) | OK porque tem dark variant explícito. Mas pra consistência com o resto do design system, considerar `bg-muted text-muted-foreground`. |
| `src/components/ui/badge.tsx:25` | `bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400` (`inactive` variant) | Idem. Considerar `bg-muted/60 text-muted-foreground`. |
| `src/components/content/ContentCard.tsx:31` | `other: { color: "bg-gray-500/10 text-gray-500" }` | `bg-muted text-muted-foreground` |
| `src/components/admin/RadarSourcesManager.tsx:108` | `tiktok: "bg-zinc-500/10 text-zinc-600 border-zinc-500/30"` | `bg-foreground/10 text-foreground/80 border-foreground/20` (já que TikTok é preto) |
| `src/components/chat/CitationChip.tsx:25` | `reference_library: "bg-slate-500/10 text-slate-600 border-slate-500/20"` | `bg-muted text-muted-foreground border-border` |
| `src/components/chat/EnhancedMessageBubble.tsx:72` | Idem CitationChip. | Idem. |
| `src/components/kai/MCPDocsTab.tsx:77` | `system: { color: "bg-zinc-700/40 text-zinc-300 border-zinc-600/50" }` | `bg-muted text-muted-foreground border-border` |
| `src/components/kai/MCPDocsTab.tsx:229` | `bg-zinc-950/60` em Card | `bg-muted dark:bg-card` |
| `src/components/kai/MCPDocsTab.tsx:289` | `bg-zinc-950/60` em sub-block | `bg-muted/60` |

### P1 — Status colors duros (kanban, MyTasks)

`VirtualizedKanbanColumn.tsx:16-25` e `MyTasksWidget.tsx:16-21` usam `bg-purple-500`, `bg-blue-500`, `bg-amber-500`, `bg-emerald-500`, etc para dots. Isso é consciente (cores semânticas de status). **Mas** já existem CSS variables `--status-idea`, `--status-draft`, `--status-review`, etc no `index.css:80-87` (light) e `159-167` (dark). Idealmente:

```tsx
// hoje
idea: { dotColor: 'bg-purple-500' }
// recomendado
idea: { dotColor: 'bg-[hsl(var(--status-idea))]' }
```

Isso aproveita o trabalho que você já fez de declarar status colors com light/dark separados.

### P2 — `text-white` sobre overlays escuros (lightbox/lupas)

Arquivos: `ImageLightbox.tsx`, `MediaUploader.tsx`, `VisualReferencesManager.tsx`, `ImageGallery.tsx`, `EnhancedMessageBubble.tsx`, `library/AttachmentsEditor.tsx`. Todos têm `bg-black/X` + `text-white`. **OK manter** — são overlays sobre imagens reais, não atinjem cards do app. Mesma lógica vale para `bg-black/60` em hover overlays de imagens.

### P2 — Avatares com gradient hardcoded

`WorkspaceSwitcher.tsx`, `ClientsListPage.tsx`, `MetricoolLinkinBioEditor.tsx`, `ClientsManagementTool.tsx`, `avatar-upload.tsx`: usam `bg-gradient-to-br from-primary to-secondary text-white` ou `from-violet-500 to-pink-500 text-white`. OK porque são fallbacks de avatar (intencionalmente coloridos pra distinguir).

### P3 — Brand colors em SocialIntegrationsPanel

`SocialIntegrationsPanel.tsx:64-70`: `bg-[#0A66C2]`, `bg-[#1877F2]`, `bg-[#FF0000]`, etc — cores oficiais das redes. **Não trocar**.

---

## ⚠️ Acessibilidade (focus/hover)

### P0 — Cards interativos sem `focus-visible` ring

| Path:linha | Falta |
|---|---|
| `src/components/clients/ClientList.tsx:84` | Card é renderizado direto, sem role/tabIndex/focus-visible. Botões internos têm focus, mas o Card todo é o tap target — usuário com teclado fica perdido. |
| `src/components/performance/PerformanceOverview.tsx:253` (e cards similares de Performance) | Card como contêiner não-interativo, OK. Mas se você adicionar onClick, lembrar do focus-visible. |
| `src/components/kai/home/MyTasksWidget.tsx:86` | Linha de task tem `cursor-pointer` mas é `<div onClick>` sem `role="button"` nem `tabIndex={0}` nem `onKeyDown`. |

### P1 — `cursor-pointer` ausente em cards clicáveis

| Path:linha | Tem onClick mas sem cursor |
|---|---|
| `src/components/kai/home/HomeDashboard.tsx:1040` | OK, é `<button>` nativo. |
| `src/components/clients/ClientList.tsx:84` | Card não tem onClick principal — botões dentro dele cuidam disso. OK. |

### P1 — Bom exemplo (usar como template)

`src/components/references/ReferenceCard.tsx:55-63` e `src/components/content/ContentCard.tsx:73-80`:
```tsx
<Card
  className="... cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
  onClick={...}
  onKeyDown={handleKeyDown}
  tabIndex={0}
  role="button"
  aria-label={...}
>
```

---

## ⚠️ Borders fracas

> `--border: 320 10% 90%` (light) é só ~10% mais escuro que o card. Combinado com `/50` opacity, fica quase invisível.

### Top-level (P0) — onde a borda DEVE ser visível

Borders em **cards de página principal** e **dialogs**:

- **PlanningBoard list view** (`PlanningBoard.tsx:405,407`) — table header com `border-border/50`. Subir pra `border-border`.
- **PlanningBoard list rows** (`PlanningListRow.tsx:74`) — `border-b border-border/30` mal enxerga. → `border-border/60`.
- **Performance cards** (todos os 17+ cards listados acima) — `border-border/50`. Como o `bg-card/50` vai virar `bg-card`, a borda /50 vai dar contraste OK. **Manter `/50`** se trocar bg para opaco.
- **Calendar grid borders** (`CalendarView.tsx:456,462`) — `border-b border-border/50` + `border-r border-border/30` no header. Com bg opaco fica OK. Os /30 entre dias da semana sumiram — subir pra /50.

### Mid-level (P1)

- `MyTasksWidget.tsx:36` — `border-border/40`. Subir pra `border-border/60`.
- `BrandAssetsEditor.tsx:643` (LogoUploadCard) — `border-border/50`. OK se virar `bg-muted/40`.
- `kai/MCPDocsTab.tsx` (várias) — `border-border/40`. Subir pra `border-border/50` ou `/60` se for card primário. Para sub-cards, OK.

### Cards de Card primários do shadcn

`src/components/ui/card.tsx:6` — Card base hoje é `border-border/50 bg-card text-card-foreground shadow-card`. O `shadow-card` (definido em tailwind.config.ts presumido) ajuda. Mas com a nova `--border`, considerar subir o default para `border-border/60` ou `border-border` quando o cliente passa um classe sem override. Cuidado: muitos componentes contam com /50, mexer aqui afeta tudo.

**Recomendação:** manter `border-border/50` como default no Card, mas auditar cada uso primário pra garantir `shadow-sm` extra (que é o que dá elevação no Notion/Linear style).

---

## ⚠️ Performance / re-render hotspots

### P0 — useQuery sem `staleTime` ou `placeholderData` em listas grandes

| Hook | Path | Problema | Fix |
|---|---|---|---|
| `useClients` | `src/hooks/useClients.ts:75` | Sem `staleTime`. Cada navegação refaz query. ClientList pisca. | `staleTime: 30_000, placeholderData: keepPreviousData` |
| `useContentLibrary` | `src/hooks/useContentLibrary.ts:35` | Sem `staleTime`. Library pisca. | `staleTime: 30_000, placeholderData: keepPreviousData` |
| `useReferenceLibrary` | `src/hooks/useReferenceLibrary.ts:43` | Idem. | `staleTime: 30_000, placeholderData: keepPreviousData` |
| `useTeamTasks` | `src/hooks/useTeamTasks.ts:59` | Tem `refetchInterval: 15000` mas sem `placeholderData`. Cada refetch que retorna [] vai mostrar skeleton, e cards viram empty piscando. | Adicionar `placeholderData: keepPreviousData, staleTime: 10_000`. Considerar mudar `refetchInterval` pra 30000 (mesma lógica que aplicou em planning). |
| `usePlanningComments` | `src/hooks/usePlanningComments.ts:28` | Sem staleTime — comentários piscam ao abrir card. | `staleTime: 15_000, placeholderData: keepPreviousData` |
| `useClientDocuments` | `src/hooks/useClientDocuments.ts:22` | Sem staleTime. | `staleTime: 30_000, placeholderData: keepPreviousData` |
| `useImportHistory` | `src/hooks/useImportHistory.ts:22` | Sem staleTime. | `staleTime: 30_000, placeholderData: keepPreviousData` |

### P1 — Memos faltando

| Componente | Path | Problema | Fix |
|---|---|---|---|
| `ClientList` | `src/components/clients/ClientList.tsx` | Não é memo. Re-renderiza no parent state (search etc). | `export const ClientList = memo(({ clients, isLoading }) => { ... })` |
| `MyTasksWidget` | `src/components/kai/home/MyTasksWidget.tsx` | Não é memo. Home dashboard re-renderiza isso muito. | `export const MyTasksWidget = memo(...)` |
| Performance KPI cards (dentro do `.map`) | `PerformanceOverview.tsx:246-272` | `kpiCards.map` cria motion.div + Card — não memoizado. Cada hover/state change re-renderiza tudo. | Extrair em `<KPICard>` memoizado. |
| Calendar day cells | `CalendarView.tsx` | Cada célula re-renderiza com mudança de date/state. | Memoizar `<CalendarDayCell>`. |

### P2 — Funções recriadas a cada render passadas como props

`useTeamTasks` retorna `updateTask`, `createTask`, etc — todas mutations do react-query, OK (são estáveis se queryClient é estável). Mas:

- `MyTasksWidget.tsx:75,89,93` — handlers inline com `() => { setEditing(t); setCreating(false); setOpen(true); }`. Recriado a cada render. Pra widget pequeno, ignorável; mas se virar lista de 50+ tasks, vira hotspot. → `useCallback`.
- `ClientList.tsx:131,140,149,158` — botões de navegação com inline `onClick={() => navigate(...)}`. Idem. Cada Card cria 4 handlers novos a cada render do ClientList.

### P3 — Polling de 15s no useTeamTasks

`useTeamTasks.ts:84` faz `refetchInterval: 15000` em **toda página onde useTeamTasks é chamado** (Home, Tasks, Planning popovers). Considerar:
- subir pra 30s (consistente com planning),
- ou usar Supabase Realtime channels pra eventos de tasks (sem polling).

---

## ✅ Componentes bem feitos (referências boas)

> Use estes como template em refactors.

1. **`src/components/references/ReferenceCard.tsx`** — Card do tipo "biblioteca" perfeito.
   - `memo()`, `useCallback` para keyboard handler.
   - `bg-card border-border/60 shadow-sm` (sólido + sombra sutil).
   - `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`.
   - `tabIndex={0}`, `role="button"`, `aria-label`, `onKeyDown`.
   - Image fallback robusto com `useState(imgFailed)` e ícone placeholder.

2. **`src/components/content/ContentCard.tsx`** — Mesmo padrão. Bem feito.

3. **`src/components/planning/PlanningItemCard.tsx`** — Pós-fix. `bg-card border-border/60 shadow-sm`. Tem badges, hover states, drag visual feedback.

4. **`src/components/planning/VirtualizedKanbanColumn.tsx`** — Pós-fix. Coluna usa `bg-muted/40 dark:bg-muted/20` (semantic muted, não card transparente). Border /40 funciona porque coluna não é tap target primário, é só backdrop pra cards.

5. **`src/components/kai/home/HomeDashboard.tsx:117-145` (`QuickActionCard`)** — Botão hero com:
   - `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40`,
   - estados `primary` (border-primary/40 + gradient) e default (`bg-card hover:bg-accent/30`),
   - hover state explícito com shadow.

---

## 📋 Plano de fix priorizado

### P0 — Visual quebrado (faça primeiro, ~30 min)

**Performance module — 17 cards transparentes:**
- StatsGrid.tsx:67
- AIInsightsCard.tsx:151
- AutoInsightsCard.tsx:195
- PerformanceOverview.tsx:253, 279
- PerformanceTable.tsx:95, 110
- TopPerformersCard.tsx:33
- GoalGauge.tsx:67, 85
- MixedBarLineChart.tsx:56
- GoalProgressCard.tsx:55
- AudienceSentimentGauge.tsx:65
- DonutChart.tsx:37
- BestPostCard.tsx:25
- NewsletterInsightsCard.tsx:166
- GoalsPanel.tsx:120, 140
- InstagramStoriesSection.tsx:122

→ **Substituir global** `bg-card/50` por `bg-card shadow-sm` em toda pasta `performance/`.

**Outros lugares críticos:**
- `clients/ClientList.tsx:84` → `bg-card hover:bg-accent/30 hover:border-border shadow-sm`
- `planning/CalendarView.tsx:454` → `bg-card shadow-sm` (drop backdrop-blur)
- `kai/home/MyTasksWidget.tsx:36` → `bg-card shadow-sm border-border/60`
- `kai/home/HomeDashboard.tsx:1040` → `bg-card hover:bg-accent/40`

**Acessibilidade rápida:**
- `MyTasksWidget.tsx:86` linha de task → adicionar `role="button" tabIndex={0}` + `onKeyDown` handler
- `ClientList.tsx:84` Card → `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` (pra navegação por teclado)

### P1 — Consistência (~1h)

**Hooks — adicionar `staleTime` + `placeholderData`:**
- `useClients`, `useContentLibrary`, `useReferenceLibrary`, `useTeamTasks`, `usePlanningComments`, `useClientDocuments`, `useImportHistory`

Padrão a aplicar em todos:
```ts
import { keepPreviousData } from '@tanstack/react-query';
useQuery({
  ...,
  staleTime: 30_000,
  placeholderData: keepPreviousData,
})
```

**Tokens hardcoded em badges/cards:**
- `ContentCard.tsx:31` (`bg-gray-500/10`) → `bg-muted text-muted-foreground`
- `RadarSourcesManager.tsx:108` (tiktok) → `bg-foreground/10 text-foreground/80`
- `CitationChip.tsx:25` + `EnhancedMessageBubble.tsx:72` (`bg-slate-500/10`) → `bg-muted text-muted-foreground border-border`
- `MCPDocsTab.tsx:77, 229, 289` (`bg-zinc-*`) → `bg-muted` / `bg-card`

**Status dots usando design tokens:**
- `VirtualizedKanbanColumn.tsx:16-25` → trocar `bg-purple-500` etc por `bg-[hsl(var(--status-idea))]` etc
- `MyTasksWidget.tsx:16-21` priority dots → idem (criar variáveis `--priority-urgent` etc, ou usar status existentes)

**Containers internos `bg-card/30-40`:**
- `BrandAssetsEditor.tsx:643` → `bg-muted/40`
- `MCPDocsTab.tsx` (10 ocorrências) → padronizar `bg-muted/40` para sub-cards informativos
- `PlatformOptionsPanel.tsx:126` → `bg-muted/40` (mais semântico que `bg-card/40`)
- `kai-global/GlobalKAIChat.tsx:262` → `bg-muted/30`

### P2 — Polish (~1h)

**Memos & callbacks:**
- `ClientList`, `MyTasksWidget` → `memo()`
- Botões inline em `ClientList.tsx` → `useCallback` na navigation
- Extrair `KPICard` memoizado em `PerformanceOverview.tsx`

**Borders nos cards primários:**
- Considerar default Card em `src/components/ui/card.tsx:6` ganhar `shadow-sm` para evitar ter que repetir em cada Card.
- `PlanningListRow.tsx:74` `border-border/30` → `border-border/60`.

**Polling:**
- `useTeamTasks` → trocar 15s por 30s.

**Code dead:**
- Confirmar se `kai/home/_legacy/*.tsx` (DynamicIdeasSection, WeekHighlights, UpcomingContent) ainda renderiza. Se não, deletar.

### P3 — Nice-to-have

- Padronizar tipografia: Documentar escala `text-[10px]` (uppercase eyebrows), `text-[11px]` (table headers), `text-xs/sm/base/lg/xl/2xl` no resto. Hoje há 503 ocorrências de `text-[Npx]` — muitos uppercase trackers tipo `text-[10px] font-mono uppercase tracking-[0.2em]`. **Recomendação:** criar utility class `.kai-eyebrow` (já existe em index.css linha 230!) e reusar. **Já está pronta** — só precisa aplicar nos lugares.
- Auditar `space-y-X` vs `gap-X` — alguns lugares mistura.
- Considerar criar hook `useStableQuery` que aplica defaults `staleTime: 30_000, placeholderData: keepPreviousData` para padronizar.

---

## Métricas finais

- **Bugs P0 visual quebrado:** 22 cards (17 performance + 5 outros)
- **Hardcoded color tokens P0/P1:** 9 lugares semânticos + 8 zinc/slate
- **Hooks sem staleTime:** 7 que afetam telas listas
- **Componentes que faltam memo:** 3 que importam (ClientList, MyTasksWidget, KPI cards)
- **Total de ocorrências `bg-card/X`:** 43 (hoje), pós-fix esperado: ~10 (só os com backdrop-blur que fazem sentido)
- **Total de ocorrências `border-border/50`:** 144 — maioria OK depois que cards forem sólidos.

---

*Gerado por design audit em 2026-05-09. Foco: Planning + Library + Performance + Home + Clients.*
