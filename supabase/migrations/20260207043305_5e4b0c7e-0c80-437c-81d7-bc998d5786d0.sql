-- =====================================================
-- EVOLUTION PLAN: Analytics & Feedback Loop
-- Phase 1: Database schema enhancements
-- =====================================================

-- 1.1 Add columns to ai_usage_logs for tracking format and validation
ALTER TABLE public.ai_usage_logs 
ADD COLUMN IF NOT EXISTS format_type TEXT,
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id),
ADD COLUMN IF NOT EXISTS validation_passed BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS was_repaired BOOLEAN DEFAULT false;

-- Create index for format analytics
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_format_type 
ON public.ai_usage_logs(format_type);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_client_id 
ON public.ai_usage_logs(client_id);

-- 1.2 Create content_feedback table for user feedback loop
CREATE TABLE IF NOT EXISTS public.content_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  format_type TEXT,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('approved', 'edited', 'regenerated', 'saved_to_library')),
  edit_distance INTEGER,
  original_content TEXT,
  edited_content TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.content_feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policies for content_feedback
CREATE POLICY "Users can view their own feedback"
ON public.content_feedback FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own feedback"
ON public.content_feedback FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own feedback"
ON public.content_feedback FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Workspace admins can view all feedback"
ON public.content_feedback FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM clients c
    JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
    WHERE c.id = content_feedback.client_id
    AND wm.user_id = auth.uid()
    AND wm.role IN ('owner', 'admin')
  )
);

-- Indexes for content_feedback
CREATE INDEX IF NOT EXISTS idx_content_feedback_client_id 
ON public.content_feedback(client_id);

CREATE INDEX IF NOT EXISTS idx_content_feedback_format_type 
ON public.content_feedback(format_type);

CREATE INDEX IF NOT EXISTS idx_content_feedback_feedback_type 
ON public.content_feedback(feedback_type);

CREATE INDEX IF NOT EXISTS idx_content_feedback_created_at 
ON public.content_feedback(created_at DESC);