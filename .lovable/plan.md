## Aba "Tarefas" + delete no card aberto

Criar uma área de **Tarefas internas** do time, separada do Planejamento (que é só para posts/conteúdo), e adicionar botão de excluir dentro do dialog do card.

### 1. Nova tabela `team_tasks` (migração)

Tarefa interna não é um post — não tem plataforma, não publica, não vai pra biblioteca. Tabela enxuta:

```text
team_tasks
- id uuid pk
- workspace_id uuid (RLS scope)
- client_id uuid nullable (tarefa pode ou não estar ligada a um perfil)
- title text
- description text
- status text default 'todo'   (todo | in_progress | done)
- priority text default 'medium' (low | medium | high)
- due_date date nullable
- assigned_to uuid nullable (profiles.id)
- created_by uuid not null
- completed_at timestamptz nullable
- position integer default 0
- created_at, updated_at
```

RLS: membros do workspace podem ler/criar/editar; deletar restrito a owner/admin/criador (mesmo padrão dos planning_items).

### 2. Nova aba "Tarefas" no menu lateral

Em `KaiSidebar.tsx`, adicionar `NavItem` com ícone `CheckSquare` logo abaixo de "Planejamento". Disponível para todos os roles (até viewer pode ver, mas só edita se `canModifyData`).

Em `Kai.tsx`:
- Adicionar `tab === "tasks"` que renderiza `<TeamTasksBoard workspaceId={...} clientId={selectedClient?.id} />`.
- Tasks NÃO exigem cliente selecionado (são do time inteiro).

### 3. Componente `TeamTasksBoard` (nova pasta `src/components/tasks/`)

Estilo Linear/dark, alinhado ao resto do app:

- **Header**: título "Tarefas do time", filtros (Todos / Minhas / Atribuídas a alguém / por cliente opcional), botão "+ Nova tarefa".
- **3 visualizações** via `ViewToggle` reaproveitado:
  - **Kanban** (3 colunas: A fazer · Em andamento · Concluído) — drag-and-drop muda status.
  - **Lista** — linha por tarefa, checkbox para concluir inline.
  - **Calendário** — tarefas com `due_date` em grid mensal.
- **Card** mostra: título, avatar do responsável, prioridade (cor), due date (vermelho se atrasada), nome do cliente se houver.
- **Dialog `TaskDialog`**: título, descrição (textarea simples, sem editor rico — não precisa), status, prioridade, due date, responsável (lista de membros do workspace via `useTeamMembers`), cliente opcional (dropdown de `useClients`), e **botão "Excluir tarefa"** no rodapé.

Hook `useTeamTasks(filters)` espelha o padrão de `usePlanningItems`: queries com React Query, mutations create/update/delete, realtime via canal `team_tasks:workspace_id=...`.

### 4. Tasks no Dashboard de cada um

No `HomeDashboard.tsx`, adicionar bloco **"Suas tarefas"** abaixo do card de "Hoje" / próximas publicações:

- Lista as próximas 5 tarefas onde `assigned_to = user.id` e `status != 'done'`, ordenadas por due_date (atrasadas no topo, em vermelho).
- Cada item: checkbox para concluir, título, due date, badge de prioridade.
- Clicar abre o `TaskDialog` (mesmo dialog do board).
- Link "Ver todas →" navega para `tab=tasks`.

Também adicionar contadores no topo do dashboard: "X tarefas pendentes · Y atrasadas".

### 5. Botão "Excluir" no dialog do card (Planejamento)

Em `PlanningItemDialog.tsx`, no rodapé adicionar botão `Trash2` "Excluir" (variant ghost destructive, à esquerda dos botões de ação) que:

- Mostra `AlertDialog` de confirmação ("Excluir este card? Esta ação não pode ser desfeita.").
- Chama `deleteItem.mutate(itemId)` (já existe em `usePlanningItems`).
- Fecha o dialog ao concluir e mostra toast de sucesso.

Permissão: visível só se `canModifyData` ou `created_by === user.id`. Bloqueado para viewer.

### Arquivos novos
- `supabase/migrations/<timestamp>_team_tasks.sql` (tabela + RLS + trigger updated_at + realtime publication)
- `src/hooks/useTeamTasks.ts`
- `src/components/tasks/TeamTasksBoard.tsx`
- `src/components/tasks/TaskCard.tsx`
- `src/components/tasks/TaskDialog.tsx`
- `src/components/tasks/TaskKanban.tsx`
- `src/components/tasks/TaskList.tsx`
- `src/components/tasks/TaskCalendar.tsx`
- `src/components/tasks/index.ts`

### Arquivos editados
- `src/components/kai/KaiSidebar.tsx` (NavItem "Tarefas")
- `src/pages/Kai.tsx` (case "tasks" no switch)
- `src/components/kai/home/HomeDashboard.tsx` (bloco "Suas tarefas")
- `src/components/planning/PlanningItemDialog.tsx` (botão Excluir + AlertDialog)

### Fora de escopo
- Subtarefas / checklists dentro de uma tarefa
- Comentários em tarefas (pode vir depois reusando `usePlanningComments`)
- Notificações Telegram de tarefas (pode vir depois reusando o trigger de assignment)
- Recorrência de tarefas
