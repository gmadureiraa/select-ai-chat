-- Create a new helper function to get role for a SPECIFIC workspace (for multi-workspace support)
-- This doesn't replace existing functions, it adds a new one that can be used when workspace_id is known
CREATE OR REPLACE FUNCTION public.get_user_role_in_workspace(_user_id uuid, _workspace_id uuid)
RETURNS workspace_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT 'owner'::workspace_role FROM workspaces w WHERE w.id = _workspace_id AND w.owner_id = _user_id),
    (SELECT wm.role FROM workspace_members wm WHERE wm.user_id = _user_id AND wm.workspace_id = _workspace_id)
  )
$$;

-- Create a function to check membership in a SPECIFIC workspace
CREATE OR REPLACE FUNCTION public.is_member_of_workspace(_user_id uuid, _workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspaces w WHERE w.id = _workspace_id AND w.owner_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM workspace_members wm WHERE wm.user_id = _user_id AND wm.workspace_id = _workspace_id
  )
$$;

-- Create a function to check delete permissions in a SPECIFIC workspace
CREATE OR REPLACE FUNCTION public.can_delete_in_specific_workspace(_user_id uuid, _workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspaces w WHERE w.id = _workspace_id AND w.owner_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM workspace_members wm 
    WHERE wm.user_id = _user_id 
    AND wm.workspace_id = _workspace_id
    AND wm.role IN ('owner', 'admin')
  )
$$;