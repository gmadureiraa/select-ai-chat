-- Create format_rules table for storing content format rules
CREATE TABLE public.format_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  format_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  rules JSONB NOT NULL DEFAULT '[]',
  prompt_template TEXT,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, format_id)
);

-- Enable RLS
ALTER TABLE public.format_rules ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Workspace members can view rules" ON public.format_rules 
  FOR SELECT USING (is_workspace_member(auth.uid(), workspace_id) OR is_system = true);

CREATE POLICY "Workspace members can create rules" ON public.format_rules 
  FOR INSERT WITH CHECK (is_workspace_member(auth.uid(), workspace_id) AND is_system = false);

CREATE POLICY "Workspace members can update rules" ON public.format_rules 
  FOR UPDATE USING (is_workspace_member(auth.uid(), workspace_id) AND is_system = false);

CREATE POLICY "Only admins can delete rules" ON public.format_rules 
  FOR DELETE USING (is_workspace_member(auth.uid(), workspace_id) AND can_delete_in_workspace(auth.uid()));

-- Add updated_at trigger
CREATE TRIGGER update_format_rules_updated_at
  BEFORE UPDATE ON public.format_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();