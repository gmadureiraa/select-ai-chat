-- Table to map workspace members to specific clients they can access
-- If a member has no entries here, they can see all clients (default behavior for owner/admin)
CREATE TABLE public.workspace_member_clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_member_id UUID NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(workspace_member_id, client_id)
);

-- Enable RLS
ALTER TABLE public.workspace_member_clients ENABLE ROW LEVEL SECURITY;

-- Only owners/admins can manage client access
CREATE POLICY "Owners and admins can view member client access"
ON public.workspace_member_clients
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM workspace_members wm
    JOIN workspace_members target ON target.id = workspace_member_clients.workspace_member_id
    WHERE wm.user_id = auth.uid()
    AND wm.workspace_id = target.workspace_id
    AND wm.role IN ('owner', 'admin')
  )
  OR
  -- Members can see their own access
  EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.id = workspace_member_clients.workspace_member_id
    AND wm.user_id = auth.uid()
  )
);

CREATE POLICY "Owners and admins can create member client access"
ON public.workspace_member_clients
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM workspace_members wm
    JOIN workspace_members target ON target.id = workspace_member_clients.workspace_member_id
    WHERE wm.user_id = auth.uid()
    AND wm.workspace_id = target.workspace_id
    AND wm.role IN ('owner', 'admin')
  )
);

CREATE POLICY "Owners and admins can delete member client access"
ON public.workspace_member_clients
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM workspace_members wm
    JOIN workspace_members target ON target.id = workspace_member_clients.workspace_member_id
    WHERE wm.user_id = auth.uid()
    AND wm.workspace_id = target.workspace_id
    AND wm.role IN ('owner', 'admin')
  )
);

-- Function to check if a user can access a specific client
CREATE OR REPLACE FUNCTION public.can_access_client(p_user_id uuid, p_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- Owners and admins can access all clients in their workspace
    EXISTS (
      SELECT 1 FROM workspace_members wm
      JOIN clients c ON c.workspace_id = wm.workspace_id
      WHERE wm.user_id = p_user_id
      AND c.id = p_client_id
      AND wm.role IN ('owner', 'admin')
    )
    OR
    -- Members with no specific client restrictions can access all
    (
      EXISTS (
        SELECT 1 FROM workspace_members wm
        JOIN clients c ON c.workspace_id = wm.workspace_id
        WHERE wm.user_id = p_user_id
        AND c.id = p_client_id
        AND wm.role = 'member'
      )
      AND NOT EXISTS (
        SELECT 1 FROM workspace_member_clients wmc
        JOIN workspace_members wm ON wm.id = wmc.workspace_member_id
        WHERE wm.user_id = p_user_id
      )
    )
    OR
    -- Members with specific client access
    EXISTS (
      SELECT 1 FROM workspace_member_clients wmc
      JOIN workspace_members wm ON wm.id = wmc.workspace_member_id
      WHERE wm.user_id = p_user_id
      AND wmc.client_id = p_client_id
    )
$$;

-- Update clients RLS to use the new function
DROP POLICY IF EXISTS "Members can view workspace clients" ON public.clients;

CREATE POLICY "Members can view accessible clients"
ON public.clients
FOR SELECT
USING (can_access_client(auth.uid(), id));