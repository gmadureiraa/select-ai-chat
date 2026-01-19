-- Add video transcription fields to instagram_posts
ALTER TABLE public.instagram_posts 
ADD COLUMN IF NOT EXISTS video_transcript TEXT,
ADD COLUMN IF NOT EXISTS video_url TEXT;

-- Add transcription fields to youtube_videos
ALTER TABLE public.youtube_videos 
ADD COLUMN IF NOT EXISTS transcript TEXT,
ADD COLUMN IF NOT EXISTS content_synced_at TIMESTAMP WITH TIME ZONE;

-- Add index for finding synced content quickly
CREATE INDEX IF NOT EXISTS idx_instagram_posts_content_synced 
ON public.instagram_posts(client_id, content_synced_at) 
WHERE content_synced_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_youtube_videos_content_synced 
ON public.youtube_videos(client_id, content_synced_at) 
WHERE content_synced_at IS NOT NULL;

-- Add index for sorting by engagement
CREATE INDEX IF NOT EXISTS idx_instagram_posts_engagement 
ON public.instagram_posts(client_id, engagement_rate DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_youtube_videos_views 
ON public.youtube_videos(client_id, total_views DESC NULLS LAST);