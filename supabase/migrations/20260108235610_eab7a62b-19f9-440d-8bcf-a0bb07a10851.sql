-- Fix can_access_client function to include 'viewer' role
-- Previously, viewers without specific client restrictions couldn't see any clients

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
    -- Members/Viewers with no specific client restrictions can access all clients
    (
      EXISTS (
        SELECT 1 FROM workspace_members wm
        JOIN clients c ON c.workspace_id = wm.workspace_id
        WHERE wm.user_id = p_user_id
        AND c.id = p_client_id
        AND wm.role IN ('member', 'viewer')
      )
      AND NOT EXISTS (
        SELECT 1 FROM workspace_member_clients wmc
        JOIN workspace_members wm ON wm.id = wmc.workspace_member_id
        WHERE wm.user_id = p_user_id
      )
    )
    OR
    -- Members/Viewers with specific client access restrictions
    EXISTS (
      SELECT 1 FROM workspace_member_clients wmc
      JOIN workspace_members wm ON wm.id = wmc.workspace_member_id
      WHERE wm.user_id = p_user_id
      AND wmc.client_id = p_client_id
    )
$$;