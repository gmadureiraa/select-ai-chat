-- Tabela de tarefas internas do time (separada de planning_items, que é só para conteúdo)
CREATE TABLE public.team_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo',
  priority TEXT NOT NULL DEFAULT 'medium',
  due_date DATE,
  assigned_to UUID,
  created_by UUID NOT NULL,
  completed_at TIMESTAMPTZ,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_team_tasks_workspace ON public.team_tasks(workspace_id);
CREATE INDEX idx_team_tasks_assigned ON public.team_tasks(assigned_to);
CREATE INDEX idx_team_tasks_status ON public.team_tasks(status);
CREATE INDEX idx_team_tasks_due_date ON public.team_tasks(due_date);

-- Validation trigger (no CHECK constraints, per project rules)
CREATE OR REPLACE FUNCTION public.validate_team_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status NOT IN ('todo', 'in_progress', 'done') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  IF NEW.priority NOT IN ('low', 'medium', 'high', 'urgent') THEN
    RAISE EXCEPTION 'Invalid priority: %', NEW.priority;
  END IF;
  -- Auto-set completed_at when moving to done
  IF NEW.status = 'done' AND (OLD.status IS DISTINCT FROM 'done' OR OLD IS NULL) THEN
    NEW.completed_at = COALESCE(NEW.completed_at, now());
  ELSIF NEW.status <> 'done' THEN
    NEW.completed_at = NULL;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_team_task
BEFORE INSERT OR UPDATE ON public.team_tasks
FOR EACH ROW EXECUTE FUNCTION public.validate_team_task();

-- RLS
ALTER TABLE public.team_tasks ENABLE ROW LEVEL SECURITY;

-- Members of workspace can see all tasks of their workspace
CREATE POLICY "Workspace members can view team tasks"
ON public.team_tasks FOR SELECT
USING (public.is_workspace_member(auth.uid(), workspace_id));

-- Members (non-viewer) can create tasks in their workspace
CREATE POLICY "Workspace members can create team tasks"
ON public.team_tasks FOR INSERT
WITH CHECK (
  public.is_workspace_member(auth.uid(), workspace_id)
  AND public.can_modify_data(auth.uid())
  AND created_by = auth.uid()
);

-- Members can update tasks in their workspace
CREATE POLICY "Workspace members can update team tasks"
ON public.team_tasks FOR UPDATE
USING (
  public.is_workspace_member(auth.uid(), workspace_id)
  AND public.can_modify_data(auth.uid())
);

-- Owner/admin or creator can delete
CREATE POLICY "Admins or creators can delete team tasks"
ON public.team_tasks FOR DELETE
USING (
  public.is_workspace_member(auth.uid(), workspace_id)
  AND (
    public.can_delete_in_specific_workspace(auth.uid(), workspace_id)
    OR created_by = auth.uid()
  )
);

-- Realtime
ALTER TABLE public.team_tasks REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_tasks;