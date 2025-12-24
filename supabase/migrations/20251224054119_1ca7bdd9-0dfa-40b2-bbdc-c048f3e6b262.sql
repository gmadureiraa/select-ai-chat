-- Create super_admins table for platform-level admin access
CREATE TABLE public.super_admins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

-- Only super-admins can view the table (to check if they are super-admin)
CREATE POLICY "Users can check if they are super-admin"
ON public.super_admins
FOR SELECT
USING (auth.uid() = user_id);

-- Create function to check if user is super-admin (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION public.is_super_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.super_admins
    WHERE user_id = p_user_id
  )
$$;

-- Create function to get all workspaces for super-admin (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_all_workspaces_admin()
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  owner_id uuid,
  owner_email text,
  created_at timestamptz,
  members_count bigint,
  clients_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    w.id,
    w.name,
    w.slug,
    w.owner_id,
    p.email as owner_email,
    w.created_at,
    (SELECT COUNT(*) FROM workspace_members wm WHERE wm.workspace_id = w.id) as members_count,
    (SELECT COUNT(*) FROM clients c WHERE c.workspace_id = w.id) as clients_count
  FROM workspaces w
  LEFT JOIN profiles p ON p.id = w.owner_id
  WHERE is_super_admin(auth.uid())
  ORDER BY w.created_at DESC
$$;

-- Create function to get workspace details for super-admin
CREATE OR REPLACE FUNCTION public.get_workspace_details_admin(p_workspace_id uuid)
RETURNS TABLE (
  workspace_id uuid,
  workspace_name text,
  workspace_slug text,
  owner_email text,
  plan_name text,
  plan_status text,
  tokens_balance integer,
  tokens_used integer,
  current_period_end timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    w.id as workspace_id,
    w.name as workspace_name,
    w.slug as workspace_slug,
    p.email as owner_email,
    sp.name as plan_name,
    ws.status::text as plan_status,
    wt.balance as tokens_balance,
    wt.tokens_used_this_period as tokens_used,
    ws.current_period_end
  FROM workspaces w
  LEFT JOIN profiles p ON p.id = w.owner_id
  LEFT JOIN workspace_subscriptions ws ON ws.workspace_id = w.id
  LEFT JOIN subscription_plans sp ON sp.id = ws.plan_id
  LEFT JOIN workspace_tokens wt ON wt.workspace_id = w.id
  WHERE w.id = p_workspace_id
  AND is_super_admin(auth.uid())
$$;

-- Create function to get all team members of a workspace for super-admin
CREATE OR REPLACE FUNCTION public.get_workspace_members_admin(p_workspace_id uuid)
RETURNS TABLE (
  member_id uuid,
  user_id uuid,
  email text,
  full_name text,
  role text,
  joined_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    wm.id as member_id,
    wm.user_id,
    p.email,
    p.full_name,
    wm.role::text,
    wm.created_at as joined_at
  FROM workspace_members wm
  LEFT JOIN profiles p ON p.id = wm.user_id
  WHERE wm.workspace_id = p_workspace_id
  AND is_super_admin(auth.uid())
  ORDER BY wm.created_at ASC
$$;

-- Create function to get all clients of a workspace for super-admin
CREATE OR REPLACE FUNCTION public.get_workspace_clients_admin(p_workspace_id uuid)
RETURNS TABLE (
  client_id uuid,
  client_name text,
  description text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    c.id as client_id,
    c.name as client_name,
    c.description,
    c.created_at
  FROM clients c
  WHERE c.workspace_id = p_workspace_id
  AND is_super_admin(auth.uid())
  ORDER BY c.created_at DESC
$$;