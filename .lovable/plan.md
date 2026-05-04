
# Lapidação: Planning · Tarefas · Dashboard · Menções · Notificações

Foco do usuário (respostas do questionário):
- **Frentes:** Planning + Tarefas/Dashboard + Notificações
- **"Marcas":** quis dizer **menções @membro em tarefas** (não ACL por marca)
- **Notificações:** falta preferências por canal/tipo
- **Dashboard:** mix dos 3 focos com seções colapsáveis

---

## 0. Bug crítico (corrigir antes de tudo)

A migração `20260504135451` que criou `team_task_comments` e `team_task_checklist_items` **nunca foi aplicada** no banco — verifiquei via SQL e as tabelas não existem. Isso significa que comentários e checklist da última lapidação estão **quebrados em produção** (toda chamada retorna erro 404 silencioso).

- Reaplicar a migração (criar nova com mesmo conteúdo, idempotente, `IF NOT EXISTS`)
- Garantir RLS, policies e índices
- Habilitar realtime nas duas tabelas

---

## 1. Menções @membro em tarefas (real, não regex)

Hoje `TaskComments.tsx` faz parse por regex no primeiro nome — frágil, quebra com nomes iguais e não popula sugestões.

- Criar `MentionableTextarea.tsx` reutilizando lógica do `MentionableInput.tsx` do planning (autocomplete de membros do workspace)
- Usar em **comentários de tarefa** e em **descrição de tarefa**
- Salvar `mentions: uuid[]` corretamente baseado nos IDs selecionados (não no texto)
- Renderizar menções como pílulas clicáveis (`@Nome` → abre perfil/filtra tarefas dessa pessoa)
- Disparar notificação `mention` (tipo já existe no enum) ao mencionar — com link direto pra tarefa

## 2. Notificações: tipo `task_*` + link direto + preferências

Hoje só existem tipos para planning. Tarefas não notificam nada.

- Adicionar tipos: `task_assigned`, `task_mention`, `task_due_soon`, `task_comment`
- Trigger SQL em `team_tasks` (insert/update de `assigned_to`) → cria notification com `entity_type='team_task'`
- Trigger SQL em `team_task_comments` (insert) → notifica autor da tarefa + `mentions[]`
- Cron diário 8h BRT: tarefas com `due_date = today+1` e status ≠ done → `task_due_soon`
- `NotificationBell.handleNotificationClick`: adicionar branch `entity_type === 'team_task'` → `?tab=team-tasks&openTask=<id>`
- `TeamTasksBoard`: ler `?openTask=` da URL e abrir o dialog automaticamente

### Preferências de notificação (nova tela)
Tabela `notification_preferences` (não existe ainda):
```
user_id, workspace_id,
in_app: { assignment, mention, due_date, publish_*, task_*, automation_completed }
push:   { mesmo conjunto }
telegram: { mesmo conjunto }
```
- Página em `Settings > Notificações` com toggles por tipo × canal (matriz)
- Cada disparador checa preferência antes de criar notificação/push/telegram
- Default: tudo `in_app=on`, `push=off`, `telegram=on`

### Polish do sino
- Agrupar por dia ("Hoje", "Ontem", "Esta semana")
- Filtro por tipo (chips no topo: Tudo / Tarefas / Conteúdo / Sistema)
- Ação "Marcar como lida" inline (hover) — hoje só tem "marcar todas"
- Aumentar altura do scroll de 300px → 480px
- Badge de contagem por tipo

---

## 3. Tarefas — refinamentos

- **MentionableTextarea** em descrição (item 1)
- **Drag & drop** com biblioteca decente (`@dnd-kit/core`) — o atual é HTML5 nativo, sem feedback visual entre cards
- **Reordenação dentro da coluna** (atualizar `position`) — hoje só move entre status
- **Atalhos** adicionais: `E` edita selecionada, `Del` exclui, `1/2/3` muda status
- **Empty state** das colunas: hoje só mostra spinner; adicionar "Arraste tarefas pra cá" + botão "+"
- **Vencimento** — calcular "Hoje", "Amanhã", "Em 3 dias" no card (em vez de só data)
- **Quick edit** inline no board (clicar no título edita sem abrir dialog)

## 4. Dashboard (Home) — mix com seções colapsáveis

Hoje é uma parede gigante de informação. Reorganizar em **3 seções colapsáveis** (estado salvo em localStorage):

```text
┌─ Operacional do dia ─────────────────────────┐  [aberta default]
│  · Minhas tarefas (MyTasksWidget)            │
│  · Posts pendentes hoje                      │
│  · Atrasos (planning + tarefas unificados)   │
└──────────────────────────────────────────────┘
┌─ Aprovações & Bloqueios ─────────────────────┐  [colapsada se vazio]
│  · Posts em review aguardando você           │
│  · Tarefas atribuídas a você sem ação 3+ dias│
│  · Tarefas vencendo amanhã                   │
└──────────────────────────────────────────────┘
┌─ Visão geral (gerencial) ────────────────────┐  [colapsada default]
│  · KPIs agregados de todas marcas            │
│  · Pipeline por status                       │
│  · Timeline semanal                          │
└──────────────────────────────────────────────┘
```

- Atrasos unificados: planning + team_tasks no mesmo bloco
- "Tarefas atribuídas a mim" subir pra topo (já tem `MyTasksWidget` mas perdido no meio)
- Cabeçalho com saudação fica, mas mais compacto
- Ações rápidas: "Nova tarefa", "Novo post" (botões no header)

## 5. Planning — polimento alvo

- **Calendário:** botão "Hoje" + atalho `T` (zera para data atual)
- **Kanban:** indicador de "tem mais X items" quando coluna tem scroll oculto
- **Filtros:** persistir no localStorage por workspace (igual `useTasksViewPrefs`)
- **Bulk actions:** seleção múltipla na lista (shift-click) → mover status / atribuir / excluir em massa
- **MentionableInput:** já existe; garantir que dispara notification `mention` ao salvar (verificar trigger atual)

---

## Detalhes técnicos

### Migrations
1. **Reaplica** `team_task_comments` e `team_task_checklist_items` (idempotente)
2. **Cria** `notification_preferences` com defaults
3. **Adiciona** tipos `task_assigned`, `task_mention`, `task_due_soon`, `task_comment` ao check constraint de `notifications.type`
4. **Triggers:**
   - `notify_on_task_assignment()` em `team_tasks` AFTER INSERT/UPDATE
   - `notify_on_task_comment()` em `team_task_comments` AFTER INSERT (autor + mentions)
   - `notify_on_task_mention_in_description()` em `team_tasks` (parse mentions field — adicionar `mentions uuid[]`)
5. **Cron:** edge function `notify-task-due-soon` agendado diário 8h BRT
6. Habilitar realtime em `team_task_comments`, `team_task_checklist_items`, `notification_preferences`

### Frontend
- Novo: `src/components/tasks/MentionableTextarea.tsx` (extraído do `MentionableInput`)
- Novo: `src/components/settings/NotificationPreferencesMatrix.tsx`
- Novo: `src/hooks/useNotificationPreferences.ts` (já existe — ampliar)
- Refator: `src/components/kai/home/HomeDashboard.tsx` — split em 3 seções com `<Collapsible>` (shadcn)
- Refator: `src/components/notifications/NotificationBell.tsx` — agrupamento + filtros
- Refator: `src/components/tasks/TeamTasksBoard.tsx` — `@dnd-kit`, reordenação, atalhos extras, `?openTask=`
- Refator: `src/components/tasks/TaskComments.tsx` e `TaskDialog.tsx` — usar `MentionableTextarea`

### Memória a atualizar
- `mem://features/notifications/preferences-matrix` — nova
- `mem://features/tasks/mentions-and-notifications` — nova
- `mem://features/planning/home-operational-dashboard` — atualizar com seções colapsáveis

---

## Ordem de execução (3 ondas)

**Onda 1 — Crítico + Notificações de tarefa**
0. Reaplica migração de `team_task_*`
1. Tipos `task_*` + triggers + bell handler + `?openTask=`
2. Cron `task_due_soon`

**Onda 2 — Menções e UX de tarefas**
3. `MentionableTextarea` em comentários e descrição
4. Drag & drop com `@dnd-kit`, reorder, atalhos, quick-edit

**Onda 3 — Dashboard + Preferências + Planning polish**
5. Dashboard reorganizado em 3 seções colapsáveis
6. Tela de preferências de notificação (matriz tipo × canal)
7. Planning: bulk actions, persistência de filtros, atalho "T"

Cada onda é entregável independentemente — posso parar entre elas se quiser revisar.
