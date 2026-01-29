-- Add auto_publish column to planning_automations table
ALTER TABLE planning_automations 
ADD COLUMN IF NOT EXISTS auto_publish BOOLEAN DEFAULT false;