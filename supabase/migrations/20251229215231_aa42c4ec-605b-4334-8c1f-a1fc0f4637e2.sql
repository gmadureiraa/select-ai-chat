-- Add unique constraint for story_id and client_id to enable upsert
-- Only add if story_id is not null to avoid duplicates with null values
CREATE UNIQUE INDEX IF NOT EXISTS instagram_stories_story_id_client_id_unique 
ON instagram_stories (story_id, client_id) 
WHERE story_id IS NOT NULL;