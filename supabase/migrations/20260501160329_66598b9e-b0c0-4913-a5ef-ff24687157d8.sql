-- Preferences table
CREATE TABLE IF NOT EXISTS public.webhook_alert_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
  alerts_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_alert_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view alert preferences"
ON public.webhook_alert_preferences FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert alert preferences"
ON public.webhook_alert_preferences FOR INSERT
TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update alert preferences"
ON public.webhook_alert_preferences FOR UPDATE
TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete alert preferences"
ON public.webhook_alert_preferences FOR DELETE
TO authenticated USING (true);

CREATE TRIGGER update_webhook_alert_preferences_updated_at
BEFORE UPDATE ON public.webhook_alert_preferences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Extend webhook_events_log
ALTER TABLE public.webhook_events_log
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_webhook_events_log_client_id ON public.webhook_events_log(client_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_log_event_type ON public.webhook_events_log(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_log_created_at ON public.webhook_events_log(created_at DESC);