-- Phase 1: Create workspace role enum
CREATE TYPE public.workspace_role AS ENUM ('owner', 'admin', 'member');

-- Phase 1: Create workspaces table
CREATE TABLE public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Phase 1: Create workspace_members table
CREATE TABLE public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  role workspace_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

-- Phase 1: Create workspace_invites table
CREATE TABLE public.workspace_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  role workspace_role NOT NULL DEFAULT 'member',
  invited_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMPTZ,
  UNIQUE(workspace_id, email)
);

-- Enable RLS on new tables
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;

-- Phase 1: Security definer functions
CREATE OR REPLACE FUNCTION public.get_user_workspace_id(p_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_id FROM workspace_members WHERE user_id = p_user_id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_user_workspace_role(p_user_id UUID)
RETURNS workspace_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM workspace_members WHERE user_id = p_user_id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.can_delete_in_workspace(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members 
    WHERE user_id = p_user_id 
    AND role IN ('owner', 'admin')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_member(p_user_id UUID, p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members 
    WHERE user_id = p_user_id 
    AND workspace_id = p_workspace_id
  )
$$;

-- Phase 2: Add workspace_id to clients table
ALTER TABLE public.clients ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id);
ALTER TABLE public.clients ADD COLUMN created_by UUID;

-- Phase 2: Create initial workspace "Kaleidos" for current user
INSERT INTO public.workspaces (id, name, owner_id) 
VALUES ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Kaleidos', '9381b916-b87e-4bd2-a1e7-e06791854c4c');

-- Phase 2: Add current user as owner of the workspace
INSERT INTO public.workspace_members (workspace_id, user_id, role)
VALUES ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', '9381b916-b87e-4bd2-a1e7-e06791854c4c', 'owner');

-- Phase 2: Migrate existing clients to the workspace
UPDATE public.clients 
SET workspace_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    created_by = user_id
WHERE user_id = '9381b916-b87e-4bd2-a1e7-e06791854c4c';

-- Phase 2: Make workspace_id NOT NULL after migration
ALTER TABLE public.clients ALTER COLUMN workspace_id SET NOT NULL;

-- Phase 3: RLS Policies for workspaces table
CREATE POLICY "Users can view their workspaces"
ON public.workspaces FOR SELECT
USING (public.is_workspace_member(auth.uid(), id));

CREATE POLICY "Only owners can update workspace"
ON public.workspaces FOR UPDATE
USING (owner_id = auth.uid());

-- Phase 3: RLS Policies for workspace_members table
CREATE POLICY "Members can view workspace members"
ON public.workspace_members FOR SELECT
USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Owners and admins can add members"
ON public.workspace_members FOR INSERT
WITH CHECK (
  public.is_workspace_member(auth.uid(), workspace_id)
  AND public.can_delete_in_workspace(auth.uid())
);

CREATE POLICY "Owners and admins can remove members"
ON public.workspace_members FOR DELETE
USING (
  public.is_workspace_member(auth.uid(), workspace_id)
  AND public.can_delete_in_workspace(auth.uid())
  AND user_id != (SELECT owner_id FROM workspaces WHERE id = workspace_id)
);

CREATE POLICY "Owners and admins can update member roles"
ON public.workspace_members FOR UPDATE
USING (
  public.is_workspace_member(auth.uid(), workspace_id)
  AND public.can_delete_in_workspace(auth.uid())
)
WITH CHECK (
  role != 'owner'
);

-- Phase 3: RLS Policies for workspace_invites table
CREATE POLICY "Members can view workspace invites"
ON public.workspace_invites FOR SELECT
USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Owners and admins can create invites"
ON public.workspace_invites FOR INSERT
WITH CHECK (
  public.is_workspace_member(auth.uid(), workspace_id)
  AND public.can_delete_in_workspace(auth.uid())
);

CREATE POLICY "Owners and admins can delete invites"
ON public.workspace_invites FOR DELETE
USING (
  public.is_workspace_member(auth.uid(), workspace_id)
  AND public.can_delete_in_workspace(auth.uid())
);

-- Phase 3: Drop old RLS policies on clients
DROP POLICY IF EXISTS "Users can create their own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can delete their own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can update their own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can view their own clients" ON public.clients;

-- Phase 3: New RLS policies for clients (workspace-based)
CREATE POLICY "Members can view workspace clients"
ON public.clients FOR SELECT
USING (workspace_id = public.get_user_workspace_id(auth.uid()));

CREATE POLICY "Members can create workspace clients"
ON public.clients FOR INSERT
WITH CHECK (workspace_id = public.get_user_workspace_id(auth.uid()));

CREATE POLICY "Members can update workspace clients"
ON public.clients FOR UPDATE
USING (workspace_id = public.get_user_workspace_id(auth.uid()));

CREATE POLICY "Only owners and admins can delete clients"
ON public.clients FOR DELETE
USING (
  workspace_id = public.get_user_workspace_id(auth.uid())
  AND public.can_delete_in_workspace(auth.uid())
);

-- Trigger to auto-join workspace on signup if invited
CREATE OR REPLACE FUNCTION public.handle_workspace_invite_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
BEGIN
  -- Check for pending invites for this email
  FOR v_invite IN 
    SELECT * FROM workspace_invites 
    WHERE email = NEW.email 
    AND accepted_at IS NULL 
    AND expires_at > now()
  LOOP
    -- Add user to workspace
    INSERT INTO workspace_members (workspace_id, user_id, role)
    VALUES (v_invite.workspace_id, NEW.id, v_invite.role)
    ON CONFLICT (workspace_id, user_id) DO NOTHING;
    
    -- Mark invite as accepted
    UPDATE workspace_invites 
    SET accepted_at = now() 
    WHERE id = v_invite.id;
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Create trigger for auto-joining workspace
CREATE TRIGGER on_auth_user_created_workspace_invite
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_workspace_invite_on_signup();