-- 0030_metricool_iud_policies.sql
-- Adiciona INSERT/UPDATE/DELETE policies em metricool_posts + metricool_daily_snapshots.
-- 0029 só criou SELECT. Como crons rodam com DATABASE_URL (BYPASSRLS), as IUD
-- são defensivas — só usadas se o front (Data API) tentar gravar diretamente.
-- Aplicado em 2026-05-09 via script ad-hoc (cleanup pos-auditoria estratégica).
--
-- Padrão: workspace_members ⨉ clients (mesmo de viral_carousels).

-- ── metricool_posts ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Workspace members can insert metricool posts" ON public.metricool_posts;
CREATE POLICY "Workspace members can insert metricool posts"
  ON public.metricool_posts FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clients c
      INNER JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
      WHERE c.id = client_id AND wm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Workspace members can update metricool posts" ON public.metricool_posts;
CREATE POLICY "Workspace members can update metricool posts"
  ON public.metricool_posts FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      INNER JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
      WHERE c.id = client_id AND wm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Workspace members can delete metricool posts" ON public.metricool_posts;
CREATE POLICY "Workspace members can delete metricool posts"
  ON public.metricool_posts FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      INNER JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
      WHERE c.id = client_id AND wm.user_id = auth.uid()
    )
  );

-- ── metricool_daily_snapshots ───────────────────────────────────────────────
DROP POLICY IF EXISTS "Workspace members can insert metricool snapshots" ON public.metricool_daily_snapshots;
CREATE POLICY "Workspace members can insert metricool snapshots"
  ON public.metricool_daily_snapshots FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clients c
      INNER JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
      WHERE c.id = client_id AND wm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Workspace members can update metricool snapshots" ON public.metricool_daily_snapshots;
CREATE POLICY "Workspace members can update metricool snapshots"
  ON public.metricool_daily_snapshots FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      INNER JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
      WHERE c.id = client_id AND wm.user_id = auth.uid()
    )
  );
