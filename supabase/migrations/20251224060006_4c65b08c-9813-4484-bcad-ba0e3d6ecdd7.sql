-- Create table for workspace access requests
CREATE TABLE public.workspace_access_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id uuid NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    message text,
    requested_at timestamp with time zone NOT NULL DEFAULT now(),
    processed_at timestamp with time zone,
    processed_by uuid,
    UNIQUE (workspace_id, user_id)
);

-- Enable RLS
ALTER TABLE public.workspace_access_requests ENABLE ROW LEVEL SECURITY;

-- Policies: Admins can view/manage requests for their workspace
CREATE POLICY "Workspace admins can view access requests"
ON public.workspace_access_requests
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM workspace_members wm
        WHERE wm.workspace_id = workspace_access_requests.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    )
    OR user_id = auth.uid()
);

CREATE POLICY "Users can create access requests"
ON public.workspace_access_requests
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Workspace admins can update access requests"
ON public.workspace_access_requests
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM workspace_members wm
        WHERE wm.workspace_id = workspace_access_requests.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    )
);

CREATE POLICY "Workspace admins can delete access requests"
ON public.workspace_access_requests
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM workspace_members wm
        WHERE wm.workspace_id = workspace_access_requests.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    )
);

-- Create index for faster lookups
CREATE INDEX idx_workspace_access_requests_workspace ON public.workspace_access_requests(workspace_id, status);