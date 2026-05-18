-- 0046_perf_indexes_and_stripe_dedup.sql
-- Performance indexes + Stripe webhook dedup + recurrence anti-race.
--
-- Port canonicalizado de supabase/migrations/20260517100000_perf_indexes_and_stripe_dedup.sql
-- para a pasta `migrations/`, que é a fonte de verdade atual do Neon.

-- ─── 1. Stripe webhook idempotency table ─────────────────────────────────
-- Dedup por Stripe event ID. INSERT ... ON CONFLICT DO NOTHING no handler
-- garante que o mesmo event só é processado UMA vez, mesmo se Stripe retentar.
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  id              TEXT PRIMARY KEY,
  type            TEXT NOT NULL,
  livemode        BOOLEAN NOT NULL DEFAULT false,
  payload_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_ms     INTEGER
);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_processed_at
  ON public.stripe_webhook_events(processed_at DESC);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_type
  ON public.stripe_webhook_events(type);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.stripe_webhook_events IS
  'Idempotency dedup pra Stripe webhooks. INSERT ON CONFLICT DO NOTHING garante 1x processamento por event.id.';

-- ─── 2. process-recurring-content anti-race ─────────────────────────────
-- Garante 1 item criado por (template, dia). Se 2 crons rodam paralelo,
-- INSERT ... ON CONFLICT DO NOTHING na app layer fica seguro.
CREATE UNIQUE INDEX IF NOT EXISTS uq_planning_items_recurrence_per_day
  ON public.planning_items (recurrence_parent_id, (DATE(created_at AT TIME ZONE 'UTC')))
  WHERE recurrence_parent_id IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'team_tasks'
       AND column_name = 'recurrence_parent_id'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS uq_team_tasks_recurrence_per_day
             ON public.team_tasks (recurrence_parent_id, (DATE(created_at AT TIME ZONE ''UTC'')))
             WHERE recurrence_parent_id IS NOT NULL';
  END IF;
END $$;

-- ─── 3. Hot path indexes — pickup queries ───────────────────────────────
CREATE INDEX IF NOT EXISTS idx_planning_items_pickup
  ON public.planning_items(scheduled_at, retry_count)
  WHERE status = 'scheduled' AND external_post_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_planning_items_retry_wait
  ON public.planning_items(next_retry_at)
  WHERE status = 'scheduled' AND next_retry_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_planning_items_stale_publishing
  ON public.planning_items(updated_at)
  WHERE status = 'publishing' AND external_post_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_planning_items_provider_pending
  ON public.planning_items(updated_at DESC, external_post_id)
  WHERE external_post_id IS NOT NULL
    AND status IN ('scheduled', 'publishing', 'partial');

CREATE INDEX IF NOT EXISTS idx_planning_items_published_metrics
  ON public.planning_items(published_at DESC)
  WHERE status = 'published' AND external_post_id IS NOT NULL;

-- ─── 4. Notification queue pickup ───────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_push_notification_queue_pending_pickup
  ON public.push_notification_queue(created_at)
  WHERE processed = false;

-- ─── 5. instagram_posts — transcrição cron lookup ───────────────────────
CREATE INDEX IF NOT EXISTS idx_client_post_transcriptions_lookup
  ON public.client_post_transcriptions(client_id, source, post_id);

-- ─── 6. planning_automations pickup ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_planning_automations_active
  ON public.planning_automations(workspace_id, trigger_type)
  WHERE is_active = true;

-- ─── 7. recurrence templates pickup ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_planning_items_recurrence_templates
  ON public.planning_items(workspace_id)
  WHERE is_recurrence_template = true
    AND recurrence_type IS NOT NULL
    AND recurrence_type <> 'none';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'team_tasks'
       AND column_name = 'is_recurrence_template'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_team_tasks_recurrence_templates
             ON public.team_tasks(workspace_id)
             WHERE is_recurrence_template = true
               AND recurrence_type IS NOT NULL
               AND recurrence_type <> ''none''';
  END IF;
END $$;

-- ─── 8. metricool_posts — local-first lookup ───────────────────────────
CREATE INDEX IF NOT EXISTS idx_metricool_posts_fresh_lookup
  ON public.metricool_posts(client_id, network, post_id, last_synced_at);

-- ─── 9. workspace_subscriptions — Stripe lookup ────────────────────────
CREATE INDEX IF NOT EXISTS idx_workspace_subscriptions_stripe_sub
  ON public.workspace_subscriptions(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
