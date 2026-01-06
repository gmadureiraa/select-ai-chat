-- Add new columns to instagram_posts for additional metrics and classification
ALTER TABLE instagram_posts 
ADD COLUMN IF NOT EXISTS link_clicks integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS profile_visits integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS website_taps integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS content_objective text,
ADD COLUMN IF NOT EXISTS is_collab boolean DEFAULT false;