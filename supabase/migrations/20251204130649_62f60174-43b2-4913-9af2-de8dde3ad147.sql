-- Create enum for knowledge categories
CREATE TYPE public.knowledge_category AS ENUM (
  'copywriting',
  'storytelling', 
  'hooks',
  'psychology',
  'structure',
  'engagement',
  'other'
);

-- Create global_knowledge table
CREATE TABLE public.global_knowledge (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category knowledge_category NOT NULL DEFAULT 'other',
  source_file TEXT,
  page_count INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.global_knowledge ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Workspace members can view knowledge"
ON public.global_knowledge FOR SELECT
USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Workspace members can create knowledge"
ON public.global_knowledge FOR INSERT
WITH CHECK (workspace_id = get_user_workspace_id(auth.uid()));

CREATE POLICY "Workspace members can update knowledge"
ON public.global_knowledge FOR UPDATE
USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Only owners/admins can delete knowledge"
ON public.global_knowledge FOR DELETE
USING (is_workspace_member(auth.uid(), workspace_id) AND can_delete_in_workspace(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_global_knowledge_updated_at
BEFORE UPDATE ON public.global_knowledge
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();