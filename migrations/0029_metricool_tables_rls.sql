-- 0029_metricool_tables_rls.sql
-- Habilita RLS nas tabelas metricool_* (criadas em 0026, 0027) que estavam
-- expostas via Neon Data API sem policies. Sem RLS, a Data API com role
-- `authenticated` deixaria QUALQUER user logado ler/escrever dados de
-- QUALQUER cliente (mesmo sem ser membro do workspace).
--
-- Aplicado em 2026-05-09 (auditoria estratégica). Idempotente — pode rodar
-- múltiplas vezes sem efeito colateral.
--
-- Padrão de policies: workspace_members ⨉ clients (mesmo usado por
-- viral_carousels, post_transcriptions). Cron / handlers server-side com
-- DATABASE_URL bypassam RLS porque usam role `neondb_owner` (BYPASSRLS).
-- Apenas a Data API (browser) é afetada.

-- ── metricool_daily_snapshots ───────────────────────────────────────────────
ALTER TABLE public.metricool_daily_snapshots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'metricool_daily_snapshots'
       AND policyname = 'Workspace members can view metricool snapshots'
  ) THEN
    CREATE POLICY "Workspace members can view metricool snapshots"
      ON public.metricool_daily_snapshots
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
            FROM public.clients c
            JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
           WHERE c.id = metricool_daily_snapshots.client_id
             AND wm.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'metricool_daily_snapshots'
       AND policyname = 'Service role manages metricool snapshots'
  ) THEN
    -- Cron / handlers server-side já bypassam RLS via neondb_owner.
    -- Esta policy só serve pra que admins via Studio possam editar.
    CREATE POLICY "Service role manages metricool snapshots"
      ON public.metricool_daily_snapshots
      FOR ALL
      USING (false)
      WITH CHECK (false);
  END IF;
END $$;

-- ── metricool_posts ─────────────────────────────────────────────────────────
ALTER TABLE public.metricool_posts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'metricool_posts'
       AND policyname = 'Workspace members can view metricool posts'
  ) THEN
    CREATE POLICY "Workspace members can view metricool posts"
      ON public.metricool_posts
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
            FROM public.clients c
            JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
           WHERE c.id = metricool_posts.client_id
             AND wm.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'metricool_posts'
       AND policyname = 'Service role manages metricool posts'
  ) THEN
    CREATE POLICY "Service role manages metricool posts"
      ON public.metricool_posts
      FOR ALL
      USING (false)
      WITH CHECK (false);
  END IF;
END $$;

COMMENT ON POLICY "Workspace members can view metricool snapshots"
  ON public.metricool_daily_snapshots IS
  'Lê snapshot histórico de métricas Metricool — só para usuários membros do workspace que owns o cliente. Cron de snapshot ignora porque roda como neondb_owner (BYPASSRLS).';

COMMENT ON POLICY "Workspace members can view metricool posts"
  ON public.metricool_posts IS
  'Lê posts agregados Metricool — só para usuários membros do workspace que owns o cliente. cron-metricool-backfill-posts ignora porque roda como neondb_owner (BYPASSRLS).';
