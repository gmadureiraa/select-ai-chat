-- Add missing UPDATE policy for research_connections
CREATE POLICY "Users can update connections in their projects"
  ON research_connections FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM research_projects
      WHERE research_projects.id = research_connections.project_id
      AND research_projects.user_id = auth.uid()
    )
  );