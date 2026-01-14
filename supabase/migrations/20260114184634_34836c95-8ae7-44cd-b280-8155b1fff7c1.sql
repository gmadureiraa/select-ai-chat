-- Add content_library_id reference to instagram_posts
ALTER TABLE instagram_posts 
ADD COLUMN IF NOT EXISTS content_library_id UUID REFERENCES client_content_library(id) ON DELETE SET NULL;

-- Add content_library_id reference to youtube_videos
ALTER TABLE youtube_videos 
ADD COLUMN IF NOT EXISTS content_library_id UUID REFERENCES client_content_library(id) ON DELETE SET NULL;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_instagram_posts_library ON instagram_posts(content_library_id) WHERE content_library_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_youtube_videos_library ON youtube_videos(content_library_id) WHERE content_library_id IS NOT NULL;