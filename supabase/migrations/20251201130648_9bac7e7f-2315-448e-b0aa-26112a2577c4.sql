-- Create activity types enum
CREATE TYPE activity_type AS ENUM (
  'client_created',
  'client_updated',
  'client_deleted',
  'template_created',
  'template_updated',
  'template_deleted',
  'conversation_created',
  'message_sent',
  'image_generated',
  'image_deleted',
  'automation_created',
  'automation_updated',
  'automation_deleted',
  'automation_executed',
  'reverse_engineering_analysis',
  'reverse_engineering_generation',
  'document_uploaded',
  'website_scraped',
  'metrics_fetched'
);

-- Create user_activities table
CREATE TABLE IF NOT EXISTS user_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  activity_type activity_type NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  entity_name TEXT,
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_user_activities_user_id ON user_activities(user_id);
CREATE INDEX idx_user_activities_created_at ON user_activities(created_at DESC);
CREATE INDEX idx_user_activities_activity_type ON user_activities(activity_type);

-- Enable RLS
ALTER TABLE user_activities ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own activities"
  ON user_activities
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own activities"
  ON user_activities
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create function to log activity
CREATE OR REPLACE FUNCTION log_user_activity(
  p_activity_type activity_type,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_entity_name TEXT DEFAULT NULL,
  p_description TEXT DEFAULT '',
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_activity_id UUID;
BEGIN
  INSERT INTO user_activities (
    user_id,
    activity_type,
    entity_type,
    entity_id,
    entity_name,
    description,
    metadata
  ) VALUES (
    auth.uid(),
    p_activity_type,
    p_entity_type,
    p_entity_id,
    p_entity_name,
    p_description,
    p_metadata
  )
  RETURNING id INTO v_activity_id;
  
  RETURN v_activity_id;
END;
$$;