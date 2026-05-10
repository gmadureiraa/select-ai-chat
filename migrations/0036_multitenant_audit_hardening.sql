-- 0036_multitenant_audit_hardening.sql
-- Auditoria multi-tenant 2026-05-10:
--
-- Achado P1 (defesa em profundidade): viral_carousels tem RLS que permite
-- INSERT com client_id NULL desde que user_id = auth.uid(), MAS não verifica
-- se o workspace_id pertence ao usuário. Combinado com workspace_id NN sem
-- default na coluna, isso significa que um user logado, em teoria, pode
-- inserir um carrossel "solto" (sem cliente) em QUALQUER workspace que ele
-- forneça no payload — basta ele saber o UUID do workspace alheio.
--
-- Risco prático é baixo (workspace_id é uuid v4, não-enumerável; UI sempre
-- passa o workspace correto via useKaiContext), mas é defesa em profundidade
-- útil. Aplica is_workspace_member(auth.uid(), workspace_id) nas policies
-- INSERT/UPDATE/SELECT/DELETE quando client_id IS NULL.
--
-- Também aplica check no UPDATE/DELETE pra impedir mover carrossel pra
-- outro workspace.
--
-- Idempotente: drop + create. NOTIFY pgrst no fim.

DO $$
BEGIN
  -- INSERT: se client_id NULL, exigir workspace_id pertence ao user; senão
  -- delegar pra client_workspace_accessible (que já valida workspace via JOIN
  -- com clients).
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='viral_carousels'
      AND policyname='Workspace members can insert viral carousels'
  ) THEN
    DROP POLICY "Workspace members can insert viral carousels" ON public.viral_carousels;
  END IF;

  CREATE POLICY "Workspace members can insert viral carousels"
    ON public.viral_carousels
    FOR INSERT
    TO authenticated
    WITH CHECK (
      (user_id = auth.uid())
      AND (
        (client_id IS NULL AND is_workspace_member(auth.uid(), workspace_id))
        OR client_workspace_accessible(client_id, auth.uid())
      )
    );

  -- SELECT: idem (defesa contra reading carrossel solto de workspace alheio).
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='viral_carousels'
      AND policyname='Workspace members can view viral carousels'
  ) THEN
    DROP POLICY "Workspace members can view viral carousels" ON public.viral_carousels;
  END IF;

  CREATE POLICY "Workspace members can view viral carousels"
    ON public.viral_carousels
    FOR SELECT
    TO authenticated
    USING (
      (
        client_id IS NULL
        AND user_id = auth.uid()
        AND is_workspace_member(auth.uid(), workspace_id)
      )
      OR client_workspace_accessible(client_id, auth.uid())
    );

  -- UPDATE: idem + WITH CHECK reforçado pra impedir mover row pra outro WS.
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='viral_carousels'
      AND policyname='Workspace members can update viral carousels'
  ) THEN
    DROP POLICY "Workspace members can update viral carousels" ON public.viral_carousels;
  END IF;

  CREATE POLICY "Workspace members can update viral carousels"
    ON public.viral_carousels
    FOR UPDATE
    TO authenticated
    USING (
      (
        client_id IS NULL
        AND user_id = auth.uid()
        AND is_workspace_member(auth.uid(), workspace_id)
      )
      OR client_workspace_accessible(client_id, auth.uid())
    )
    WITH CHECK (
      (
        client_id IS NULL
        AND user_id = auth.uid()
        AND is_workspace_member(auth.uid(), workspace_id)
      )
      OR client_workspace_accessible(client_id, auth.uid())
    );

  -- DELETE
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='viral_carousels'
      AND policyname='Workspace members can delete viral carousels'
  ) THEN
    DROP POLICY "Workspace members can delete viral carousels" ON public.viral_carousels;
  END IF;

  CREATE POLICY "Workspace members can delete viral carousels"
    ON public.viral_carousels
    FOR DELETE
    TO authenticated
    USING (
      (
        client_id IS NULL
        AND user_id = auth.uid()
        AND is_workspace_member(auth.uid(), workspace_id)
      )
      OR client_workspace_accessible(client_id, auth.uid())
    );
END $$;

NOTIFY pgrst, 'reload schema';
