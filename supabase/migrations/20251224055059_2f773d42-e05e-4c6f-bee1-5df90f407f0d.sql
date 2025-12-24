-- Create table to track rejected/ignored pending users per workspace
CREATE TABLE public.workspace_rejected_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rejected_by UUID NOT NULL,
  rejected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reason TEXT,
  UNIQUE(workspace_id, user_id)
);

-- Enable RLS
ALTER TABLE public.workspace_rejected_users ENABLE ROW LEVEL SECURITY;

-- Only workspace admins/owners can view rejected users
CREATE POLICY "Workspace admins can view rejected users"
ON public.workspace_rejected_users
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = workspace_rejected_users.workspace_id
    AND wm.user_id = auth.uid()
    AND wm.role IN ('owner', 'admin')
  )
);

-- Only workspace admins/owners can reject users
CREATE POLICY "Workspace admins can reject users"
ON public.workspace_rejected_users
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = workspace_rejected_users.workspace_id
    AND wm.user_id = auth.uid()
    AND wm.role IN ('owner', 'admin')
  )
);

-- Only workspace admins/owners can unreject users
CREATE POLICY "Workspace admins can unreject users"
ON public.workspace_rejected_users
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = workspace_rejected_users.workspace_id
    AND wm.user_id = auth.uid()
    AND wm.role IN ('owner', 'admin')
  )
);