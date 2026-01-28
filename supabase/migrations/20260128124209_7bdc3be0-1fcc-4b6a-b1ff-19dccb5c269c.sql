-- Add notification_preferences column to profiles (granular notification settings)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{
  "push_enabled": true,
  "assignment_notifications": true,
  "due_date_notifications": true,
  "publish_notifications": true,
  "mention_notifications": true
}'::jsonb;

-- Create or replace function to notify on planning item assignment
CREATE OR REPLACE FUNCTION public.notify_on_planning_assignment()
RETURNS TRIGGER AS $$
DECLARE
  v_title TEXT;
  v_workspace_id UUID;
  v_client_id UUID;
  v_platform TEXT;
  v_prefs JSONB;
BEGIN
  -- Only trigger if assigned_to changed and is not null
  IF (NEW.assigned_to IS DISTINCT FROM OLD.assigned_to) AND NEW.assigned_to IS NOT NULL THEN
    -- Get user preferences
    SELECT notification_preferences INTO v_prefs FROM profiles WHERE id = NEW.assigned_to;
    
    -- Check if assignment notifications are enabled (default true)
    IF COALESCE(v_prefs->>'assignment_notifications', 'true')::boolean THEN
      -- Get values
      v_title := COALESCE(NEW.title, 'Item sem título');
      v_workspace_id := NEW.workspace_id;
      v_client_id := NEW.client_id;
      v_platform := NEW.platform;
      
      -- Insert notification
      INSERT INTO public.notifications (
        user_id,
        workspace_id,
        type,
        title,
        message,
        entity_type,
        entity_id,
        metadata
      ) VALUES (
        NEW.assigned_to,
        v_workspace_id,
        'assignment',
        'Novo item atribuído a você',
        format('O item "%s" foi atribuído a você', v_title),
        'planning_item',
        NEW.id,
        jsonb_build_object(
          'client_id', v_client_id,
          'platform', v_platform,
          'scheduled_at', NEW.scheduled_at
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop existing trigger if exists and recreate
DROP TRIGGER IF EXISTS planning_item_assignment_trigger ON public.planning_items;

CREATE TRIGGER planning_item_assignment_trigger
  AFTER UPDATE ON public.planning_items
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_planning_assignment();

-- Also trigger on INSERT when assigned_to is set
DROP TRIGGER IF EXISTS planning_item_assignment_insert_trigger ON public.planning_items;

CREATE TRIGGER planning_item_assignment_insert_trigger
  AFTER INSERT ON public.planning_items
  FOR EACH ROW
  WHEN (NEW.assigned_to IS NOT NULL)
  EXECUTE FUNCTION public.notify_on_planning_assignment();

-- Create function for due date reminder notifications
CREATE OR REPLACE FUNCTION public.create_due_date_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item RECORD;
  v_prefs JSONB;
BEGIN
  -- Find items due today that haven't been published
  FOR item IN 
    SELECT 
      pi.id, 
      pi.title, 
      pi.assigned_to, 
      pi.created_by,
      pi.workspace_id, 
      pi.scheduled_at, 
      pi.client_id, 
      pi.platform
    FROM public.planning_items pi
    WHERE pi.scheduled_at IS NOT NULL
      AND pi.scheduled_at::date = CURRENT_DATE
      AND COALESCE(pi.assigned_to, pi.created_by) IS NOT NULL
      AND pi.status NOT IN ('published', 'failed')
  LOOP
    -- Get user preferences
    SELECT notification_preferences INTO v_prefs 
    FROM profiles 
    WHERE id = COALESCE(item.assigned_to, item.created_by);
    
    -- Check if due date notifications are enabled (default true)
    IF COALESCE(v_prefs->>'due_date_notifications', 'true')::boolean THEN
      -- Check if notification already exists for this item today
      IF NOT EXISTS (
        SELECT 1 FROM public.notifications 
        WHERE entity_id = item.id 
          AND type = 'due_date'
          AND created_at::date = CURRENT_DATE
      ) THEN
        INSERT INTO public.notifications (
          user_id, 
          workspace_id, 
          type, 
          title, 
          message, 
          entity_type, 
          entity_id, 
          metadata
        ) VALUES (
          COALESCE(item.assigned_to, item.created_by),
          item.workspace_id,
          'due_date',
          'Publicação agendada para hoje',
          format('"%s" está agendado para hoje', COALESCE(item.title, 'Item sem título')),
          'planning_item',
          item.id,
          jsonb_build_object(
            'scheduled_at', item.scheduled_at, 
            'client_id', item.client_id, 
            'platform', item.platform
          )
        );
      END IF;
    END IF;
  END LOOP;
END;
$$;