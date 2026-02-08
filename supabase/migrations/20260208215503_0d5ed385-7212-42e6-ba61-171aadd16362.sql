-- Update trigger_push_notification to respect user preferences
CREATE OR REPLACE FUNCTION public.trigger_push_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  push_payload JSONB;
  workspace_slug TEXT;
  v_prefs JSONB;
  v_push_enabled BOOLEAN;
BEGIN
  -- Check user push notification preferences
  SELECT notification_preferences INTO v_prefs 
  FROM profiles 
  WHERE id = NEW.user_id;
  
  v_push_enabled := COALESCE((v_prefs->>'push_notifications')::boolean, true);
  
  -- Skip push if user has disabled push notifications
  IF NOT v_push_enabled THEN
    RETURN NEW;
  END IF;

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
$function$;