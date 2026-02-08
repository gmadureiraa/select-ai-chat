-- Tabela de fila de notificações por email
CREATE TABLE public.email_notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_id UUID NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  sent_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para processar apenas pendentes
CREATE INDEX idx_email_notification_queue_pending 
ON public.email_notification_queue (created_at) 
WHERE sent_at IS NULL;

-- RLS: apenas service_role acessa
ALTER TABLE public.email_notification_queue ENABLE ROW LEVEL SECURITY;

-- Função para enfileirar email de notificação
CREATE OR REPLACE FUNCTION public.enqueue_notification_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefs JSONB;
  v_email TEXT;
  v_email_enabled BOOLEAN;
BEGIN
  -- Buscar preferências e email do usuário
  SELECT 
    p.notification_preferences,
    p.email
  INTO v_prefs, v_email
  FROM profiles p
  WHERE p.id = NEW.user_id;
  
  -- Verificar se notificações por email estão ativadas (default: true)
  v_email_enabled := COALESCE((v_prefs->>'email_notifications')::boolean, true);
  
  -- Se email habilitado e email existe, enfileirar
  IF v_email_enabled AND v_email IS NOT NULL AND v_email != '' THEN
    INSERT INTO public.email_notification_queue (user_id, notification_id, email)
    VALUES (NEW.user_id, NEW.id, v_email);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para enfileirar email após inserção de notificação
CREATE TRIGGER trigger_enqueue_notification_email
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_notification_email();