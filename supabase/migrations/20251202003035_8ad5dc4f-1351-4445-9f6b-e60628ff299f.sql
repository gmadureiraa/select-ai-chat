-- Add client_id to research_projects table
ALTER TABLE research_projects
ADD COLUMN client_id UUID REFERENCES clients(id) ON DELETE SET NULL;