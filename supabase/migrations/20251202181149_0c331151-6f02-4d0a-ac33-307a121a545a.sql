-- Create enum for share permission levels
CREATE TYPE public.share_permission AS ENUM ('view', 'edit', 'admin');

-- Comments on research items
CREATE TABLE public.research_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.research_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  content TEXT NOT NULL,
  position_x DOUBLE PRECISION,
  position_y DOUBLE PRECISION,
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Project sharing
CREATE TABLE public.research_project_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
  shared_by UUID NOT NULL DEFAULT auth.uid(),
  shared_with_email TEXT NOT NULL,
  shared_with_user_id UUID,
  permission share_permission NOT NULL DEFAULT 'view',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, shared_with_email)
);

-- Version history snapshots
CREATE TABLE public.research_project_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  version_number INTEGER NOT NULL,
  name TEXT,
  description TEXT,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, version_number)
);

-- Enable RLS
ALTER TABLE public.research_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_project_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_project_versions ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user has access to a project (owner or shared)
CREATE OR REPLACE FUNCTION public.has_project_access(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM research_projects WHERE id = p_project_id AND user_id = p_user_id
  ) OR EXISTS (
    SELECT 1 FROM research_project_shares 
    WHERE project_id = p_project_id 
    AND (shared_with_user_id = p_user_id OR shared_with_email = (SELECT email FROM auth.users WHERE id = p_user_id))
  )
$$;

-- Helper function to check edit permission
CREATE OR REPLACE FUNCTION public.has_project_edit_access(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM research_projects WHERE id = p_project_id AND user_id = p_user_id
  ) OR EXISTS (
    SELECT 1 FROM research_project_shares 
    WHERE project_id = p_project_id 
    AND (shared_with_user_id = p_user_id OR shared_with_email = (SELECT email FROM auth.users WHERE id = p_user_id))
    AND permission IN ('edit', 'admin')
  )
$$;

-- RLS Policies for research_comments
CREATE POLICY "Users can view comments on accessible projects"
ON public.research_comments FOR SELECT
USING (public.has_project_access(project_id, auth.uid()));

CREATE POLICY "Users can create comments on editable projects"
ON public.research_comments FOR INSERT
WITH CHECK (public.has_project_edit_access(project_id, auth.uid()));

CREATE POLICY "Users can update their own comments"
ON public.research_comments FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own comments"
ON public.research_comments FOR DELETE
USING (user_id = auth.uid());

-- RLS Policies for research_project_shares
CREATE POLICY "Project owners can view shares"
ON public.research_project_shares FOR SELECT
USING (EXISTS (SELECT 1 FROM research_projects WHERE id = project_id AND user_id = auth.uid()));

CREATE POLICY "Project owners can create shares"
ON public.research_project_shares FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM research_projects WHERE id = project_id AND user_id = auth.uid()));

CREATE POLICY "Project owners can delete shares"
ON public.research_project_shares FOR DELETE
USING (EXISTS (SELECT 1 FROM research_projects WHERE id = project_id AND user_id = auth.uid()));

-- RLS Policies for research_project_versions
CREATE POLICY "Users can view versions of accessible projects"
ON public.research_project_versions FOR SELECT
USING (public.has_project_access(project_id, auth.uid()));

CREATE POLICY "Users can create versions on editable projects"
ON public.research_project_versions FOR INSERT
WITH CHECK (public.has_project_edit_access(project_id, auth.uid()));

CREATE POLICY "Project owners can delete versions"
ON public.research_project_versions FOR DELETE
USING (EXISTS (SELECT 1 FROM research_projects WHERE id = project_id AND user_id = auth.uid()));

-- Update trigger for comments
CREATE TRIGGER update_research_comments_updated_at
BEFORE UPDATE ON public.research_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();