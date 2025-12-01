-- Create research_connections table to store edges/connections between items
CREATE TABLE IF NOT EXISTS research_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES research_items(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES research_items(id) ON DELETE CASCADE,
  label text,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE research_connections ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view connections from their projects"
  ON research_connections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM research_projects
      WHERE research_projects.id = research_connections.project_id
      AND research_projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create connections in their projects"
  ON research_connections FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM research_projects
      WHERE research_projects.id = research_connections.project_id
      AND research_projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete connections from their projects"
  ON research_connections FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM research_projects
      WHERE research_projects.id = research_connections.project_id
      AND research_projects.user_id = auth.uid()
    )
  );