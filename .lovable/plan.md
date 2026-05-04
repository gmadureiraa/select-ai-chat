
# Lapidação — Tarefas do time

Após análise completa do board atual, do `TaskCard`, do `TaskDialog`, do hook `useTeamTasks` e do widget de dashboard, identifiquei que a base funcional está sólida, mas o design está cru (parece um MVP) e faltam vários recursos que tornariam a experiência realmente útil para um time. A proposta abaixo lapida tanto o visual (alinhado ao Linear/ClickUp já adotado em Planejamento) quanto a usabilidade.

## 1. Diagnóstico — o que está faltando hoje

**Design / UX**
- Colunas do Kanban com aparência genérica (background `muted/20`, sem hierarquia visual clara, sem accent de cor por status).
- Cards "chapados", sem indicador de prioridade lateral (faixa de cor) — padrão Linear/ClickUp.
- Sem estado de hover/foco refinado, sem sombra sutil, sem agrupamento visual entre seções.
- Header simples ("Tarefas do time" + subtítulo) sem KPIs rápidos (ex.: minhas, atrasadas, concluídas hoje).
- Filtros em linha única que quebram em telas médias e sem indicador visual de filtros ativos.
- View "Lista" hoje é só uma pilha de TaskCards — sem agrupamento por status/responsável/data.
- Calendário com células pequenas (80px), sem distinção entre tarefas atrasadas/no prazo/concluídas, sem suporte a clique no dia para criar.
- TaskDialog com layout vertical longo, sem metadata sidebar como em Linear/Notion.
- Não há empty state ilustrado quando não há tarefas no workspace.
- Não há feedback visual de drag-and-drop (apenas o estado interno `draggingId`, sem ghost/hover na coluna alvo).

**Funcionalidades faltando**
- Sem subtarefas / checklist dentro da tarefa.
- Sem comentários / histórico de mudanças.
- Sem etiquetas (labels/tags) configuráveis.
- Sem ordenação manual via drag dentro da coluna (só move entre colunas).
- Sem atalhos de teclado (`N` para nova, `Esc` para fechar, etc.).
- Sem agrupamento alternativo (por responsável, prioridade, cliente) na view Lista.
- Sem opção "Duplicar tarefa".
- Sem busca global por descrição (só título).
- Sem indicador de quem criou a tarefa.
- Widget do dashboard mostra apenas 5 e não tem "criar rápido" inline.
- Telegram/notificações: criar tarefa atribuída a alguém não dispara notificação.
- Sem persistência das preferências de view/filtro (recarrega = volta pra board+all).

## 2. Escopo da lapidação

### 2.1. Redesign visual (Linear-style consistente com Planejamento)

**Header refinado** (`TeamTasksBoard.tsx`)
- Título maior com KPIs inline em chips: `12 ativas · 3 atrasadas · 5 minhas · 2 concluídas hoje`.
- Linha de filtros separada em barra própria, com chip "Limpar filtros" quando algum filtro != default.
- Tabs de view (`Board / Lista / Calendário`) com underline animado em vez de bordered group.

**Coluna Kanban**
- Header da coluna: bolinha de cor (status) + nome + contagem em pill discreta + botão `+` que aparece no hover.
- Background da coluna: `bg-muted/10` com borda superior de 2px na cor do status (em vez do border-l-4 lateral).
- Drop zone: quando arrastando, coluna alvo ganha `ring-2 ring-primary/40` + "Solte aqui" placeholder.
- Footer da coluna: botão fantasma "+ Adicionar tarefa" sempre visível (estilo ClickUp).

**TaskCard refinado** (`TaskCard.tsx`)
- Faixa lateral esquerda de 3px com cor da prioridade (urgent=red, high=orange, medium=blue, low=transparent).
- Tipografia: título `text-sm font-medium`, descrição em 1 linha truncada (não 2).
- Footer do card em uma única linha: `[avatar] [cliente] · [data] · [labels]` — alinhado, sem wrap.
- Indicador de overdue: ponto vermelho pulsante antes da data + texto vermelho.
- Hover: leve `translateY(-1px)` + sombra sutil + borda primary/30.
- Indicador de checklist (quando houver subtarefas): `2/5` com mini progress bar.
- Indicador de comentários: ícone + número.

**TaskDialog redesenhado**
- Layout em 2 colunas: esquerda = título, descrição, checklist, comentários; direita (sidebar 220px) = Status, Prioridade, Responsável, Cliente, Data limite, Labels, Criado por, Datas.
- Metadata na sidebar como linhas `Label: valor` clicáveis (popover edita inline).
- Footer só com Cancelar/Salvar; Excluir e Duplicar movem para menu `⋯` no header.
- Atalhos: `Cmd+Enter` salva, `Esc` fecha.

**View Lista melhorada**
- Agrupamento configurável: Status (default), Responsável, Prioridade, Cliente, Data.
- Cabeçalhos de grupo colapsáveis com contagem.
- Linhas tipo "table row" densas (uma por tarefa) ao invés de cards empilhados — visual ClickUp.

**View Calendário refinado**
- Células com altura mínima maior (110px) e suporte a scroll interno.
- Tarefa colorida pela prioridade (não só pelo status).
- Clique em dia vazio abre TaskDialog pré-preenchido com aquela data.
- Toggle "mostrar concluídas" no header.

**Empty states**
- Ilustração SVG simples (ícone CheckSquare grande + mensagem + CTA "Criar primeira tarefa") quando workspace não tem nenhuma tarefa.
- Empty por coluna mais elegante (apenas dashed border + texto pequeno em vez do "Nenhuma tarefa").

### 2.2. Novas funcionalidades

**Subtarefas / Checklist**
- Nova tabela `team_task_checklist_items` (`id`, `task_id`, `content`, `is_done`, `position`, `created_at`).
- UI dentro do TaskDialog: lista com checkboxes, adicionar inline com `Enter`, drag para reordenar.
- TaskCard mostra `2/5` quando tem itens.

**Comentários**
- Nova tabela `team_task_comments` (`id`, `task_id`, `author_id`, `content`, `created_at`, `updated_at`).
- Seção no TaskDialog com lista cronológica e textarea para adicionar.
- Suporte a `@menção` reaproveitando `useMentionSearch` existente → cria notificação para o mencionado.
- Realtime via Supabase Realtime no canal da tarefa.

**Labels / Etiquetas**
- Coluna `labels jsonb default '[]'` em `team_tasks` (cada item: `{name, color}`).
- Editor de labels no TaskDialog (criar/escolher) e exibição como chips no card.
- Filtro por label no header.

**Ordenação manual dentro da coluna**
- Drag-and-drop reordena (atualiza `position`) quando soltando entre cards na mesma coluna.

**Duplicar tarefa**
- Item no menu `⋯` que copia a tarefa (sem assignee, status `todo`).

**Atalhos de teclado**
- `N` — nova tarefa (quando board focado).
- `/` — foca busca.
- `Esc` — fecha dialog.
- `Cmd/Ctrl + Enter` — salva dialog.

**Notificações**
- Trigger SQL: ao criar/atualizar `assigned_to`, gerar notificação in-app + Telegram para o usuário atribuído (reutilizando `notifications` + função existente de envio Telegram).
- Comentários com menção também notificam.

**Persistência de preferências**
- Salvar view (`board/list/calendar`), agrupamento da lista e filtros em `localStorage` por workspace (`kai:tasks:view:{workspaceId}`).

**Busca expandida**
- Buscar também em `description` e `labels[].name`.

**Widget dashboard melhorado**
- Mostrar até 7 itens.
- Botão "+" no header para criar tarefa rápida sem sair do dashboard.
- Mostrar prioridade como pontinho colorido à esquerda.

## 3. Detalhes técnicos

**Migrations** (uma única migração)
```sql
alter table public.team_tasks add column labels jsonb not null default '[]';

create table public.team_task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.team_tasks(id) on delete cascade,
  content text not null,
  is_done boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table public.team_task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.team_tasks(id) on delete cascade,
  author_id uuid not null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS espelha policies de team_tasks (visibilidade por workspace via task_id join)
-- Trigger: notify_task_assignment (insert/update assigned_to) → notifications + telegram
-- Trigger: notify_task_comment_mention → notifications
-- Realtime: alter publication add tables acima
```

**Componentes a criar**
- `src/components/tasks/TaskChecklist.tsx`
- `src/components/tasks/TaskComments.tsx`
- `src/components/tasks/TaskLabelsEditor.tsx`
- `src/components/tasks/TaskKanbanColumn.tsx` (extrair da BoardView)
- `src/components/tasks/TaskListGrouped.tsx` (substitui ListView)
- `src/components/tasks/TaskCalendarGrid.tsx` (extrair da CalendarView)
- `src/components/tasks/TaskEmptyState.tsx`
- `src/components/tasks/TaskKpisHeader.tsx`

**Hooks a criar**
- `src/hooks/useTaskChecklist.ts`
- `src/hooks/useTaskComments.ts`
- `src/hooks/useTaskKeyboardShortcuts.ts`
- `src/hooks/useTasksViewPrefs.ts` (localStorage)

**Componentes a editar**
- `TeamTasksBoard.tsx` — header com KPIs, tabs underline, filtros refinados, persistência, atalhos.
- `TaskCard.tsx` — faixa lateral de prioridade, indicadores checklist/comments/labels, hover refinado.
- `TaskDialog.tsx` — layout 2 colunas com sidebar metadata, abas Detalhes/Comentários, menu ⋯ (duplicar/excluir).
- `MyTasksWidget.tsx` — botão criar inline, prioridade visual, até 7 itens.

**Não-objetivos** (fora desta lapidação)
- Recorrência de tarefas.
- Dependências entre tarefas (blocked-by).
- Time tracking / estimate vs actual.
- Visão "Timeline/Gantt".
- Anexos de arquivos.

## 4. Resultado esperado

Uma área de Tarefas do time visualmente alinhada ao restante do kAI (Linear/Dark/density alta), com paridade funcional próxima a um Linear/ClickUp básico: subtarefas, comentários com menção, labels, atalhos, persistência de preferências, notificações automáticas e drag-and-drop completo. O dashboard ganha um widget mais ágil e o usuário consegue "viver" dentro da aba sem sentir falta dos recursos básicos de um gestor de tarefas moderno.
