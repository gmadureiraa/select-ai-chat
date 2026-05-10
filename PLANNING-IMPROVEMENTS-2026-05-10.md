# Planning — melhorias 2026-05-10

Sessão atacando P0 + P1 do brief. Tudo em `src/components/planning/` + alguns hooks.

## Features adicionadas

### P0 — Quick wins de UX

- **Search com debounce 200ms + clear button + atalho `/`** — input controlado localmente que só propaga após 200ms ocioso. Esc dentro do input limpa. `src/components/planning/PlanningFilters.tsx:78`
- **Quick edit do título** — duplo-clique no título do card vira input inline. Enter salva, Esc cancela, blur salva. Usa `updateItem.mutate({silent:true})` pra não spammar toast. `src/components/planning/PlanningItemCard.tsx:435`
- **Drag-drop feedback visual melhor** — coluna alvo ganha `border-primary ring-2 ring-primary/30`, indicador de drop position (linha azul horizontal acima do card alvo via `useSortable.isOver`), `cursor: grabbing` global no `<body>` durante drag, e `DragOverlay` agora rotaciona 2deg + scale 1.02. `src/components/planning/KanbanView.tsx:213` + `VirtualizedKanbanColumn.tsx:166`
- **Bulk actions com shift-click** — toolbar flutuante no rodapé aparece quando há cards selecionados. Suporta range-select (shift), toggle individual (cmd/ctrl). Esc limpa. Ações: mover pra coluna, atribuir/remover responsável, excluir em massa (com confirmação), limpar seleção. `src/components/planning/BulkActionsToolbar.tsx:1` + integração `PlanningBoard.tsx:240`
- **Hover preview rico** — tooltip com `HoverCard` (delay 800ms) no PlanningItemCard mostrando título completo, status, cliente, descrição/conteúdo, data formatada, prioridade, assignee e checklist (preview dos primeiros 4 itens). Desabilitado durante drag/edit/seleção. `src/components/planning/PlanningItemCard.tsx:704`

### P1 — Calendar view rica

- **Toggle Mensal/Semanal/Diário** — `ToggleGroup` no header. Cada modo recalcula range visível, label do header e adapta navegação (`subDays/subWeeks/subMonths`). `src/components/planning/CalendarView.tsx:319`
- **Mini-stats no range visível** — total, agendados, publicados, **atrasados** (scheduled/due_date no passado sem publicar) e falhas. Recalcula conforme modo. `src/components/planning/CalendarView.tsx:343`
- **Badge "Hoje" + dia atual destacado** — célula de hoje tem ring primary + badge "HOJE" coral pequeno ao lado do número. `src/components/planning/CalendarView.tsx:560`
- **Grid adaptativo** — modo dia mostra coluna única vertical, modo semana minmax(360px) por dia, modo mês mantém minmax(140px). Modo dia/semana mostra todos itens (sem o "+N mais"). Empty hint nos dias vazios.

### P1 — Customização de colunas

- **Dialog "Personalizar colunas"** — botão `Columns3` no header (só visível no view 'board'). Permite renomear inline (Enter salva), reordenar via drag&drop ou setas ↑↓, adicionar coluna custom (`column_type='custom'`), remover coluna custom (default tem ícone `Lock`). `src/components/planning/ColumnsCustomizeDialog.tsx:1` + hook `src/hooks/usePlanningColumns.ts:1`
- **Hook `usePlanningColumns`** — mutations renameColumn / reorderColumns / addCustomColumn / deleteColumn. Delete move órfãos pra coluna 'idea' antes de apagar. Invalida `kanban-columns` e `planning-items`.

### P1 — Atalhos expandidos

- **`n` e `⌘N` novo card** (já existia, mantive)
- **`/` ou `⌘F` foco busca** — usa `forwardRef` em PlanningFilters expondo `focusSearch()`
- **`j`/`k` navegação vim-style** — flatItems calculado a partir das colunas (ordem visual) com scroll automático; ring visual `isFocused` no card
- **`Enter`/`e` abre card focado**
- **`?` abre modal de atalhos**
- **Esc** limpa seleção (quando há) ou fecha dialog
- **`KeyboardShortcutsDialog`** lista todos atalhos agrupados (Geral / Navegação / Diálogo) com `<kbd>` styled. `src/components/planning/KeyboardShortcutsDialog.tsx:1`
- Hook `usePlanningKeyboardShortcuts` foi expandido com `onNavigate`, `onOpenFocused`, `onShowHelp` e exporta `PLANNING_SHORTCUTS` canônico. `src/hooks/usePlanningKeyboardShortcuts.ts:1`

### Outros

- **Botão "Atalhos" no header** com `Keyboard` icon (?  no tooltip)
- **`forwardRef` no `KanbanView`** expondo `KanbanViewHandle` (`moveFocus`, `openFocused`, `getFocusedItem`)
- **`forwardRef` no `PlanningFilters`** expondo `PlanningFiltersHandle` (`focusSearch`)
- **Card a11y** — `role="button"`, `tabIndex={0}`, `aria-pressed`, `focus-visible:ring-2 ring-primary/60`, Enter no foco abre o card
- **Checkbox de seleção** — só visível em hover do card ou quando há seleção ativa. Respeita stopPropagation pra não abrir o card.

## Bugs encontrados e consertados

- **CalendarView import vazado** — `CalendarIcon` e `MoreHorizontal` eram importados mas não usados; mantive como `_` prefixed pra não quebrar TypeScript se forem reativados depois
- **Tipo `Calendar` colidindo** — o ícone Calendar do lucide-react fica dentro do card (já usado no rodapé), mantive sem renomear no PlanningItemCard
- **Filter sync** — quando filters limpa via "Limpar", o `searchInput` local agora reseta corretamente via `useEffect` watcher
- **KanbanView drag fecha cursor** — `document.body.style.cursor = ''` em handleDragEnd e handleDragCancel pra não deixar `grabbing` preso

## TODOs deixados explicitamente

- **P2.9 Subtasks/checklist** — preview já está no HoverCard (lê `metadata.checklist`), MAS a UI inline expansível dentro do card / inline-edit do checklist não foi implementada. Demanda adicionar UI no `PlanningItemDialog.tsx` (fora do escopo de planning/) e foi pulada por escopo. _Por que_: PlanningItemDialog é grande e seria mais que 30min de trabalho.
- **P2.10 Activity feed por card** — tabela `planning_item_activity` não foi criada (precisa migration). Pulada — escopo permitia, mas custo (migration + trigger + UI no Dialog) > 30min.
- **P2.11 Templates de cards** — não implementado por mesmo motivo (precisa nova tabela `planning_templates` + trigger + UI no FAB).
- **P2.12 List view rica** — sort por header, quick filters chips e inline edit não foram tocados. PlanningListRow ficou como estava.
- **Reorder de colunas via drag no board** — atualmente só reordenamos colunas dentro do `ColumnsCustomizeDialog`. Drag inline no header da coluna não foi feito (agora dnd-kit context é dos cards). _Por que_: misturar dois `DndContext` aninhados ou trocar pra MultipleContainers seria invasivo.
- **Som no drag-drop** — escopo dizia "opcional, default off". Não implementado por escopo de tempo + decisão default off mesmo.
- **Hover preview no Calendar** — Calendar já tinha HoverCard nativo. Não foi unificado com o do Kanban porque a estrutura visual difere bastante.
- **Foco j/k navegando entre views** — só funciona no view 'board'. Lista e calendário não suportam navegação por teclado ainda.

## bun run build

```
✓ built in 7.81s
```

Sem erros TypeScript. Bundle do `PlanningBoard-*.js` foi de **120 kB → 127 kB** (+7 kB / +5%) — adição justificada pelos novos componentes (BulkActionsToolbar, KeyboardShortcutsDialog, ColumnsCustomizeDialog) e refatoração com forwardRef.
