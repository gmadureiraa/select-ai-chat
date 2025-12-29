-- Create instagram_stories table for storing story metrics
CREATE TABLE instagram_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  story_id TEXT,
  media_type TEXT DEFAULT 'image', -- 'image' or 'video'
  thumbnail_url TEXT,
  views INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  interactions INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  retention_rate DECIMAL(5,2),
  forward_taps INTEGER DEFAULT 0,
  next_story_taps INTEGER DEFAULT 0,
  back_taps INTEGER DEFAULT 0,
  exit_taps INTEGER DEFAULT 0,
  posted_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE instagram_stories ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Workspace members can view stories"
  ON instagram_stories FOR SELECT
  USING (client_workspace_accessible(client_id, auth.uid()));

CREATE POLICY "Non-viewers can create stories"
  ON instagram_stories FOR INSERT
  WITH CHECK (client_workspace_accessible(client_id, auth.uid()) AND can_modify_data(auth.uid()));

CREATE POLICY "Non-viewers can update stories"
  ON instagram_stories FOR UPDATE
  USING (client_workspace_accessible(client_id, auth.uid()) AND can_modify_data(auth.uid()));

CREATE POLICY "Only owners/admins can delete stories"
  ON instagram_stories FOR DELETE
  USING (client_workspace_can_delete(client_id, auth.uid()));

-- Create index for faster queries
CREATE INDEX idx_instagram_stories_client_id ON instagram_stories(client_id);
CREATE INDEX idx_instagram_stories_posted_at ON instagram_stories(posted_at);