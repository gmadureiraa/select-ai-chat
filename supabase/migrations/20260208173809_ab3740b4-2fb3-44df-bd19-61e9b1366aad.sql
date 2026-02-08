-- Parte 1: Atualizar CHECK Constraint na tabela notifications
-- Drop old constraint and create new one with all types
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check 
  CHECK (type = ANY (ARRAY[
    'assignment'::text, 
    'due_date'::text, 
    'mention'::text, 
    'publish_reminder'::text,
    'publish_failed'::text,
    'publish_success'::text,
    'automation_completed'::text
  ]));

-- Parte 2: Remover cron job antigo do process-push-queue que usa anon_key
SELECT cron.unschedule('process-push-queue');

-- Parte 3: Criar novo cron job usando Vault (a cada 2 minutos)
SELECT cron.schedule(
  'process-push-queue-cron',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url' LIMIT 1) || '/functions/v1/process-push-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_service_role_key' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- COMENTÁRIO: Após rodar esta migration, execute no SQL Editor:
-- SELECT vault.create_secret('https://tkbsjtgrumhvwlxkmojg.supabase.co', 'project_url');
-- SELECT vault.create_secret('SUA_SERVICE_ROLE_KEY_AQUI', 'cron_service_role_key');