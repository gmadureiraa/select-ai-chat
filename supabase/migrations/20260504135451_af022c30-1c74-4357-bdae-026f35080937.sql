
ALTER TABLE public.team_tasks ADD COLUMN IF NOT EXISTS labels jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS public.team_task_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.team_tasks(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_done boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_team_task_checklist_task ON public.team_task_checklist_items(task_id);
ALTER TABLE public.team_task_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.team_task_workspace(_task_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT workspace_id FROM public.team_tasks WHERE id = _task_id;
$$;

CREATE POLICY "checklist visible to workspace members" ON public.team_task_checklist_items
FOR SELECT TO authenticated
USING (public.is_workspace_member(auth.uid(), public.team_task_workspace(task_id)));

CREATE POLICY "checklist insert by workspace members" ON public.team_task_checklist_items
FOR INSERT TO authenticated
WITH CHECK (public.is_workspace_member(auth.uid(), public.team_task_workspace(task_id)));

CREATE POLICY "checklist update by workspace members" ON public.team_task_checklist_items
FOR UPDATE TO authenticated
USING (public.is_workspace_member(auth.uid(), public.team_task_workspace(task_id)));

CREATE POLICY "checklist delete by workspace members" ON public.team_task_checklist_items
FOR DELETE TO authenticated
USING (public.is_workspace_member(auth.uid(), public.team_task_workspace(task_id)));

CREATE TABLE IF NOT EXISTS public.team_task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.team_tasks(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  content text NOT NULL,
  mentions uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_team_task_comments_task ON public.team_task_comments(task_id);
ALTER TABLE public.team_task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comments visible to workspace members" ON public.team_task_comments
FOR SELECT TO authenticated
USING (public.is_workspace_member(auth.uid(), public.team_task_workspace(task_id)));

CREATE POLICY "comments insert by author" ON public.team_task_comments
FOR INSERT TO authenticated
WITH CHECK (author_id = auth.uid() AND public.is_workspace_member(auth.uid(), public.team_task_workspace(task_id)));

CREATE POLICY "comments update by author" ON public.team_task_comments
FOR UPDATE TO authenticated USING (author_id = auth.uid());

CREATE POLICY "comments delete by author or admin" ON public.team_task_comments
FOR DELETE TO authenticated
USING (author_id = auth.uid() OR public.can_delete_in_workspace(auth.uid()));

CREATE OR REPLACE FUNCTION public.notify_team_task_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_should_notify boolean := false; v_actor uuid;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.assigned_to IS NOT NULL THEN v_should_notify := true;
  ELSIF TG_OP = 'UPDATE' AND NEW.assigned_to IS DISTINCT FROM OLD.assigned_to AND NEW.assigned_to IS NOT NULL THEN v_should_notify := true;
  END IF;
  IF v_should_notify THEN
    v_actor := COALESCE(auth.uid(), NEW.created_by);
    IF NEW.assigned_to <> COALESCE(v_actor, '00000000-0000-0000-0000-000000000000'::uuid) THEN
      INSERT INTO public.notifications (user_id, workspace_id, type, title, message, link, metadata)
      VALUES (NEW.assigned_to, NEW.workspace_id, 'task_assigned', 'Tarefa atribuída a você', NEW.title,
              '/?tab=tasks&task=' || NEW.id::text,
              jsonb_build_object('task_id', NEW.id, 'priority', NEW.priority, 'due_date', NEW.due_date));
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_team_task_assignment ON public.team_tasks;
CREATE TRIGGER trg_notify_team_task_assignment
AFTER INSERT OR UPDATE OF assigned_to ON public.team_tasks
FOR EACH ROW EXECUTE FUNCTION public.notify_team_task_assignment();

CREATE OR REPLACE FUNCTION public.notify_team_task_comment_mentions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_workspace uuid; v_task_title text; v_user uuid;
BEGIN
  SELECT workspace_id, title INTO v_workspace, v_task_title FROM public.team_tasks WHERE id = NEW.task_id;
  IF v_workspace IS NULL THEN RETURN NEW; END IF;
  IF NEW.mentions IS NOT NULL THEN
    FOREACH v_user IN ARRAY NEW.mentions LOOP
      IF v_user IS NOT NULL AND v_user <> NEW.author_id THEN
        INSERT INTO public.notifications (user_id, workspace_id, type, title, message, link, metadata)
        VALUES (v_user, v_workspace, 'task_mention', 'Você foi mencionado em uma tarefa', v_task_title,
                '/?tab=tasks&task=' || NEW.task_id::text,
                jsonb_build_object('task_id', NEW.task_id, 'comment_id', NEW.id));
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_team_task_comment_mentions ON public.team_task_comments;
CREATE TRIGGER trg_notify_team_task_comment_mentions
AFTER INSERT ON public.team_task_comments
FOR EACH ROW EXECUTE FUNCTION public.notify_team_task_comment_mentions();

DROP TRIGGER IF EXISTS trg_team_task_comments_updated ON public.team_task_comments;
CREATE TRIGGER trg_team_task_comments_updated BEFORE UPDATE ON public.team_task_comments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_team_task_checklist_updated ON public.team_task_checklist_items;
CREATE TRIGGER trg_team_task_checklist_updated BEFORE UPDATE ON public.team_task_checklist_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.team_task_checklist_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_task_comments;
