-- 0042_security_hardening_2026_05_16.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- P0 fixes do audit backend-infra-schema (2026-05-16):
--
-- 1. viral_tracked_sources SELECT policy `USING (true)` permitia qualquer
--    authenticated user ver fontes IG/TikTok/Threads/etc de TODOS os clientes
--    via Data API (competitive intelligence leak — quem monitora quem).
--    A 0019 corrigiu o WRITE mas deixou o READ aberto.
--
-- 2. notifications table sem RLS. process-scheduled-posts INSERT direto.
--    Se exposta via Data API qualquer user lê notifications de outros
--    workspaces (lista de erros de publicação, due dates etc).
--
-- 3. NOTIFY pgrst pra recarregar schema cache do Neon Data API.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. viral_tracked_sources SELECT ────────────────────────────────────────

DROP POLICY IF EXISTS "viral_tracked_sources read all" ON public.viral_tracked_sources;

-- Substituida por policy scoped por workspace via client_id.
-- Fontes globais (client_id IS NULL) continuam visíveis pra todos —
-- são feeds RSS curados (default seed) compartilhados por toda a base.
CREATE POLICY "viral_tracked_sources read scoped"
  ON public.viral_tracked_sources
  FOR SELECT TO authenticated
  USING (
    client_id IS NULL  -- fontes globais (default RSS seed) sempre visíveis
    OR EXISTS (
      SELECT 1
        FROM public.clients c
        JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
       WHERE c.id = viral_tracked_sources.client_id
         AND wm.user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid())
  );

-- ── 2. notifications RLS ───────────────────────────────────────────────────
-- Tabela criada por migrations antigas (pre-0017). Habilita RLS + policies
-- scoped por user_id (notifications são per-user). DROP/CREATE IF EXISTS
-- pra não quebrar se já existir.

DO $notifications_rls$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'notifications'
  ) THEN
    EXECUTE 'ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "notifications_user_read" ON public.notifications';
    EXECUTE $$
      CREATE POLICY "notifications_user_read"
        ON public.notifications
        FOR SELECT TO authenticated
        USING (user_id = auth.uid())
    $$;

    EXECUTE 'DROP POLICY IF EXISTS "notifications_user_update" ON public.notifications';
    EXECUTE $$
      CREATE POLICY "notifications_user_update"
        ON public.notifications
        FOR UPDATE TO authenticated
        USING (user_id = auth.uid())
        WITH CHECK (user_id = auth.uid())
    $$;

    EXECUTE 'DROP POLICY IF EXISTS "notifications_user_delete" ON public.notifications';
    EXECUTE $$
      CREATE POLICY "notifications_user_delete"
        ON public.notifications
        FOR DELETE TO authenticated
        USING (user_id = auth.uid())
    $$;

    -- INSERT vem só do server (pool admin role bypassa RLS). Sem policy de
    -- INSERT pra authenticated — clients não devem criar notifications.

    RAISE NOTICE '[0042] notifications RLS habilitado + policies criadas';
  ELSE
    RAISE NOTICE '[0042] tabela notifications não existe — skip';
  END IF;
END $notifications_rls$;

-- ── 3. Schema cache reload (PostgREST/Neon Data API) ───────────────────────
NOTIFY pgrst, 'reload schema';
