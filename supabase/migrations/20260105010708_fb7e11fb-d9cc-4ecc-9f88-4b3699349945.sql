-- Create planning_automations table
CREATE TABLE IF NOT EXISTS public.planning_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  
  -- Trigger type
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('schedule', 'rss', 'webhook')),
  
  -- Trigger configuration (flexible JSON)
  trigger_config JSONB NOT NULL DEFAULT '{}',
  
  -- Action configuration
  target_column_id UUID REFERENCES public.kanban_columns(id) ON DELETE SET NULL,
  platform TEXT,
  content_type TEXT DEFAULT 'social_post',
  
  -- Auto content generation
  auto_generate_content BOOLEAN DEFAULT false,
  prompt_template TEXT,
  
  -- Tracking
  last_triggered_at TIMESTAMPTZ,
  items_created INTEGER DEFAULT 0,
  
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.planning_automations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view workspace automations"
  ON public.planning_automations FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM public.workspace_members 
    WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can create workspace automations"
  ON public.planning_automations FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM public.workspace_members 
    WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update workspace automations"
  ON public.planning_automations FOR UPDATE
  USING (workspace_id IN (
    SELECT workspace_id FROM public.workspace_members 
    WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can delete workspace automations"
  ON public.planning_automations FOR DELETE
  USING (workspace_id IN (
    SELECT workspace_id FROM public.workspace_members 
    WHERE user_id = auth.uid()
  ));

-- Indexes
CREATE INDEX idx_planning_automations_workspace ON public.planning_automations(workspace_id);
CREATE INDEX idx_planning_automations_active ON public.planning_automations(is_active) WHERE is_active = true;
CREATE INDEX idx_planning_automations_trigger_type ON public.planning_automations(trigger_type);

-- Trigger for updated_at
CREATE TRIGGER update_planning_automations_updated_at
  BEFORE UPDATE ON public.planning_automations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();