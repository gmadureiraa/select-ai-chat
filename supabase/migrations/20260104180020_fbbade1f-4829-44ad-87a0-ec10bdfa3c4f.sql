-- Table for prompt templates
CREATE TABLE IF NOT EXISTS public.prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  category TEXT,
  is_shared BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.prompt_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies for prompt_templates
CREATE POLICY "Users can view own or shared templates"
  ON public.prompt_templates FOR SELECT
  USING (auth.uid() = user_id OR is_shared = true);

CREATE POLICY "Users can create templates"
  ON public.prompt_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own templates"
  ON public.prompt_templates FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own templates"
  ON public.prompt_templates FOR DELETE
  USING (auth.uid() = user_id);

-- Table for planning item comments
CREATE TABLE IF NOT EXISTS public.planning_item_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planning_item_id UUID NOT NULL REFERENCES public.planning_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.planning_item_comments ENABLE ROW LEVEL SECURITY;

-- RLS policies for planning_item_comments
CREATE POLICY "Users can view comments on accessible items"
  ON public.planning_item_comments FOR SELECT
  USING (true);

CREATE POLICY "Users can create comments"
  ON public.planning_item_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comments"
  ON public.planning_item_comments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
  ON public.planning_item_comments FOR DELETE
  USING (auth.uid() = user_id);

-- Table for planning item versions
CREATE TABLE IF NOT EXISTS public.planning_item_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planning_item_id UUID NOT NULL REFERENCES public.planning_items(id) ON DELETE CASCADE,
  version_data JSONB NOT NULL,
  changed_by UUID DEFAULT auth.uid(),
  change_type TEXT DEFAULT 'update',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.planning_item_versions ENABLE ROW LEVEL SECURITY;

-- RLS policies for planning_item_versions
CREATE POLICY "Users can view version history"
  ON public.planning_item_versions FOR SELECT
  USING (true);

CREATE POLICY "System can create versions"
  ON public.planning_item_versions FOR INSERT
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_prompt_templates_workspace ON public.prompt_templates(workspace_id);
CREATE INDEX IF NOT EXISTS idx_planning_comments_item ON public.planning_item_comments(planning_item_id);
CREATE INDEX IF NOT EXISTS idx_planning_versions_item ON public.planning_item_versions(planning_item_id);