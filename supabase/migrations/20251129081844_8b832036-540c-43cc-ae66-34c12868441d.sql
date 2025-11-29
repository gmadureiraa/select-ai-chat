-- Add more detailed scheduling and integration fields to automations table
ALTER TABLE automations 
ADD COLUMN IF NOT EXISTS schedule_days text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS schedule_time text DEFAULT '09:00',
ADD COLUMN IF NOT EXISTS data_sources jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS actions jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS webhook_url text,
ADD COLUMN IF NOT EXISTS email_recipients text[] DEFAULT '{}';

-- Add index for schedule queries
CREATE INDEX IF NOT EXISTS idx_automations_schedule ON automations(schedule_type, schedule_days, schedule_time, is_active);

-- Add comments for documentation
COMMENT ON COLUMN automations.schedule_days IS 'Array of days when automation should run (e.g., ["monday", "wednesday", "friday"])';
COMMENT ON COLUMN automations.schedule_time IS 'Time of day to run automation in HH:MM format';
COMMENT ON COLUMN automations.data_sources IS 'JSON array of external data sources/APIs to fetch data from';
COMMENT ON COLUMN automations.actions IS 'JSON array of actions to perform (e.g., save to database, send email, webhook)';
COMMENT ON COLUMN automations.webhook_url IS 'Optional webhook URL to send results to';
COMMENT ON COLUMN automations.email_recipients IS 'Array of email addresses to send results to';