-- ─── Fix trigger engagement_score lê metadata.metrics.* ─────────────────
-- Antes: lia metadata->>'likes', metadata->>'comments', metadata->>'shares'
-- Mas import-client-social-content.ts salva como metadata.metrics: {likes,...}
-- (nested). Trigger sempre recebia null → score = 0 → top content vazio.
-- Agora: lê dois caminhos e usa COALESCE pra compat com ambos shapes.

CREATE OR REPLACE FUNCTION public.update_engagement_score()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.engagement_score = public.calc_engagement_score(
    -- Tenta nested primeiro (metadata.metrics.likes), depois flat
    NULLIF(
      COALESCE(
        NEW.metadata->'metrics'->>'likes',
        NEW.metadata->>'likes'
      ),
      ''
    )::int,
    NULLIF(
      COALESCE(
        NEW.metadata->'metrics'->>'comments',
        NEW.metadata->>'comments'
      ),
      ''
    )::int,
    NULLIF(
      COALESCE(
        NEW.metadata->'metrics'->>'shares',
        NEW.metadata->>'shares'
      ),
      ''
    )::int
  );
  RETURN NEW;
END $$;

-- Backfill: re-aplica score em todas as rows que tem metadata.metrics
UPDATE public.client_content_library
   SET metadata = metadata
 WHERE metadata ? 'metrics';

-- ─── Migration 0012 (atrasada): RLS viral_tracked_sources per-client ───
-- Antes: SELECT public, INSERT/UPDATE/DELETE só super_admin.
-- Resultado: ClientSourcesManager UI não conseguia toggle/delete sources
-- do cliente porque update direto na tabela bate em RLS.
-- Agora: members do workspace dono do client_id podem mexer.

DROP POLICY IF EXISTS "viral_tracked_sources client write" ON public.viral_tracked_sources;
CREATE POLICY "viral_tracked_sources client write"
  ON public.viral_tracked_sources
  FOR ALL TO authenticated
  USING (
    client_id IS NOT NULL AND (
      EXISTS (
        SELECT 1
          FROM public.clients c
          JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
         WHERE c.id = viral_tracked_sources.client_id
           AND wm.user_id = auth.uid()
      )
      OR EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    client_id IS NOT NULL AND (
      EXISTS (
        SELECT 1
          FROM public.clients c
          JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
         WHERE c.id = viral_tracked_sources.client_id
           AND wm.user_id = auth.uid()
      )
      OR EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid())
    )
  );

-- ─── View workspace_content_aggregate (cross-client analytics) ───────────
-- Resolve gap "Performance sem visão cross-client" do audit F.
-- Soma top content de TODOS clientes do workspace pra dashboard agregado.

CREATE OR REPLACE VIEW public.workspace_content_aggregate AS
SELECT
  c.workspace_id,
  c.id AS client_id,
  c.name AS client_name,
  c.avatar_url AS client_avatar,
  count(ccl.id) AS items_count,
  COALESCE(sum(ccl.engagement_score), 0)::numeric AS total_engagement,
  COALESCE(avg(ccl.engagement_score), 0)::numeric AS avg_engagement,
  max(ccl.created_at) AS last_item_at,
  count(*) FILTER (WHERE ccl.content_type IN ('carousel', 'instagram_post')) AS carousel_count,
  count(*) FILTER (WHERE ccl.content_type IN ('reel_script', 'short_video')) AS reel_count,
  count(*) FILTER (WHERE ccl.content_type = 'thread') AS thread_count
FROM public.clients c
LEFT JOIN public.client_content_library ccl ON ccl.client_id = c.id
GROUP BY c.workspace_id, c.id, c.name, c.avatar_url;

GRANT SELECT ON public.workspace_content_aggregate TO authenticated, anon;

-- ─── Cron de refresh do MVIEW client_top_content (resolve gap audit D) ──
-- A view foi criada em 0011 mas nunca refresh-ada. Cria função pra ser
-- chamada via cron diário.

CREATE OR REPLACE FUNCTION public.refresh_client_top_content_mview()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.client_top_content;
EXCEPTION
  WHEN feature_not_supported THEN
    -- CONCURRENTLY exige UNIQUE INDEX; cai pra refresh blocking se faltar
    REFRESH MATERIALIZED VIEW public.client_top_content;
  WHEN undefined_table THEN
    -- View ainda não existe — silencia
    RAISE NOTICE 'client_top_content materialized view não existe';
END $$;

GRANT EXECUTE ON FUNCTION public.refresh_client_top_content_mview() TO authenticated, anon;
