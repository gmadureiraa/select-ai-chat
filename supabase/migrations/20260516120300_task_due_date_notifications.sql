-- 0044: Tasks com due_date hoje geram notif `task_due_soon`
--
-- Bug: tipo `task_due_soon` existe no enum (20260504144016) mas NUNCA é
-- inserido — create_due_date_notifications() só processa planning_items.
-- Resultado: usuário vê due_date no card mas não recebe lembrete in-app/push/email.
--
-- Fix: função paralela create_task_due_date_notifications() que processa
-- team_tasks.due_date <= today + status != done.
--
-- Cron handler process-due-date-notifications.ts foi ajustado pra chamar
-- ambas as funções na mesma execução.

CREATE OR REPLACE FUNCTION public.create_task_due_date_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  task RECORD;
BEGIN
  FOR task IN
    SELECT
      t.id,
      t.title,
      t.assigned_to,
      t.created_by,
      t.workspace_id,
      t.due_date,
      t.client_id,
      t.priority
    FROM public.team_tasks t
    WHERE t.due_date IS NOT NULL
      AND t.due_date <= CURRENT_DATE
      AND COALESCE(t.assigned_to, t.created_by) IS NOT NULL
      AND t.status <> 'done'
      AND COALESCE(t.is_recurrence_template, false) = false
  LOOP
    -- Notif só se enabled na nova tabela `notification_preferences` (default true)
    IF public.notif_pref_enabled(
         COALESCE(task.assigned_to, task.created_by),
         task.workspace_id,
         'in_app',
         'task_due_soon'
       ) THEN
      -- Idempotência: 1 notif por task por dia (evita spam ao rodar 2x)
      IF NOT EXISTS (
        SELECT 1 FROM public.notifications
         WHERE entity_id = task.id
           AND entity_type = 'team_task'
           AND type = 'task_due_soon'
           AND created_at::date = CURRENT_DATE
      ) THEN
        INSERT INTO public.notifications (
          user_id,
          workspace_id,
          type,
          title,
          message,
          entity_type,
          entity_id,
          metadata
        ) VALUES (
          COALESCE(task.assigned_to, task.created_by),
          task.workspace_id,
          'task_due_soon',
          CASE
            WHEN task.due_date < CURRENT_DATE THEN 'Tarefa atrasada'
            ELSE 'Tarefa vence hoje'
          END,
          format('"%s" %s',
            COALESCE(task.title, 'Tarefa sem título'),
            CASE
              WHEN task.due_date < CURRENT_DATE THEN
                format('venceu em %s', to_char(task.due_date, 'DD/MM'))
              ELSE 'vence hoje'
            END
          ),
          'team_task',
          task.id,
          jsonb_build_object(
            'due_date', task.due_date,
            'client_id', task.client_id,
            'priority', task.priority
          )
        );
      END IF;
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.create_task_due_date_notifications() IS
  'Cron-driven: cria notif task_due_soon para tasks com due_date <= hoje e status != done. Idempotente por dia.';
