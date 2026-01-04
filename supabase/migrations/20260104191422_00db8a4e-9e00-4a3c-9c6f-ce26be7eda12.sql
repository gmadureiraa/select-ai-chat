-- Add recurrence fields to planning_items
ALTER TABLE planning_items 
ADD COLUMN IF NOT EXISTS recurrence_type text CHECK (recurrence_type IN ('none', 'daily', 'weekly', 'biweekly', 'monthly')),
ADD COLUMN IF NOT EXISTS recurrence_days text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS recurrence_time time,
ADD COLUMN IF NOT EXISTS recurrence_end_date date,
ADD COLUMN IF NOT EXISTS recurrence_parent_id uuid REFERENCES planning_items(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_recurrence_template boolean DEFAULT false;

-- Create rss_triggers table
CREATE TABLE IF NOT EXISTS rss_triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  name text NOT NULL,
  rss_url text NOT NULL,
  is_active boolean DEFAULT true,
  
  -- Target configuration
  target_column_id uuid REFERENCES kanban_columns(id) ON DELETE SET NULL,
  platform text,
  content_type text,
  prompt_template text,
  auto_generate_content boolean DEFAULT false,
  
  -- Tracking
  last_checked_at timestamptz,
  last_item_guid text,
  items_seen jsonb DEFAULT '[]',
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on rss_triggers
ALTER TABLE rss_triggers ENABLE ROW LEVEL SECURITY;

-- RLS policies for rss_triggers
CREATE POLICY "Users can view rss_triggers in their workspace"
ON rss_triggers FOR SELECT
USING (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert rss_triggers in their workspace"
ON rss_triggers FOR INSERT
WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update rss_triggers in their workspace"
ON rss_triggers FOR UPDATE
USING (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete rss_triggers in their workspace"
ON rss_triggers FOR DELETE
USING (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  )
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_rss_triggers_workspace ON rss_triggers(workspace_id);
CREATE INDEX IF NOT EXISTS idx_rss_triggers_active ON rss_triggers(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_planning_items_recurrence ON planning_items(is_recurrence_template) WHERE is_recurrence_template = true;