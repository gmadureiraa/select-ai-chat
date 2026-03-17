
-- Table to store feedback on automation-generated content
CREATE TABLE public.automation_content_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planning_item_id UUID NOT NULL REFERENCES public.planning_items(id) ON DELETE CASCADE,
  automation_id UUID REFERENCES public.planning_automations(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('like', 'dislike', 'delete')),
  feedback_reason TEXT,
  content_snapshot TEXT,
  platform TEXT,
  content_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for loading feedback into automation context
CREATE INDEX idx_automation_feedback_client ON automation_content_feedback(client_id, feedback_type);
CREATE INDEX idx_automation_feedback_automation ON automation_content_feedback(automation_id, feedback_type);

-- RLS
ALTER TABLE public.automation_content_feedback ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (used by edge functions)
CREATE POLICY "Service role full access" ON public.automation_content_feedback
  FOR ALL USING (true) WITH CHECK (true);
