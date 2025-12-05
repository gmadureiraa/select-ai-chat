-- AI Agents table
CREATE TABLE public.ai_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  system_prompt TEXT NOT NULL DEFAULT '',
  model TEXT DEFAULT 'google/gemini-2.5-flash',
  temperature DECIMAL(3,2) DEFAULT 0.7,
  tools JSONB DEFAULT '[]',
  knowledge JSONB DEFAULT '[]',
  variables JSONB DEFAULT '{}',
  memory_enabled BOOLEAN DEFAULT true,
  escalation_agent_id UUID REFERENCES ai_agents(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- AI Workflows table
CREATE TABLE public.ai_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT false,
  trigger_config JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- AI Workflow Nodes table
CREATE TABLE public.ai_workflow_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES ai_workflows(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  agent_id UUID REFERENCES ai_agents(id),
  config JSONB DEFAULT '{}',
  position_x DECIMAL DEFAULT 0,
  position_y DECIMAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- AI Workflow Connections table
CREATE TABLE public.ai_workflow_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES ai_workflows(id) ON DELETE CASCADE,
  source_node_id UUID NOT NULL REFERENCES ai_workflow_nodes(id) ON DELETE CASCADE,
  target_node_id UUID NOT NULL REFERENCES ai_workflow_nodes(id) ON DELETE CASCADE,
  connection_type TEXT DEFAULT 'default',
  label TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- AI Workflow Runs table
CREATE TABLE public.ai_workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES ai_workflows(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  trigger_data JSONB,
  execution_log JSONB DEFAULT '[]',
  result JSONB,
  error TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_workflow_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_workflow_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_workflow_runs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_agents
CREATE POLICY "Workspace members can view agents"
  ON public.ai_agents FOR SELECT
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Workspace members can create agents"
  ON public.ai_agents FOR INSERT
  WITH CHECK (workspace_id = get_user_workspace_id(auth.uid()));

CREATE POLICY "Workspace members can update agents"
  ON public.ai_agents FOR UPDATE
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Only owners/admins can delete agents"
  ON public.ai_agents FOR DELETE
  USING (is_workspace_member(auth.uid(), workspace_id) AND can_delete_in_workspace(auth.uid()));

-- RLS Policies for ai_workflows
CREATE POLICY "Workspace members can view workflows"
  ON public.ai_workflows FOR SELECT
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Workspace members can create workflows"
  ON public.ai_workflows FOR INSERT
  WITH CHECK (workspace_id = get_user_workspace_id(auth.uid()));

CREATE POLICY "Workspace members can update workflows"
  ON public.ai_workflows FOR UPDATE
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Only owners/admins can delete workflows"
  ON public.ai_workflows FOR DELETE
  USING (is_workspace_member(auth.uid(), workspace_id) AND can_delete_in_workspace(auth.uid()));

-- Helper function for workflow node access
CREATE OR REPLACE FUNCTION public.workflow_workspace_accessible(p_workflow_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM ai_workflows w
    JOIN workspace_members wm ON wm.workspace_id = w.workspace_id
    WHERE w.id = p_workflow_id AND wm.user_id = p_user_id
  )
$$;

-- RLS Policies for ai_workflow_nodes
CREATE POLICY "Workspace members can view nodes"
  ON public.ai_workflow_nodes FOR SELECT
  USING (workflow_workspace_accessible(workflow_id, auth.uid()));

CREATE POLICY "Workspace members can create nodes"
  ON public.ai_workflow_nodes FOR INSERT
  WITH CHECK (workflow_workspace_accessible(workflow_id, auth.uid()));

CREATE POLICY "Workspace members can update nodes"
  ON public.ai_workflow_nodes FOR UPDATE
  USING (workflow_workspace_accessible(workflow_id, auth.uid()));

CREATE POLICY "Workspace members can delete nodes"
  ON public.ai_workflow_nodes FOR DELETE
  USING (workflow_workspace_accessible(workflow_id, auth.uid()));

-- RLS Policies for ai_workflow_connections
CREATE POLICY "Workspace members can view connections"
  ON public.ai_workflow_connections FOR SELECT
  USING (workflow_workspace_accessible(workflow_id, auth.uid()));

CREATE POLICY "Workspace members can create connections"
  ON public.ai_workflow_connections FOR INSERT
  WITH CHECK (workflow_workspace_accessible(workflow_id, auth.uid()));

CREATE POLICY "Workspace members can update connections"
  ON public.ai_workflow_connections FOR UPDATE
  USING (workflow_workspace_accessible(workflow_id, auth.uid()));

CREATE POLICY "Workspace members can delete connections"
  ON public.ai_workflow_connections FOR DELETE
  USING (workflow_workspace_accessible(workflow_id, auth.uid()));

-- RLS Policies for ai_workflow_runs
CREATE POLICY "Workspace members can view runs"
  ON public.ai_workflow_runs FOR SELECT
  USING (workflow_workspace_accessible(workflow_id, auth.uid()));

CREATE POLICY "Workspace members can create runs"
  ON public.ai_workflow_runs FOR INSERT
  WITH CHECK (workflow_workspace_accessible(workflow_id, auth.uid()));

CREATE POLICY "Workspace members can update runs"
  ON public.ai_workflow_runs FOR UPDATE
  USING (workflow_workspace_accessible(workflow_id, auth.uid()));

-- Triggers for updated_at
CREATE TRIGGER update_ai_agents_updated_at
  BEFORE UPDATE ON public.ai_agents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_workflows_updated_at
  BEFORE UPDATE ON public.ai_workflows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();