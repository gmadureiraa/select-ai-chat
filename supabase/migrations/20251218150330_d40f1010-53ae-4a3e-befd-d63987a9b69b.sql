-- Create helper function for viewer role check
CREATE OR REPLACE FUNCTION public.is_viewer_role(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members 
    WHERE user_id = p_user_id 
    AND role = 'viewer'
  )
$$;

-- Create import_history table for tracking imports
CREATE TABLE public.import_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  imported_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  records_count INTEGER NOT NULL DEFAULT 0,
  file_name TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  metadata JSONB DEFAULT '{}'::jsonb,
  user_id UUID NOT NULL DEFAULT auth.uid()
);

-- Enable RLS
ALTER TABLE public.import_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for import_history
CREATE POLICY "Workspace members can view import history"
ON public.import_history
FOR SELECT
USING (client_workspace_accessible(client_id, auth.uid()));

CREATE POLICY "Workspace members can create import history"
ON public.import_history
FOR INSERT
WITH CHECK (client_workspace_accessible(client_id, auth.uid()));

CREATE POLICY "Only owners/admins can delete import history"
ON public.import_history
FOR DELETE
USING (client_workspace_can_delete(client_id, auth.uid()));