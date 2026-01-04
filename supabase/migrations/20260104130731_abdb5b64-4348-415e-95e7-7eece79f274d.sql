-- Tabela de notificações
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('assignment', 'due_date', 'mention', 'publish_reminder')),
  title TEXT NOT NULL,
  message TEXT,
  entity_type TEXT,
  entity_id UUID,
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB DEFAULT '{}'
);

-- Índices para performance
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, read) WHERE read = false;
CREATE INDEX idx_notifications_created ON public.notifications(created_at DESC);
CREATE INDEX idx_notifications_workspace ON public.notifications(workspace_id);

-- RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "System can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);

-- Função para notificar quando assigned_to muda
CREATE OR REPLACE FUNCTION public.notify_on_planning_assignment()
RETURNS TRIGGER AS $$
BEGIN
  -- Se assigned_to mudou e não é nulo
  IF (NEW.assigned_to IS DISTINCT FROM OLD.assigned_to) AND NEW.assigned_to IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, workspace_id, type, title, message, entity_type, entity_id, metadata)
    VALUES (
      NEW.assigned_to,
      NEW.workspace_id,
      'assignment',
      'Novo item atribuído a você',
      format('O item "%s" foi atribuído a você', NEW.title),
      'planning_item',
      NEW.id,
      jsonb_build_object('client_id', NEW.client_id, 'platform', NEW.platform)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para notificação de atribuição
CREATE TRIGGER planning_item_assignment_notification
  AFTER INSERT OR UPDATE OF assigned_to ON public.planning_items
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_planning_assignment();

-- Função para notificar lembrete de publicação (será chamada pelo cron)
CREATE OR REPLACE FUNCTION public.create_publish_reminders()
RETURNS void AS $$
DECLARE
  item RECORD;
BEGIN
  -- Buscar items que serão publicados amanhã
  FOR item IN 
    SELECT id, title, assigned_to, workspace_id, scheduled_at, client_id, platform
    FROM public.planning_items
    WHERE scheduled_at IS NOT NULL
      AND scheduled_at::date = (CURRENT_DATE + INTERVAL '1 day')::date
      AND assigned_to IS NOT NULL
      AND status NOT IN ('published', 'failed')
  LOOP
    -- Verificar se já não existe notificação para este item hoje
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications 
      WHERE entity_id = item.id 
        AND type = 'publish_reminder'
        AND created_at::date = CURRENT_DATE
    ) THEN
      INSERT INTO public.notifications (user_id, workspace_id, type, title, message, entity_type, entity_id, metadata)
      VALUES (
        item.assigned_to,
        item.workspace_id,
        'publish_reminder',
        'Lembrete: Publicação amanhã',
        format('"%s" está agendado para amanhã', item.title),
        'planning_item',
        item.id,
        jsonb_build_object('scheduled_at', item.scheduled_at, 'client_id', item.client_id, 'platform', item.platform)
      );
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;