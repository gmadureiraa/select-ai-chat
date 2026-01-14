-- Add content columns to instagram_posts table
ALTER TABLE instagram_posts 
ADD COLUMN IF NOT EXISTS full_content TEXT,
ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS content_synced_at TIMESTAMP WITH TIME ZONE;

-- Add comments for documentation
COMMENT ON COLUMN instagram_posts.full_content IS 'Full text content including image transcriptions';
COMMENT ON COLUMN instagram_posts.images IS 'Array of downloaded image URLs from storage';
COMMENT ON COLUMN instagram_posts.content_synced_at IS 'Timestamp when full content was synced';