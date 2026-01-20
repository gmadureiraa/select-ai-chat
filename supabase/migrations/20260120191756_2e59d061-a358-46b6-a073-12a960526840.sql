-- Fix SELECT policy to use workspace-based access instead of client-specific access
-- This ensures newly created clients can be returned by the INSERT...RETURNING

-- Drop the existing SELECT policy
DROP POLICY IF EXISTS "Members can view accessible clients" ON public.clients;

-- Create a new SELECT policy using is_workspace_member for workspace-based access
CREATE POLICY "Members can view workspace clients"
ON public.clients
FOR SELECT
TO authenticated
USING (is_workspace_member(auth.uid(), workspace_id));

-- Also fix UPDATE policy to use the same workspace-based approach for consistency
DROP POLICY IF EXISTS "Members can update accessible clients" ON public.clients;

CREATE POLICY "Members can update workspace clients"
ON public.clients
FOR UPDATE
TO authenticated
USING (is_workspace_member(auth.uid(), workspace_id))
WITH CHECK (is_workspace_member(auth.uid(), workspace_id));