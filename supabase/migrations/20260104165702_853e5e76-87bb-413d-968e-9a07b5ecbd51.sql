-- Create table to store content repurpose history
CREATE TABLE public.content_repurpose_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  youtube_url TEXT NOT NULL,
  video_title TEXT,
  video_thumbnail TEXT,
  transcript TEXT,
  objective TEXT,
  generated_contents JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.content_repurpose_history ENABLE ROW LEVEL SECURITY;

-- Create policy for workspace members to view history
CREATE POLICY "Workspace members can view repurpose history"
ON public.content_repurpose_history
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = content_repurpose_history.workspace_id
    AND wm.user_id = auth.uid()
  )
);

-- Create policy for workspace members to insert history
CREATE POLICY "Workspace members can create repurpose history"
ON public.content_repurpose_history
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = content_repurpose_history.workspace_id
    AND wm.user_id = auth.uid()
  )
);

-- Create policy for users to delete their own history
CREATE POLICY "Users can delete their own repurpose history"
ON public.content_repurpose_history
FOR DELETE
USING (created_by = auth.uid());

-- Create index for faster queries
CREATE INDEX idx_content_repurpose_history_workspace ON public.content_repurpose_history(workspace_id);
CREATE INDEX idx_content_repurpose_history_client ON public.content_repurpose_history(client_id);
CREATE INDEX idx_content_repurpose_history_created_at ON public.content_repurpose_history(created_at DESC);