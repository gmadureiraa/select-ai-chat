
-- ============================================================================
-- ONDA 1 (idempotente)
-- ============================================================================

ALTER TABLE public.team_tasks ADD COLUMN IF NOT EXISTS labels jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.team_tasks ADD COLUMN IF NOT EXISTS mentions uuid[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.team_task_workspace(_task_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT workspace_id FROM public.team_tasks WHERE id = _task_id;
$$;

-- checklist
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

DROP POLICY IF EXISTS "checklist visible to workspace members" ON public.team_task_checklist_items;
CREATE POLICY "checklist visible to workspace members" ON public.team_task_checklist_items
FOR SELECT TO authenticated
USING (public.is_workspace_member(auth.uid(), public.team_task_workspace(task_id)));

DROP POLICY IF EXISTS "checklist insert by workspace members" ON public.team_task_checklist_items;
CREATE POLICY "checklist insert by workspace members" ON public.team_task_checklist_items
FOR INSERT TO authenticated
WITH CHECK (public.is_workspace_member(auth.uid(), public.team_task_workspace(task_id)));

DROP POLICY IF EXISTS "checklist update by workspace members" ON public.team_task_checklist_items;
CREATE POLICY "checklist update by workspace members" ON public.team_task_checklist_items
FOR UPDATE TO authenticated
USING (public.is_workspace_member(auth.uid(), public.team_task_workspace(task_id)));

DROP POLICY IF EXISTS "checklist delete by workspace members" ON public.team_task_checklist_items;
CREATE POLICY "checklist delete by workspace members" ON public.team_task_checklist_items
FOR DELETE TO authenticated
USING (public.is_workspace_member(auth.uid(), public.team_task_workspace(task_id)));

-- comments
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

DROP POLICY IF EXISTS "comments visible to workspace members" ON public.team_task_comments;
CREATE POLICY "comments visible to workspace members" ON public.team_task_comments
FOR SELECT TO authenticated
USING (public.is_workspace_member(auth.uid(), public.team_task_workspace(task_id)));

DROP POLICY IF EXISTS "comments insert by workspace members" ON public.team_task_comments;
CREATE POLICY "comments insert by workspace members" ON public.team_task_comments
FOR INSERT TO authenticated
WITH CHECK (
  public.is_workspace_member(auth.uid(), public.team_task_workspace(task_id))
  AND author_id = auth.uid()
);

DROP POLICY IF EXISTS "comments update by author" ON public.team_task_comments;
CREATE POLICY "comments update by author" ON public.team_task_comments
FOR UPDATE TO authenticated
USING (author_id = auth.uid());

DROP POLICY IF EXISTS "comments delete by author" ON public.team_task_comments;
CREATE POLICY "comments delete by author" ON public.team_task_comments
FOR DELETE TO authenticated
USING (author_id = auth.uid());

-- realtime (idempotente via DO block)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='team_task_checklist_items') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.team_task_checklist_items';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='team_task_comments') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.team_task_comments';
  END IF;
END $$;

-- estender enum textual
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
CHECK (type = ANY (ARRAY[
  'assignment','due_date','mention','publish_reminder','publish_failed',
  'publish_success','automation_completed',
  'task_assigned','task_mention','task_due_soon','task_comment'
]));

-- preferences
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  channel text NOT NULL CHECK (channel IN ('in_app','push','telegram')),
  type text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, workspace_id, channel, type)
);
CREATE INDEX IF NOT EXISTS idx_notif_prefs_user_ws ON public.notification_preferences(user_id, workspace_id);
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prefs_select_own" ON public.notification_preferences;
CREATE POLICY "prefs_select_own" ON public.notification_preferences
FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "prefs_modify_own" ON public.notification_preferences;
CREATE POLICY "prefs_modify_own" ON public.notification_preferences
FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.notif_pref_enabled(_user uuid, _workspace uuid, _channel text, _type text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT enabled FROM public.notification_preferences
     WHERE user_id = _user AND workspace_id = _workspace
       AND channel = _channel AND type = _type LIMIT 1),
    CASE WHEN _channel = 'push' THEN false ELSE true END
  );
$$;

-- triggers de notificação de tarefa
CREATE OR REPLACE FUNCTION public.notify_on_task_assignment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.assigned_to IS NULL THEN RETURN NEW; END IF;
  IF (TG_OP = 'UPDATE' AND OLD.assigned_to IS NOT DISTINCT FROM NEW.assigned_to) THEN RETURN NEW; END IF;
  IF NEW.assigned_to = NEW.created_by THEN RETURN NEW; END IF;

  IF public.notif_pref_enabled(NEW.assigned_to, NEW.workspace_id, 'in_app', 'task_assigned') THEN
    INSERT INTO public.notifications (user_id, workspace_id, type, title, message, entity_type, entity_id, metadata)
    VALUES (
      NEW.assigned_to, NEW.workspace_id, 'task_assigned',
      'Nova tarefa atribuída a você',
      NEW.title,
      'team_task', NEW.id,
      jsonb_build_object('priority', NEW.priority, 'due_date', NEW.due_date)
    );
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_task_assignment ON public.team_tasks;
CREATE TRIGGER trg_notify_task_assignment
AFTER INSERT OR UPDATE OF assigned_to ON public.team_tasks
FOR EACH ROW EXECUTE FUNCTION public.notify_on_task_assignment();

CREATE OR REPLACE FUNCTION public.notify_on_task_comment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_task RECORD;
  v_uid uuid;
  v_recipients uuid[] := '{}';
BEGIN
  SELECT workspace_id, title, created_by, assigned_to INTO v_task
  FROM public.team_tasks WHERE id = NEW.task_id;
  IF v_task IS NULL THEN RETURN NEW; END IF;

  FOREACH v_uid IN ARRAY COALESCE(NEW.mentions, '{}'::uuid[]) LOOP
    IF v_uid = NEW.author_id THEN CONTINUE; END IF;
    IF v_uid = ANY(v_recipients) THEN CONTINUE; END IF;
    v_recipients := array_append(v_recipients, v_uid);
    IF public.notif_pref_enabled(v_uid, v_task.workspace_id, 'in_app', 'task_mention') THEN
      INSERT INTO public.notifications (user_id, workspace_id, type, title, message, entity_type, entity_id, metadata)
      VALUES (v_uid, v_task.workspace_id, 'task_mention',
        'Você foi mencionado em uma tarefa', LEFT(NEW.content, 140),
        'team_task', NEW.task_id,
        jsonb_build_object('comment_id', NEW.id, 'task_title', v_task.title));
    END IF;
  END LOOP;

  FOREACH v_uid IN ARRAY ARRAY[v_task.created_by, v_task.assigned_to] LOOP
    IF v_uid IS NULL OR v_uid = NEW.author_id OR v_uid = ANY(v_recipients) THEN CONTINUE; END IF;
    v_recipients := array_append(v_recipients, v_uid);
    IF public.notif_pref_enabled(v_uid, v_task.workspace_id, 'in_app', 'task_comment') THEN
      INSERT INTO public.notifications (user_id, workspace_id, type, title, message, entity_type, entity_id, metadata)
      VALUES (v_uid, v_task.workspace_id, 'task_comment',
        'Novo comentário em tarefa', LEFT(NEW.content, 140),
        'team_task', NEW.task_id,
        jsonb_build_object('comment_id', NEW.id, 'task_title', v_task.title));
    END IF;
  END LOOP;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_task_comment ON public.team_task_comments;
CREATE TRIGGER trg_notify_task_comment
AFTER INSERT ON public.team_task_comments
FOR EACH ROW EXECUTE FUNCTION public.notify_on_task_comment();

CREATE OR REPLACE FUNCTION public.notify_on_task_description_mention()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_old uuid[] := COALESCE(OLD.mentions, '{}'::uuid[]);
  v_new uuid[] := COALESCE(NEW.mentions, '{}'::uuid[]);
  v_uid uuid;
BEGIN
  FOREACH v_uid IN ARRAY v_new LOOP
    IF v_uid = NEW.created_by THEN CONTINUE; END IF;
    IF TG_OP = 'UPDATE' AND v_uid = ANY(v_old) THEN CONTINUE; END IF;
    IF public.notif_pref_enabled(v_uid, NEW.workspace_id, 'in_app', 'task_mention') THEN
      INSERT INTO public.notifications (user_id, workspace_id, type, title, message, entity_type, entity_id, metadata)
      VALUES (v_uid, NEW.workspace_id, 'task_mention',
        'Você foi mencionado em uma tarefa', NEW.title,
        'team_task', NEW.id, '{}'::jsonb);
    END IF;
  END LOOP;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_task_desc_mention ON public.team_tasks;
CREATE TRIGGER trg_notify_task_desc_mention
AFTER INSERT OR UPDATE OF mentions ON public.team_tasks
FOR EACH ROW EXECUTE FUNCTION public.notify_on_task_description_mention();
