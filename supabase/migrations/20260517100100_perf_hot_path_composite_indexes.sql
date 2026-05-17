-- ========================================================================
-- 0045 — Composite indexes pra hot paths do KAI Chat / context loader
--
-- Complementa migration 0044 (lock + dedup + indexes básicos). Endereça
-- queries identificadas no audit que usam combinações de cols sem index
-- composto cobrindo o predicate.
-- ========================================================================

-- ─── 1. client_content_library — hot path do knowledge-loader ───────────
-- getFullContentContext faz 3 queries em série, todas WHERE client_id +
-- is_favorite + content_type. Já existe idx (client_id, is_favorite) WHERE
-- is_favorite=true, mas o caso favorites=true AND content_type=$2 precisa
-- de composto pra evitar table scan no second filter.
CREATE INDEX IF NOT EXISTS idx_client_content_library_fav_type
  ON public.client_content_library(client_id, content_type, created_at DESC)
  WHERE is_favorite = true;

-- Caso recentes-por-tipo (is_favorite = false, content_type = $1)
CREATE INDEX IF NOT EXISTS idx_client_content_library_recent_type
  ON public.client_content_library(client_id, content_type, created_at DESC);

-- ─── 2. instagram_posts top performers ──────────────────────────────────
-- knowledge-loader.getSuccessPatterns + getTopPerformingContent fazem:
-- WHERE client_id = $ AND engagement_rate IS NOT NULL ORDER BY engagement_rate DESC
-- Já tem idx_instagram_posts_client_posted (client_id, posted_at). Falta
-- index pra engagement_rate ordering.
CREATE INDEX IF NOT EXISTS idx_instagram_posts_client_engagement
  ON public.instagram_posts(client_id, engagement_rate DESC NULLS LAST)
  WHERE engagement_rate IS NOT NULL;

-- ─── 3. youtube_videos top performers ───────────────────────────────────
-- WHERE client_id = $ AND transcript IS NOT NULL ORDER BY total_views DESC
CREATE INDEX IF NOT EXISTS idx_youtube_videos_client_views_transcript
  ON public.youtube_videos(client_id, total_views DESC NULLS LAST)
  WHERE transcript IS NOT NULL;

-- ─── 4. ai_usage_logs — hot path do usage tracking ──────────────────────
-- logAIUsage chama INSERT em cada generation Gemini/OpenAI. SELECT pra
-- dashboards usa user_id + created_at. Já existe idx_ai_usage_logs_user_created
-- mas vamos garantir cobertura por workspace_id também (pra billing).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'ai_usage_logs'
       AND column_name = 'workspace_id'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_workspace_created
             ON public.ai_usage_logs(workspace_id, created_at DESC)
             WHERE workspace_id IS NOT NULL';
  END IF;
END $$;

-- ─── 5. token_transactions — billing audit ──────────────────────────────
-- Stripe credita via INSERT type='subscription_credit'. Workspace dashboard
-- lista por workspace_id + created_at DESC. Já existe idx_token_transactions_workspace.
-- Adiciona filter por type pra queries de auditoria stripe-specific.
CREATE INDEX IF NOT EXISTS idx_token_transactions_workspace_type
  ON public.token_transactions(workspace_id, type, created_at DESC);

-- ─── 6. notifications — bell unread count ───────────────────────────────
-- Frontend NotificationBell pulls WHERE user_id + read=false + workspace_id.
-- Já tem idx_notifications_user_unread (user_id, read) WHERE read=false.
-- Composto com workspace_id ajuda multi-workspace switching.
CREATE INDEX IF NOT EXISTS idx_notifications_user_workspace_unread
  ON public.notifications(user_id, workspace_id, created_at DESC)
  WHERE read = false;

-- ─── 7. workspace_members — auth path ────────────────────────────────────
-- assertWorkspaceAccess + assertWorkspaceMember chamados em quase todo
-- handler. WHERE workspace_id = $1 AND user_id = $2 LIMIT 1.
-- Garante composite cover pra evitar 2 lookups.
CREATE INDEX IF NOT EXISTS idx_workspace_members_lookup
  ON public.workspace_members(workspace_id, user_id);

-- ─── 8. planning_automation_runs — recente per automation ──────────────
-- Frontend dashboard lista runs WHERE automation_id ORDER BY started_at DESC.
-- Mantém idx_automation_runs_automation_id mas garante composite com started_at.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'planning_automation_runs'
       AND column_name = 'started_at'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_planning_automation_runs_recent
             ON public.planning_automation_runs(automation_id, started_at DESC)';
  END IF;
END $$;
