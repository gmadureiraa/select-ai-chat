-- 0034_emergency_restore_fks.sql
-- EMERGÊNCIA: tabelas core (workspaces, workspace_members, planning_items,
-- clients, kanban_columns, etc) sem FKs.
--
-- Sintoma: PostgREST do Neon Data API retorna 400 "Could not find a
-- relationship between 'X' and 'Y' in the schema cache" pra QUALQUER
-- query com nested embed (`select=*,clients:client_id(...)`).
--
-- Frontend usa esse pattern PostgREST em todo lugar (planning_items
-- com clients/kanban_columns embedded, workspace_members com workspaces,
-- workspace_subscriptions com subscription_plans). Sem FK, embed quebra,
-- query retorna 400, useMemo crash com 'm.map is not a function',
-- ErrorBoundary mostra tela branca.
--
-- Aplicado em 2026-05-10 + NOTIFY pgrst pra recarregar schema cache.

DO $$
BEGIN
  -- ── workspace_members → workspaces ────────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name='workspace_members_workspace_id_fkey'
  ) THEN
    ALTER TABLE public.workspace_members
      ADD CONSTRAINT workspace_members_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
  END IF;

  -- workspace_members.user_id → auth.users.id (Supabase managed)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name='workspace_members_user_id_fkey'
  ) THEN
    ALTER TABLE public.workspace_members
      ADD CONSTRAINT workspace_members_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  -- ── clients → workspaces ───────────────────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name='clients_workspace_id_fkey'
  ) THEN
    ALTER TABLE public.clients
      ADD CONSTRAINT clients_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
  END IF;

  -- ── kanban_columns → workspaces ────────────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name='kanban_columns_workspace_id_fkey'
  ) THEN
    ALTER TABLE public.kanban_columns
      ADD CONSTRAINT kanban_columns_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
  END IF;

  -- ── planning_items → workspaces / clients / kanban_columns ─────────────
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name='planning_items_workspace_id_fkey'
  ) THEN
    ALTER TABLE public.planning_items
      ADD CONSTRAINT planning_items_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name='planning_items_client_id_fkey'
  ) THEN
    ALTER TABLE public.planning_items
      ADD CONSTRAINT planning_items_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name='planning_items_column_id_fkey'
  ) THEN
    ALTER TABLE public.planning_items
      ADD CONSTRAINT planning_items_column_id_fkey
      FOREIGN KEY (column_id) REFERENCES public.kanban_columns(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name='planning_items_assigned_to_fkey'
  ) THEN
    ALTER TABLE public.planning_items
      ADD CONSTRAINT planning_items_assigned_to_fkey
      FOREIGN KEY (assigned_to) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name='planning_items_created_by_fkey'
  ) THEN
    ALTER TABLE public.planning_items
      ADD CONSTRAINT planning_items_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  -- ── workspace_subscriptions → workspaces / subscription_plans ─────────
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name='workspace_subscriptions_workspace_id_fkey'
  ) THEN
    ALTER TABLE public.workspace_subscriptions
      ADD CONSTRAINT workspace_subscriptions_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name='workspace_subscriptions_plan_id_fkey'
  ) THEN
    ALTER TABLE public.workspace_subscriptions
      ADD CONSTRAINT workspace_subscriptions_plan_id_fkey
      FOREIGN KEY (plan_id) REFERENCES public.subscription_plans(id) ON DELETE SET NULL;
  END IF;

  -- ── client_reference_library → clients ────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name='client_reference_library_client_id_fkey'
  ) THEN
    ALTER TABLE public.client_reference_library
      ADD CONSTRAINT client_reference_library_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;
  END IF;

  -- ── client_content_library → clients ──────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name='client_content_library_client_id_fkey'
  ) THEN
    ALTER TABLE public.client_content_library
      ADD CONSTRAINT client_content_library_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;
  END IF;

  -- ── viral_carousels → clients / workspaces / planning_items ───────────
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name='viral_carousels_client_id_fkey'
  ) THEN
    ALTER TABLE public.viral_carousels
      ADD CONSTRAINT viral_carousels_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name='viral_carousels_workspace_id_fkey'
  ) THEN
    ALTER TABLE public.viral_carousels
      ADD CONSTRAINT viral_carousels_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
  END IF;

  -- ── team_tasks → workspaces / clients / users ─────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name='team_tasks_workspace_id_fkey'
  ) THEN
    ALTER TABLE public.team_tasks
      ADD CONSTRAINT team_tasks_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name='team_tasks_client_id_fkey'
  ) THEN
    ALTER TABLE public.team_tasks
      ADD CONSTRAINT team_tasks_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Recarrega schema cache do PostgREST (Neon Data API)
NOTIFY pgrst, 'reload schema';
