-- Fix RLS membership checks by considering workspace owners as members
-- This prevents false negatives during RLS evaluation for INSERT/SELECT/UPDATE policies.

CREATE OR REPLACE FUNCTION public.is_workspace_member(p_user_id uuid, p_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.workspace_members
      WHERE user_id = p_user_id
        AND workspace_id = p_workspace_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.workspaces
      WHERE id = p_workspace_id
        AND owner_id = p_user_id
    );
$$;