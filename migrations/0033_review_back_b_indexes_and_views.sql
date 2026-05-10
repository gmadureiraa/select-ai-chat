-- 0033_review_back_b_indexes_and_views.sql
-- REVIEW BACK B (2026-05-10): aplica fixes P0 detectados na auditoria de schema/RLS/indexes.
--
-- Achados endereçados:
--   1. Migration 0025_planning_metrics_indexes nunca foi aplicada (re-cria os 3 índices)
--   2. FKs sem índice em 8 colunas (perf de DELETE / JOIN)
--   3. Índices ausentes em workspace_id (clients, kanban_columns) e client_id
--      (client_reference_library) → seq_scan pesado no pg_stat_user_tables
--   4. Tabela órfã `client_social_credentials_decrypted` (deveria ser VIEW) e
--      tabela `workspace_invites_secure` idem — ambas com 0 rows.
--      Convertidas pra views (security_invoker).
--   5. Função `get_client_social_credentials_decrypted` referencia
--      `decrypt_credential` (não existe). Recriada apontando pra
--      `decrypt_social_token`.
--
-- Idempotente. Não toca em policies sensíveis (auth.users, profiles).

BEGIN;

-- =============================================================
-- 1. Re-aplicar 0025 (planning_items metrics indexes)
-- =============================================================
CREATE INDEX IF NOT EXISTS idx_planning_items_metrics_synced
  ON public.planning_items ((metadata->>'metrics_synced_at'))
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_planning_items_external_post
  ON public.planning_items (external_post_id)
  WHERE external_post_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_planning_items_metricool_post_id
  ON public.planning_items ((metadata->>'metricool_post_id'))
  WHERE metadata->>'metricool_post_id' IS NOT NULL;

-- =============================================================
-- 2. Indexes em FKs sem suporte
-- =============================================================
CREATE INDEX IF NOT EXISTS idx_library_ideas_created_by
  ON public.library_ideas (created_by);

CREATE INDEX IF NOT EXISTS idx_library_reels_created_by
  ON public.library_reels (created_by);

CREATE INDEX IF NOT EXISTS idx_profiles_referred_by
  ON public.profiles (referred_by) WHERE referred_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_radar_saved_items_client_id
  ON public.radar_saved_items (client_id);

CREATE INDEX IF NOT EXISTS idx_radar_saved_items_workspace_id
  ON public.radar_saved_items (workspace_id);

CREATE INDEX IF NOT EXISTS idx_viral_linkedin_posts_source_id
  ON public.viral_linkedin_posts (source_id);

CREATE INDEX IF NOT EXISTS idx_viral_threads_posts_source_id
  ON public.viral_threads_posts (source_id);

CREATE INDEX IF NOT EXISTS idx_viral_twitter_posts_source_id
  ON public.viral_twitter_posts (source_id);

-- =============================================================
-- 3. Indexes em tabelas hot com seq_scan dominante
-- =============================================================
CREATE INDEX IF NOT EXISTS idx_clients_workspace_id
  ON public.clients (workspace_id);

CREATE INDEX IF NOT EXISTS idx_clients_user_id
  ON public.clients (user_id);

CREATE INDEX IF NOT EXISTS idx_kanban_columns_workspace_id
  ON public.kanban_columns (workspace_id);

CREATE INDEX IF NOT EXISTS idx_client_reference_library_client_id
  ON public.client_reference_library (client_id);

-- =============================================================
-- 4. Converter client_social_credentials_decrypted (table → view)
--    A versão atual no Neon é uma TABLE vazia que sobrou do port. Os
--    handlers (twitter-feed, twitter-reply) leem dela e SEMPRE retornam 0
--    rows. Restauramos a view com security_invoker (forma original do
--    Supabase: 20260413201712_*.sql).
-- =============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='client_social_credentials_decrypted' AND c.relkind='r'
  ) THEN
    DROP TABLE public.client_social_credentials_decrypted CASCADE;
  END IF;
END$$;

CREATE OR REPLACE VIEW public.client_social_credentials_decrypted
WITH (security_invoker = true) AS
SELECT
  csc.id,
  csc.client_id,
  csc.platform,
  public.decrypt_social_token(csc.api_key_encrypted) AS api_key,
  public.decrypt_social_token(csc.api_secret_encrypted) AS api_secret,
  public.decrypt_social_token(csc.access_token_encrypted) AS access_token,
  public.decrypt_social_token(csc.access_token_secret_encrypted) AS access_token_secret,
  public.decrypt_social_token(csc.oauth_access_token_encrypted) AS oauth_access_token,
  public.decrypt_social_token(csc.oauth_refresh_token_encrypted) AS oauth_refresh_token,
  csc.expires_at,
  csc.is_valid,
  csc.last_validated_at,
  csc.validation_error,
  csc.account_name,
  csc.account_id,
  csc.metadata,
  csc.created_at,
  csc.updated_at
FROM public.client_social_credentials csc;

GRANT SELECT ON public.client_social_credentials_decrypted TO authenticated;
GRANT SELECT ON public.client_social_credentials_decrypted TO service_role;

-- =============================================================
-- 5. Converter workspace_invites_secure (table → view)
--    Mesma situação. Restaura mascaramento de email (admin vê plain,
--    membro comum vê masked).
-- =============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='workspace_invites_secure' AND c.relkind='r'
  ) THEN
    DROP TABLE public.workspace_invites_secure CASCADE;
  END IF;
END$$;

CREATE OR REPLACE VIEW public.workspace_invites_secure
WITH (security_invoker = true) AS
SELECT
  wi.id,
  wi.workspace_id,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = wi.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('admin','owner')
    ) THEN wi.email
    ELSE public.mask_email(wi.email)
  END AS email,
  wi.role,
  wi.invited_by,
  wi.created_at,
  wi.accepted_at
FROM public.workspace_invites wi
WHERE EXISTS (
  SELECT 1 FROM public.workspace_members wm
  WHERE wm.workspace_id = wi.workspace_id
    AND wm.user_id = auth.uid()
);

GRANT SELECT ON public.workspace_invites_secure TO authenticated;

-- =============================================================
-- 6. Recriar get_client_social_credentials_decrypted apontando pra
--    decrypt_social_token (a antiga referenciava decrypt_credential, que
--    não existe no Neon — toda chamada quebrava).
-- =============================================================
CREATE OR REPLACE FUNCTION public.get_client_social_credentials_decrypted(p_client_id uuid)
RETURNS TABLE(
  id uuid,
  client_id uuid,
  platform text,
  api_key text,
  api_secret text,
  access_token text,
  access_token_secret text,
  oauth_access_token text,
  oauth_refresh_token text,
  account_id text,
  account_name text,
  is_valid boolean,
  last_validated_at timestamp with time zone,
  validation_error text,
  expires_at timestamp with time zone,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.client_workspace_accessible(p_client_id, auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: You do not have access to this client';
  END IF;

  RETURN QUERY
  SELECT
    csc.id,
    csc.client_id,
    csc.platform,
    public.decrypt_social_token(csc.api_key_encrypted) AS api_key,
    public.decrypt_social_token(csc.api_secret_encrypted) AS api_secret,
    public.decrypt_social_token(csc.access_token_encrypted) AS access_token,
    public.decrypt_social_token(csc.access_token_secret_encrypted) AS access_token_secret,
    public.decrypt_social_token(csc.oauth_access_token_encrypted) AS oauth_access_token,
    public.decrypt_social_token(csc.oauth_refresh_token_encrypted) AS oauth_refresh_token,
    csc.account_id,
    csc.account_name,
    csc.is_valid,
    csc.last_validated_at,
    csc.validation_error,
    csc.expires_at,
    csc.created_at,
    csc.updated_at
  FROM public.client_social_credentials csc
  WHERE csc.client_id = p_client_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_client_social_credentials_decrypted(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_client_social_credentials_decrypted(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_client_social_credentials_decrypted(uuid) TO service_role;

-- =============================================================
-- 7. Tracking
-- =============================================================
INSERT INTO public.__migrations_applied (id, notes)
VALUES (
  '0033_review_back_b_indexes_and_views',
  'Fixes P0: indexes faltantes + 0025 retroativa + views decrypted/secure restauradas + decrypt_social_token wiring'
)
ON CONFLICT (id) DO NOTHING;

-- Backfill: 0025 estava em disco mas não em __migrations_applied
INSERT INTO public.__migrations_applied (id, notes)
VALUES ('0025_planning_metrics_indexes', 'Reaplicada via 0033')
ON CONFLICT (id) DO NOTHING;

COMMIT;
