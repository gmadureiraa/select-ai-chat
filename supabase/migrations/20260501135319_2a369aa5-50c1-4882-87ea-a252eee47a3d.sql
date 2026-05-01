-- Tabela de log das execuções automáticas
CREATE TABLE IF NOT EXISTS public.metrics_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  platform text NOT NULL,
  status text NOT NULL CHECK (status IN ('success','failed','skipped','partial')),
  triggered_by text NOT NULL DEFAULT 'cron' CHECK (triggered_by IN ('cron','manual','webhook')),
  duration_ms integer,
  estimated_cost_usd numeric(10,4),
  items_synced integer DEFAULT 0,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_metrics_sync_runs_client_date 
  ON public.metrics_sync_runs (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_sync_runs_platform_date 
  ON public.metrics_sync_runs (platform, created_at DESC);

ALTER TABLE public.metrics_sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members view sync runs"
ON public.metrics_sync_runs FOR SELECT
USING (
  client_id IS NULL 
  OR public.client_workspace_accessible(client_id, auth.uid())
);

CREATE POLICY "Service role manages sync runs"
ON public.metrics_sync_runs FOR ALL
USING (auth.jwt()->>'role' = 'service_role')
WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- Agendamento diário 09:00 UTC (06:00 BRT)
SELECT cron.unschedule('sync-all-metrics-daily') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'sync-all-metrics-daily'
);

SELECT cron.schedule(
  'sync-all-metrics-daily',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url' LIMIT 1) || '/functions/v1/sync-all-metrics',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_service_role_key' LIMIT 1)
    ),
    body := '{"source":"cron","platforms":["instagram","tiktok","twitter","linkedin","youtube"]}'::jsonb
  );
  $$
);