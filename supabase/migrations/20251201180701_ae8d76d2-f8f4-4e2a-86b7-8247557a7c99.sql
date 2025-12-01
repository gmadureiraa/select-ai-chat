-- Add default user_id to research_projects
ALTER TABLE research_projects 
ALTER COLUMN user_id SET DEFAULT auth.uid();