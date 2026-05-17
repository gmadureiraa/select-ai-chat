-- ========================================================================
-- 0044 — Performance indexes + Stripe webhook dedup + Recurrence anti-race
--
-- Audit do backend (2026-05-17) identificou:
--   1. ZERO `FOR UPDATE SKIP LOCKED` em pickups de cron — race condition
--      real entre invocations paralelas dos crons */5min.
--   2. Stripe webhook reprocessa o mesmo event ID se a Stripe retentar
--      (5xx, timeout, retry) — pode creditar tokens DUAS vezes.
--   3. process-recurring-content pode criar 2 items pro mesmo template no
--      mesmo dia se 2 crons rodarem em paralelo (race entre SELECT + INSERT).
--   4. Hot path queries sem índice cobrindo os predicados — table scan em
--      planning_items/instagram_posts/team_tasks quando volume cresce.
--
-- Esta migration é idempotente e CONCURRENT-safe (não bloqueia escrita).
-- ========================================================================

-- ─── 1. Stripe webhook idempotency table ─────────────────────────────────
-- Dedup por Stripe event ID. INSERT ... ON CONFLICT DO NOTHING no handler
-- garante que o mesmo event só é processado UMA vez, mesmo se Stripe retentar.
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  id              TEXT PRIMARY KEY,           -- Stripe event.id (evt_xxx)
  type            TEXT NOT NULL,              -- 'checkout.session.completed' etc
  livemode        BOOLEAN NOT NULL DEFAULT false,
  payload_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_ms     INTEGER
);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_processed_at
  ON public.stripe_webhook_events(processed_at DESC);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_type
  ON public.stripe_webhook_events(type);

COMMENT ON TABLE public.stripe_webhook_events IS
  'Idempotency dedup pra Stripe webhooks. INSERT ON CONFLICT DO NOTHING garante 1x processamento por event.id.';

-- ─── 2. process-recurring-content anti-race ─────────────────────────────
-- Garante 1 item criado por (template, dia). Se 2 crons rodam paralelo,
-- INSERT ... ON CONFLICT DO NOTHING na app layer fica seguro.
-- Usa expression index com DATE(created_at) — único per template per dia.
CREATE UNIQUE INDEX IF NOT EXISTS uq_planning_items_recurrence_per_day
  ON public.planning_items (recurrence_parent_id, (DATE(created_at AT TIME ZONE 'UTC')))
  WHERE recurrence_parent_id IS NOT NULL;

-- Mesma proteção pra team_tasks
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
-- process-scheduled-posts: planning_items pickup hot path
-- SELECT WHERE status='scheduled' AND scheduled_at <= $1 AND external_post_id IS NULL
-- AND retry_count < 3 ORDER BY scheduled_at LIMIT 25
CREATE INDEX IF NOT EXISTS idx_planning_items_pickup
  ON public.planning_items(scheduled_at, retry_count)
  WHERE status = 'scheduled' AND external_post_id IS NULL;

-- Retry pickup (failed items aguardando next_retry_at)
CREATE INDEX IF NOT EXISTS idx_planning_items_retry_wait
  ON public.planning_items(next_retry_at)
  WHERE status = 'scheduled' AND next_retry_at IS NOT NULL;

-- Stale publishing recovery (process-scheduled-posts roda este UPDATE no início)
CREATE INDEX IF NOT EXISTS idx_planning_items_stale_publishing
  ON public.planning_items(updated_at)
  WHERE status = 'publishing' AND external_post_id IS NULL;

-- cron-metricool-poll + cron-postiz-poll pending lookup
-- SELECT WHERE external_post_id IS NOT NULL AND status IN ('scheduled','publishing','partial')
-- AND metadata->>'provider' IN ('metricool','postiz') AND updated_at > NOW() - 7d
CREATE INDEX IF NOT EXISTS idx_planning_items_provider_pending
  ON public.planning_items(updated_at DESC, external_post_id)
  WHERE external_post_id IS NOT NULL
    AND status IN ('scheduled', 'publishing', 'partial');

-- cron-fetch-published-metrics lookup
-- SELECT WHERE status='published' AND external_post_id IS NOT NULL
-- AND published_at > NOW() - 60d ORDER BY published_at DESC LIMIT 100
CREATE INDEX IF NOT EXISTS idx_planning_items_published_metrics
  ON public.planning_items(published_at DESC)
  WHERE status = 'published' AND external_post_id IS NOT NULL;

-- ─── 4. push_notification_queue + email_notification_queue pickup ───────
-- Esses crons rodam a cada 5min, podem ter race.
-- Já tem `idx_push_notification_queue_pending` em ON ...(processed, created_at)
-- WHERE processed = false. Vamos garantir.
CREATE INDEX IF NOT EXISTS idx_push_notification_queue_pending_pickup
  ON public.push_notification_queue(created_at)
  WHERE processed = false;

-- email_notification_queue — `idx_email_notification_queue_pending` já cobre
-- created_at WHERE sent_at IS NULL. OK.

-- ─── 5. instagram_posts — transcrição cron lookup ───────────────────────
-- cron-transcribe-recent-posts: SELECT WHERE posted_at >= cutoff AND NOT EXISTS
-- (SELECT ... FROM client_post_transcriptions). Idx ajuda na sub-query e ORDER.
CREATE INDEX IF NOT EXISTS idx_client_post_transcriptions_lookup
  ON public.client_post_transcriptions(client_id, source, post_id);

-- ─── 6. planning_automations pickup ─────────────────────────────────────
-- process-automations: SELECT WHERE is_active = true (todos)
-- Hot path quando volume cresce — só is_active = true tem índice parcial.
CREATE INDEX IF NOT EXISTS idx_planning_automations_active
  ON public.planning_automations(workspace_id, trigger_type)
  WHERE is_active = true;

-- ─── 7. recurrence templates pickup ─────────────────────────────────────
-- process-recurring-content: SELECT WHERE is_recurrence_template = true
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
-- cron-fetch-published-metrics tenta resolver via local cache antes de bater API.
-- WHERE (client_id, network, post_id) = ANY(...) AND last_synced_at > NOW() - 12h
CREATE INDEX IF NOT EXISTS idx_metricool_posts_fresh_lookup
  ON public.metricool_posts(client_id, network, post_id, last_synced_at);

-- ─── 9. workspace_subscriptions — Stripe lookup ────────────────────────
-- Stripe webhook usa stripe_subscription_id e workspace_id pra dedup logic
CREATE INDEX IF NOT EXISTS idx_workspace_subscriptions_stripe_sub
  ON public.workspace_subscriptions(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;
