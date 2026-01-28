-- Função para disparar push notification quando notification é criada
CREATE OR REPLACE FUNCTION public.trigger_push_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  push_payload JSONB;
  workspace_slug TEXT;
BEGIN
  -- Buscar slug do workspace para construir URL
  SELECT slug INTO workspace_slug FROM workspaces WHERE id = NEW.workspace_id;
  
  -- Construir payload do push
  push_payload := jsonb_build_object(
    'title', NEW.title,
    'body', COALESCE(NEW.message, ''),
    'icon', '/icons/icon-192.png',
    'badge', '/icons/icon-192.png',
    'tag', NEW.id::text,
    'data', jsonb_build_object(
      'entity_type', NEW.entity_type,
      'entity_id', NEW.entity_id,
      'workspace_slug', workspace_slug,
      'notification_id', NEW.id
    )
  );
  
  -- Inserir na fila de push para processamento assíncrono
  INSERT INTO public.push_notification_queue (user_id, payload, created_at)
  VALUES (NEW.user_id, push_payload, now());
  
  RETURN NEW;
END;
$$;

-- Tabela de fila para processar pushes de forma assíncrona
CREATE TABLE IF NOT EXISTS public.push_notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índice para buscar não processados
CREATE INDEX IF NOT EXISTS idx_push_queue_pending 
ON public.push_notification_queue(processed, created_at) 
WHERE processed = false;

-- RLS
ALTER TABLE public.push_notification_queue ENABLE ROW LEVEL SECURITY;

-- Apenas service_role pode acessar a fila
CREATE POLICY "Service role only"
ON public.push_notification_queue
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Trigger para disparar push quando notification é inserida
DROP TRIGGER IF EXISTS on_notification_created_push ON public.notifications;
CREATE TRIGGER on_notification_created_push
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.trigger_push_notification();