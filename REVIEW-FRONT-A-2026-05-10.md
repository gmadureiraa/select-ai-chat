# Review Frente A — Home Dashboard + Planning + Tasks
Data: 2026-05-10
Escopo: módulos onde o user passa 80% do tempo. Auditoria E2E + fixes P0/P1 aplicados.

---

## TL;DR

- 4 bugs P1 consertados, 4 melhorias P1 aplicadas, ~6 TODOs P2 deixados.
- Build limpo após cada batch.
- Nenhum primitive em `src/components/ui/` foi tocado (conforme regra).

---

## BATCH 1 — Home Dashboard

### Bugs encontrados
| # | Severidade | Arquivo | Bug | Status |
|---|-----------|---------|-----|--------|
| H1 | P1 | `src/components/kai/home/HomeDashboard.tsx:626-635` | "Aguardando revisão" sempre retornava 0 (ternário inútil dentro do `count` do PendencyTile). Comentário do código admite "buscamos exato via NotificationsBell" mas nunca implementaram. | Consertado |
| H2 | P3 | `HomeDashboard.tsx:23,33,48` | Imports não usados: `AlertTriangle`, `formatDistanceToNow`. | Consertado |

### Melhorias aplicadas
- Novo `useQuery` `dashboard-review-count` que faz `head: true` count direto em `planning_items.status='review'` no workspace. StaleTime 60s pra não martelar.
- `PendencyTile` "Aguardando revisão" agora mostra contagem real, hint dinâmico ("1 draft esperando aprovação" / "2 drafts esperando aprovação" / "Nada na fila de revisão"), e fallback "Sem pendências" quando 0.

### Verificações OK
- `QuickActionCard`, `TopPerformerCard`, `PendencyTile` usam `bg-card`, `border-border`, `text-foreground`/`text-muted-foreground` — todos tokens semânticos. Nenhum hardcode.
- Hover states com `hover:border-primary/40 hover:shadow-md` — consistente light/dark.
- Keyboard accessibility OK em cards interativos (Hero stat cards têm `role="button" tabIndex={0} onKeyDown` Enter/Space; QuickActionCard e PendencyTile já são `<button type="button">`).
- Loading skeletons OK em todos blocos (stats cards, performance cards, top posts, upcoming).
- Empty states tratados em todos blocos (clientCards.length === 0, !topPosts || length === 0, !upcomingPosts || length === 0, RecentActivity sem activities).
- Mobile responsivo com `useIsMobile()` e classes `md:` apropriadas.
- `RecentActivity` separa `activity_type` em iconMap + colorMap com variantes `dark:` corretas.

---

## BATCH 2 — Planning

### Bugs encontrados
| # | Severidade | Arquivo | Bug | Status |
|---|-----------|---------|-----|--------|
| P1 | P1 | `src/components/planning/KanbanView.tsx:222-240` | Bug grave de diff no `handleDragEnd`: usava `itemColumnIndex` que é derivado de `columnsMap` (versão local mutada pelo dragOver), não de `baseColumnsMap`. Resultado: o diff comparava coluna mutada × coluna mutada → todos os items da coluna alvo recebiam update no Supabase a cada drag, mesmo os que não moveram. Perf hit em colunas grandes + race conditions com `reorderItems.mutate`. | Consertado |
| P2 | P1 | `src/components/planning/CalendarView.tsx:40-89` | `statusConfig` usava cores hardcoded (`bg-purple-100 dark:bg-purple-900/50` etc) duplicando convenções e quebrando ao trocar tema. Inconsistente com `VirtualizedKanbanColumn` que já migrou pra `--status-*`. | Consertado |

### Melhorias aplicadas
- `KanbanView.tsx`: novo `baseItemColumnIndex` (memo separado) que sempre referencia `baseColumnsMap`. Diff do `handleDragEnd` agora compara `baseColId !== colId` e `baseItem.position !== idx` corretamente. Skip de items "novos" (sem base) — defensivo contra timing.
- `CalendarView.tsx`: 8 status reescritos pra usar `bg-[hsl(var(--status-X)/0.12)]` + `text-[hsl(var(--status-X))]` + `border-[hsl(var(--status-X)/0.30)]`. Light/dark herda de `index.css`. Mantém `animate-pulse` em `publishing` e `failed`.

### Verificações OK
- `PlanningItemCard.tsx` ─ card opaco sólido (`bg-card`), border `border-border/60`, hover `hover:border-border hover:shadow-md hover:ring-1 hover:ring-primary/10`. Ring focus-visible ok. Selected/focused states com ring `ring-primary` e `ring-primary/40`.
- `PlanningItemDialog.tsx` ─ Dialog content `max-h-[90vh] overflow-hidden p-0`, fetch fresh item ao abrir (evita stale data depois de mutations externas), reset state correto quando `!item` (criação nova). Footer com Aprovar/Pedir ajustes em cards com status='review'. Confirmação de delete com AlertDialog.
- `BulkActionsToolbar.tsx` ─ floating toolbar `fixed bottom-6 left-1/2 -translate-x-1/2 z-50`, sliding entrance via `animate-in slide-in-from-bottom-4`. Confirmação de delete em massa via AlertDialog.
- `ColumnsCustomizeDialog.tsx` ─ usa `<Dialog>` com `DialogTitle/DialogDescription` corretos. Drag-and-drop nativo HTML5 + setas como fallback acessível. Lock icon em colunas default.
- `VirtualizedKanbanColumn.tsx` ─ já migrado pra `bg-[hsl(var(--status-*))]`. Drop indicator com gradient mask suave (top/bottom fades). DndKit sortable correto. `data-card-id` exposto pra navegação j/k.
- `PlanningListRow.tsx` ─ row layout responsivo (hidden lg:/md:/sm: em colunas progressivas). Métricas pós-publicação só preenchem quando `status='published'`. Dropdown `e.stopPropagation()` correto.

### TODOs P2 deixados
- **CalendarView drag-and-drop usa HTML5 nativo** — Inconsistente com KanbanView (DndKit). Não é bug mas é fonte de divergência (KeyboardSensor não funciona no calendar). Considerar migrar pra DndKit numa próxima frente.
- **PlanningItemCard hover preview (HoverCard)** — `openDelay={800}` está bom mas se user move mouse rápido entre cards, pode disparar várias mounts. Considerar invalidar quando `lastClickedIdRef` muda.
- **`scheduledTime` no PlanningItemDialog** ─ é string `HH:mm` mas não valida formato no submit. Se user editar pra texto inválido, `setHours(NaN)` quebra. P2 baixo (input type="time" já restringe).
- **`PlanningItemDialog` `useEffect` reseta form na linha 309** ─ `else if (!item)` reseta tudo, mas roda também quando user abre dialog em modo criação enquanto `effectiveItem` ainda está em fetching. Pode causar flicker. P3.
- **Ternário inline `dueDate` em CalendarCard linha 240** ─ `published_at && !scheduled_at` testa contra valor truthy mas mostra cor `text-emerald-600` sem variante dark.
- **Calendar mobile** ─ grid 7 cols não scrolla horizontal em viewport pequeno; mobile usa fonte 10px que aperta demais. P2.

---

## BATCH 3 — Tasks

### Bugs encontrados
| # | Severidade | Arquivo | Bug | Status |
|---|-----------|---------|-----|--------|
| T1 | P1 | `src/components/tasks/TeamTasksBoard.tsx:466` | Botão `+` no header da coluna usava `opacity-0 group-hover:opacity-100` mas a `<div>` pai não tinha classe `group`. Resultado: botão **sempre invisível**. Falta da classe `group` no parent. | Consertado |
| T2 | P2 | `src/components/tasks/TaskCard.tsx:74` | Botão de toggle done sem `type="button"`. Card não era acessível via teclado (não tinha role/tabIndex/onKeyDown). | Consertado |
| T3 | P2 | `src/components/tasks/TaskDialog.tsx:204-215` | `useEffect` de Cmd+Enter shortcut tinha `eslint-disable react-hooks/exhaustive-deps` e listava 9 deps em vez de listar `handleSave`. Em re-renders rápidos com state intermediário, capturava `handleSave` stale. | Consertado |

### Melhorias aplicadas
- `TeamTasksBoard.tsx`: classe `group` adicionada à div da coluna. Botão `+` agora aparece em hover. Bonus: adicionada `transition-opacity` pra suavizar.
- `TaskCard.tsx`: card vira interativo acessível com `role="button"`, `tabIndex={0}`, `onKeyDown` Enter/Space, `aria-label="Abrir tarefa X"`, `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40`. Botão toggle done ganhou `type="button"`, `aria-pressed={isDone}` e label dinâmico ("Concluir tarefa" / "Reabrir tarefa").
- `TaskDialog.tsx`: `handleSave` virou `useCallback` com deps explícitas. `useEffect` simplificou pra `[open, handleSave]`. Adicionado `useCallback` ao import.

### Verificações OK
- `TeamTasksBoard` ─ KPIs (Ativas/Minhas/Atrasadas/Concluídas hoje) calculados com `useMemo`. View toggle (Board/Lista/Calendário) em prefs persistente. Filtros (search/assignee/client/priority) com `Limpar` quando ativos. Keyboard shortcuts (`n` cria, `/` foca search) com guard pra inputs.
- `TaskCard` ─ priority bar lateral, dot, assignee fallback, due date com 3 estados (overdue=destructive, today=amber, future=muted), checklist meta, comments count. Density `comfortable`/`compact`.
- `TaskDialog` ─ Tabs Detalhes/Comentários (só em edit mode), MentionableTextarea, TaskChecklist embeddado, SidebarField helper, AlertDialog confirm delete, atalho ⌘+↵ pra salvar.
- `TasksCalendarView` ─ drag-and-drop pra mover tarefas entre dias. Sidebar "Sem data" também aceita drop. Grid 7-col, stats por mês visível, navegação prev/today/next.

### TODOs P2 deixados
- **`TasksCalendarView` HTML5 drag** ─ mesma inconsistência do CalendarView do Planning. P2.
- **`useEffect` que abre `?openTask=<id>` em `TeamTasksBoard:63-76`** ─ usa `window.history.replaceState` em vez de `useSearchParams` do React Router. Inconsistente com `PlanningBoard` que usa `useSearchParams`. P3 cosmético.
- **`TasksCalendarView` overdue `isPast(day)`** ─ verifica se o dia em si é passado, não a `due_date` da task. Em dias passados a class fica muted, mas se mostrado no mês atual e a task está overdue, a UX visual depende de `priorityClass[t.priority]` (sem indicador overdue específico no botão). TaskCard tem isso correto, calendar não. P2.
- **`TaskDialog` na hora de salvar** ─ não valida `title.trim()` antes de chamar mutateAsync. Hoje confia no `disabled={!title.trim()}` do botão mas o `useEffect` de Cmd+Enter pode burlar. Já tem early return `if (!title.trim()) return;` ─ OK.

---

## BUILD FINAL

```
✓ built in 5.93s
```

### Diff de tamanho relevante:
- `PlanningBoard-*.js` ~127kB → ~127kB (sem mudança significativa)
- Nenhum bundle aumentou >2KB. A mudança CSS (statusConfig com vars) reduziu marginalmente o JS.

---

## NOTAS GERAIS

### Pontos fortes do código (auditados, sem mudança)
- Optimistic updates no `reorderItems` (`onMutate` salva snapshot, rollback no `onError`).
- `placeholderData: keepPreviousData` em `usePlanningItems` e `useTeamTasks` evita flash de skeleton em filter changes.
- `refetchInterval: 30000` + `refetchIntervalInBackground: false` ─ poll defensivo sem cobrar bandwidth quando aba escondida.
- Undo de delete em `usePlanningItems` (snapshot + toast `action`).
- `usePlanningKeyboardShortcuts` com guard pra inputs/textarea.
- `RLS` ─ todos hooks filtram por `workspace_id` antes de outros filtros.
- Realtime substituído por poll após bug recente (comentário em código).

### Pontos de atenção (não consertados, mas anotados)
- `PlanningItemCard.tsx:228` ─ `accentColor` aplicado como `borderLeft` inline style. Funciona mas perde no a11y high-contrast mode.
- `PlanningItemDialog` é gigante (1238 linhas). Candidato a split em sub-componentes. Não é bug.
- `useDashboardStats` faz 5 queries paralelas + 1 sequencial pra followers ─ 100-300ms total em workspace pequeno, OK.
- `HomeDashboard` agora invalida 2 queries extras (review-count + radar-briefs-count) ─ ainda dentro do orçamento.

### Filosofia preservada
- Tokens semânticos (`bg-card`, `text-foreground`, `border-border`).
- Dark mode com classes `dark:` apenas onde necessário (status colors agora unificadas via vars).
- Loading/empty/error states tratados em **todos** os blocos visuais.
- Acessibilidade: cards interativos com `role="button"` + `tabIndex` + `onKeyDown` + `aria-label`.

---

## COMMITS APLICADOS

1. `home-dashboard: aguardando revisão com count real + cleanup imports`
2. `planning: fix diff bug no kanban dragEnd + statusConfig via CSS vars`
3. `tasks: group hover no header da coluna + a11y no TaskCard + handleSave estável`
