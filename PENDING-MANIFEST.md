# Pendências de manifest pro Backend agent — KAI Tasks/Planning fix wave

> Criado em 2026-05-16 pelo agente de Projetos Pessoais durante o fix de Tasks/Planning/Calendar/Notifications.
> Esses são edits em `vercel.json` que precisam do Backend agent aplicar.
> O agente atual NÃO edita `vercel.json` nem `handler-manifest.ts` por contrato — só anota aqui.

## 1. Cron `process-scheduled-posts` precisa rodar a cada 5 minutos

**Hoje:**
```json
{
  "path": "/api/process-scheduled-posts",
  "schedule": "0 12 * * *"
}
```

**Mudar pra:**
```json
{
  "path": "/api/process-scheduled-posts",
  "schedule": "*/5 * * * *"
}
```

**Por quê:** Cron 1x/dia às 12 UTC (9h BR) faz qualquer post agendado fora da janela 9h-15h BR expirar silenciosamente (`status=failed` por `SCHEDULED_POST_MAX_LAG_MINUTES=360`). Posts dentro da janela publicam até ~24h depois. Audit completo em `vault/01 - KALEIDOS/012 - INTERNO/02 - PROJETOS/KAI/audit-2026-05-16/tasks-planning-calendar.md` bug #1.

⚠️ **Antes de aplicar:** garantir que `process-scheduled-posts.ts` use `FOR UPDATE SKIP LOCKED` no SELECT de pickup, ou seja idempotente, pra evitar double-publish quando 2 invocations correm em paralelo (cron 5min + retry).

---

## 2. Cron novo: `process-push-queue` a cada 5 minutos

**Hoje:** Não está no `vercel.json`. Fila `push_notification_queue` empilha rows e **nunca drena**. Push notifications nunca chegam ao dispositivo.

**Adicionar:**
```json
{
  "path": "/api/process-push-queue",
  "schedule": "*/5 * * * *"
}
```

**Verificar antes de aplicar:** o handler `api/_handlers/process-push-queue.ts` aceita GET (cron envia GET). Se rejeitar 405, ajustar handler também.

---

## 3. Cron novo: `process-email-notifications` a cada 5 minutos

**Hoje:** Não está no `vercel.json`. Mesma fila empilhando — `email_notification_queue`. Nenhum email transacional sai.

**Adicionar:**
```json
{
  "path": "/api/process-email-notifications",
  "schedule": "*/5 * * * *"
}
```

**Verificar antes de aplicar:** handler aceita GET.

---

## 4. (Sugestão) Cron `send-publish-reminders` aumentar pra 2x/dia

**Hoje:** `0 9 * * *` (1x/dia 9 UTC = 6h BR).

**Sugestão:** `0 9,17 * * *` (manhã e tarde).

Não-bloqueante — já corrigi o bug do 405 no handler (aceitar GET). Schedule fica a critério do Backend agent.

---

## 5. (Sugestão) `process-due-date-notifications` rodar 2x/dia

**Hoje:** `30 9 * * *` (1x/dia).

**Sugestão:** `0 9,15 * * *` (cobre quem ajusta tarefa durante o dia).

Não-bloqueante.

---

## Resumo do que precisa entrar no `vercel.json` crons array

```json
{
  "path": "/api/process-scheduled-posts",
  "schedule": "*/5 * * * *"
},
{
  "path": "/api/process-push-queue",
  "schedule": "*/5 * * * *"
},
{
  "path": "/api/process-email-notifications",
  "schedule": "*/5 * * * *"
}
```

⚠️ Vercel Hobby tem limite de 2 crons. Se o projeto estiver no Hobby, precisa upgrade pra Pro (que permite cron-per-minute granularity). Verificar plano antes de aplicar.

---

## Fixes complementares JÁ APLICADOS pelo agente Tasks/Planning

- `api/_handlers/send-publish-reminders.ts` — aceita GET (cron-only check via `x-vercel-cron`).
- `api/_handlers/process-recurring-content.ts` — passa `Authorization: Bearer ${CRON_SECRET}` no callInternal pra AI gen funcionar.
- `api/_handlers/send-push-notification.ts` — diferencia exception (mantém subscription) de 404/410 (deleta). Usa helper compartilhado `sendWebPush` que retorna `{success, statusCode, error}`.
- Migration nova `0041_notifications_add_link_column.sql` — adiciona coluna `link text` em `notifications` pros triggers `notify_team_task_*` funcionarem.
- Migration nova `0042_drop_legacy_team_task_assignment_trigger.sql` — droppa `trg_notify_team_task_assignment` legado pra evitar duplicação de notif.
- Migration nova `0043_scheduled_posts_consolidate.sql` — adiciona colunas faltantes na tabela `scheduled_posts` antiga (`workspace_id`, `external_post_id`, `retry_count`, `media_urls`, `metadata`, `external_post_id`).
- Migration nova `0044_task_due_date_notifications.sql` — função `create_task_due_date_notifications()` que processa `team_tasks.due_date` e cria notif `task_due_soon`.
- `process-due-date-notifications.ts` — chama tambm `create_task_due_date_notifications()`.
- `src/hooks/useNotifications.ts` — `NotificationType` estendido com `task_assigned | task_mention | task_due_soon | task_comment`.
- `src/components/notifications/NotificationBell.tsx` — `typeIcons` + `typeColors` cobrem os 4 tipos novos.
- `src/hooks/useNotificationPreferences.ts` — escreve na tabela `notification_preferences` (nova) em vez do JSONB legado.
- `src/hooks/useTeamTasks.ts` — `useQuery` agora filtra `is_recurrence_template = false` por padrão (templates só aparecem em view dedicada).
- `src/hooks/usePlanningItems.ts` — idem `usePlanningItems` filtra templates.
