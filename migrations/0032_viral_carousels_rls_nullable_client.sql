-- 0032_viral_carousels_rls_nullable_client.sql
-- Permite criar carrosseis sem client_id (caso single-user / sandbox).
--
-- Bug original: SV standalone era single-tenant e não tinha client_id, mas a
-- RLS atual exige `client_workspace_accessible(client_id, auth.uid())` na
-- INSERT — quando client_id é NULL a função retorna false e bloqueia INSERT
-- com 'new row violates row-level security policy'.
--
-- Solução: permitir client_id NULL desde que user_id = auth.uid() (dono).
-- Mantém isolamento: carrosseis com client_id ainda exigem workspace
-- membership; carrosseis sem client_id são pessoais (só o dono vê).
--
-- Aplicado em 2026-05-10.

-- ── INSERT ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Workspace members can insert viral carousels" ON public.viral_carousels;
CREATE POLICY "Workspace members can insert viral carousels"
  ON public.viral_carousels FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      client_id IS NULL
      OR client_workspace_accessible(client_id, auth.uid())
    )
  );

-- ── SELECT ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Workspace members can view viral carousels" ON public.viral_carousels;
CREATE POLICY "Workspace members can view viral carousels"
  ON public.viral_carousels FOR SELECT TO authenticated
  USING (
    (client_id IS NULL AND user_id = auth.uid())
    OR client_workspace_accessible(client_id, auth.uid())
  );

-- ── UPDATE ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Workspace members can update viral carousels" ON public.viral_carousels;
CREATE POLICY "Workspace members can update viral carousels"
  ON public.viral_carousels FOR UPDATE TO authenticated
  USING (
    (client_id IS NULL AND user_id = auth.uid())
    OR client_workspace_accessible(client_id, auth.uid())
  );

-- ── DELETE ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Workspace members can delete viral carousels" ON public.viral_carousels;
CREATE POLICY "Workspace members can delete viral carousels"
  ON public.viral_carousels FOR DELETE TO authenticated
  USING (
    (client_id IS NULL AND user_id = auth.uid())
    OR client_workspace_accessible(client_id, auth.uid())
  );
