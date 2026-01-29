-- Create planning_automation_runs table for execution history
CREATE TABLE public.planning_automation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID REFERENCES public.planning_automations(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'running',
  result TEXT,
  error TEXT,
  items_created INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  trigger_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_planning_automation_runs_automation_id ON public.planning_automation_runs(automation_id);
CREATE INDEX idx_planning_automation_runs_workspace_id ON public.planning_automation_runs(workspace_id);
CREATE INDEX idx_planning_automation_runs_started_at ON public.planning_automation_runs(started_at DESC);

-- Enable Row Level Security
ALTER TABLE public.planning_automation_runs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view runs from their workspace
CREATE POLICY "Users can view runs from their workspace"
  ON public.planning_automation_runs FOR SELECT
  USING (is_member_of_workspace(auth.uid(), workspace_id));

-- Policy: Allow service role to insert (for edge functions)
CREATE POLICY "Service role can insert runs"
  ON public.planning_automation_runs FOR INSERT
  WITH CHECK (true);

-- Policy: Allow service role to update (for edge functions)
CREATE POLICY "Service role can update runs"
  ON public.planning_automation_runs FOR UPDATE
  USING (true);