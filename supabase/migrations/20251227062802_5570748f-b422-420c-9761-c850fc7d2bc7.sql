-- Create table for workspace n8n credentials
CREATE TABLE public.workspace_n8n_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  n8n_api_url TEXT NOT NULL,
  n8n_api_key TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(workspace_id)
);

-- Enable RLS
ALTER TABLE public.workspace_n8n_credentials ENABLE ROW LEVEL SECURITY;

-- Only workspace owners and admins can view/manage n8n credentials
CREATE POLICY "Workspace admins can view n8n credentials"
ON public.workspace_n8n_credentials
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = workspace_n8n_credentials.workspace_id
    AND wm.user_id = auth.uid()
    AND wm.role IN ('owner', 'admin')
  )
  OR
  EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = workspace_n8n_credentials.workspace_id
    AND w.owner_id = auth.uid()
  )
);

CREATE POLICY "Workspace admins can insert n8n credentials"
ON public.workspace_n8n_credentials
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = workspace_n8n_credentials.workspace_id
    AND wm.user_id = auth.uid()
    AND wm.role IN ('owner', 'admin')
  )
  OR
  EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = workspace_n8n_credentials.workspace_id
    AND w.owner_id = auth.uid()
  )
);

CREATE POLICY "Workspace admins can update n8n credentials"
ON public.workspace_n8n_credentials
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = workspace_n8n_credentials.workspace_id
    AND wm.user_id = auth.uid()
    AND wm.role IN ('owner', 'admin')
  )
  OR
  EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = workspace_n8n_credentials.workspace_id
    AND w.owner_id = auth.uid()
  )
);

CREATE POLICY "Workspace admins can delete n8n credentials"
ON public.workspace_n8n_credentials
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = workspace_n8n_credentials.workspace_id
    AND wm.user_id = auth.uid()
    AND wm.role IN ('owner', 'admin')
  )
  OR
  EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = workspace_n8n_credentials.workspace_id
    AND w.owner_id = auth.uid()
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_workspace_n8n_credentials_updated_at
BEFORE UPDATE ON public.workspace_n8n_credentials
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();