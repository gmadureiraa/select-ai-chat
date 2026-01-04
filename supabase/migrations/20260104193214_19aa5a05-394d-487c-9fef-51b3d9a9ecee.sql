-- Add assigned_to to rss_triggers table
ALTER TABLE rss_triggers 
ADD COLUMN assigned_to uuid REFERENCES auth.users(id);

-- Create index for better performance
CREATE INDEX idx_rss_triggers_assigned_to ON rss_triggers(assigned_to);