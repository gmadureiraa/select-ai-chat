-- 0050_db_cleanup.sql
-- AUDIT 2026-05-18 — SAFE database cleanup baseline
--
-- This migration intentionally contains only non-destructive hardening and
-- index work. Destructive cleanup candidates are documented at the bottom as
-- commented SQL and must be run manually after backup + row-count validation.
--
-- Scope:
--   1. RLS hardening (client_x_manual_reports + stripe_webhook_events)
--   2. Missing FK indexes (perf for JOINs and cascades)
--   3. Missing workspace_id / client_id indexes on hot tables
--   4. Schema drift notes
--
-- Notes:
--   * Wrapped in a single transaction.
--   * CREATE INDEX is not CONCURRENTLY because this file is transactional. For
--     very large prod tables, split indexes into a separate concurrent run.
--   * Run with: bun scripts/apply-migration.ts 0050_db_cleanup.sql
--
BEGIN;

-- =============================================================================
-- 1. RLS HARDENING
-- =============================================================================

-- client_x_manual_reports: RLS is DISABLED + 0 policies. Add workspace isolation.
ALTER TABLE public.client_x_manual_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "x_reports_workspace_select" ON public.client_x_manual_reports;
CREATE POLICY "x_reports_workspace_select"
  ON public.client_x_manual_reports
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
      WHERE c.id = client_x_manual_reports.client_id
        AND wm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "x_reports_workspace_modify" ON public.client_x_manual_reports;
CREATE POLICY "x_reports_workspace_modify"
  ON public.client_x_manual_reports
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
      WHERE c.id = client_x_manual_reports.client_id
        AND wm.user_id = auth.uid()
        AND wm.role <> 'viewer'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clients c
      JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
      WHERE c.id = client_x_manual_reports.client_id
        AND wm.user_id = auth.uid()
        AND wm.role <> 'viewer'
    )
  );

-- stripe_webhook_events: RLS enabled, but 0 policies => effectively locked to service_role.
-- That's actually intentional for webhook idempotency. Keep, but make explicit:
DROP POLICY IF EXISTS "stripe_webhook_events_service_role_only" ON public.stripe_webhook_events;
CREATE POLICY "stripe_webhook_events_service_role_only"
  ON public.stripe_webhook_events
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Optional: replace SELECT USING (true) on cross-tenant tables. Defer for now since
-- those are read-everywhere by design (e.g. format_specs, viral_*_posts are global libraries).
-- Block left documented; flip when you decide they should be workspace-scoped:
--   ALTER POLICY "viral_news_articles read all" ON public.viral_news_articles ...

-- =============================================================================
-- 2. MISSING FK INDEXES (perf for cascades + JOINs)
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_client_x_manual_reports_created_by
  ON public.client_x_manual_reports (created_by);

CREATE INDEX IF NOT EXISTS idx_planning_items_created_by
  ON public.planning_items (created_by);

CREATE INDEX IF NOT EXISTS idx_planning_items_assigned_to
  ON public.planning_items (assigned_to);

CREATE INDEX IF NOT EXISTS idx_team_tasks_client_id
  ON public.team_tasks (client_id);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id
  ON public.workspace_members (user_id);

CREATE INDEX IF NOT EXISTS idx_workspace_subscriptions_plan_id
  ON public.workspace_subscriptions (plan_id);

-- =============================================================================
-- 3. MISSING workspace_id / client_id INDEXES (hot multi-tenant filter)
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_approval_tokens_workspace_id
  ON public.approval_tokens (workspace_id);

CREATE INDEX IF NOT EXISTS idx_viral_radar_briefs_workspace_id
  ON public.viral_radar_briefs (workspace_id);

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_workspace_id
  ON public.scheduled_posts (workspace_id);

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_client_id
  ON public.scheduled_posts (client_id);

CREATE INDEX IF NOT EXISTS idx_viral_search_cache_workspace_id
  ON public.viral_search_cache (workspace_id);

CREATE INDEX IF NOT EXISTS idx_workspace_rejected_users_workspace_id
  ON public.workspace_rejected_users (workspace_id);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_workspace_id
  ON public.notification_preferences (workspace_id);

CREATE INDEX IF NOT EXISTS idx_client_preferences_client_id
  ON public.client_preferences (client_id);

CREATE INDEX IF NOT EXISTS idx_client_social_credentials_client_id
  ON public.client_social_credentials (client_id);

CREATE INDEX IF NOT EXISTS idx_favorite_messages_client_id
  ON public.favorite_messages (client_id);

CREATE INDEX IF NOT EXISTS idx_import_history_client_id
  ON public.import_history (client_id);

CREATE INDEX IF NOT EXISTS idx_kanban_cards_client_id
  ON public.kanban_cards (client_id);

CREATE INDEX IF NOT EXISTS idx_planning_automations_client_id
  ON public.planning_automations (client_id);

CREATE INDEX IF NOT EXISTS idx_workspace_invite_clients_client_id
  ON public.workspace_invite_clients (client_id);

-- =============================================================================
-- 4. SCHEMA DRIFT FIX (TS types regen — do separately, not SQL)
-- =============================================================================
-- Action items (no DDL here):
--   * Regenerate src/integrations/supabase/types.ts OR rename it to
--     src/integrations/neon/types.ts and add the 23 missing tables:
--     __migrations_applied, ai_agents, ai_workflow_runs, ai_workflows,
--     approval_tokens, client_format_standards, client_post_transcriptions,
--     client_x_manual_reports, eval_runs, format_specs, library_ideas,
--     library_reels, metricool_daily_snapshots, metricool_posts,
--     radar_newsletters_curated, radar_saved_items, stripe_webhook_events,
--     viral_linkedin_posts, viral_news_articles, viral_threads_posts,
--     viral_tiktok_posts, viral_tracked_sources, viral_twitter_posts
--   * After step 4 above runs, remove from types.ts: research_*, content_canvas,
--     content_repurpose_history, meta_ads_*, workspace_rejected_users,
--     linkedin_posts, twitter_posts (renamed to viral_linkedin_posts /
--     viral_twitter_posts).

COMMIT;

-- =============================================================================
-- DESTRUCTIVE CLEANUP CANDIDATES — DO NOT RUN WITHOUT BACKUP
-- =============================================================================
-- These were intentionally kept out of the executable migration. Before running
-- any line below, verify row counts, code references, and product ownership.
--
-- Suggested validation:
--   SELECT 'research_comments', count(*) FROM public.research_comments
--   UNION ALL SELECT 'research_messages', count(*) FROM public.research_messages
--   UNION ALL SELECT 'research_conversations', count(*) FROM public.research_conversations
--   UNION ALL SELECT 'research_project_versions', count(*) FROM public.research_project_versions
--   UNION ALL SELECT 'research_project_shares', count(*) FROM public.research_project_shares
--   UNION ALL SELECT 'research_items', count(*) FROM public.research_items
--   UNION ALL SELECT 'content_canvas', count(*) FROM public.content_canvas
--   UNION ALL SELECT 'content_repurpose_history', count(*) FROM public.content_repurpose_history
--   UNION ALL SELECT 'meta_ads_ads', count(*) FROM public.meta_ads_ads
--   UNION ALL SELECT 'meta_ads_adsets', count(*) FROM public.meta_ads_adsets
--   UNION ALL SELECT 'meta_ads_campaigns', count(*) FROM public.meta_ads_campaigns
--   UNION ALL SELECT 'workspace_rejected_users', count(*) FROM public.workspace_rejected_users;
--
-- Candidate drops:
--   DROP TABLE IF EXISTS public.research_comments CASCADE;
--   DROP TABLE IF EXISTS public.research_messages CASCADE;
--   DROP TABLE IF EXISTS public.research_conversations CASCADE;
--   DROP TABLE IF EXISTS public.research_project_versions CASCADE;
--   DROP TABLE IF EXISTS public.research_project_shares CASCADE;
--   DROP TABLE IF EXISTS public.research_items CASCADE;
--   DROP TABLE IF EXISTS public.content_canvas CASCADE;
--   DROP TABLE IF EXISTS public.content_repurpose_history CASCADE;
--   DROP TABLE IF EXISTS public.meta_ads_ads CASCADE;
--   DROP TABLE IF EXISTS public.meta_ads_adsets CASCADE;
--   DROP TABLE IF EXISTS public.meta_ads_campaigns CASCADE;
--   DROP TABLE IF EXISTS public.workspace_rejected_users CASCADE;
--
-- Candidate stale-row cleanup:
--   DELETE FROM public.workspace_invites WHERE expires_at < now() - interval '7 days';
--   DELETE FROM public.notifications WHERE created_at < now() - interval '90 days';
--   DELETE FROM public.automation_runs WHERE started_at < now() - interval '90 days';
--   DELETE FROM public.planning_automation_runs WHERE started_at < now() - interval '90 days';
--   DELETE FROM public.ai_workflow_runs WHERE started_at < now() - interval '90 days';
--   DELETE FROM public.oauth_connection_attempts WHERE created_at < now() - interval '1 day';
--   DELETE FROM public.webhook_events_log WHERE created_at < now() - interval '30 days';
--   DELETE FROM public.stripe_webhook_events WHERE processed_at < now() - interval '90 days';
--   DELETE FROM public.approval_tokens WHERE expires_at < now();
--   DELETE FROM public.push_notification_queue WHERE created_at < now() - interval '7 days';
--   DELETE FROM public.viral_search_cache WHERE created_at < now() - interval '7 days';

-- =============================================================================
-- POST-MIGRATION VALIDATION
-- =============================================================================
-- After applying, run:
--   ANALYZE public.client_x_manual_reports;
--   ANALYZE public.planning_items;
--   ANALYZE public.team_tasks;
--   REFRESH MATERIALIZED VIEW CONCURRENTLY public.client_top_content;
