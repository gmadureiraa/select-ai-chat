-- Phase 5: Database Enhancements

-- Add indexes for platform_metrics performance
CREATE INDEX IF NOT EXISTS idx_platform_metrics_client_date 
ON platform_metrics(client_id, metric_date DESC);

CREATE INDEX IF NOT EXISTS idx_platform_metrics_platform_date 
ON platform_metrics(platform, metric_date DESC);

CREATE INDEX IF NOT EXISTS idx_platform_metrics_client_platform_date 
ON platform_metrics(client_id, platform, metric_date DESC);

-- Add notes field to performance_goals
ALTER TABLE performance_goals 
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add analyzed_at field to instagram_posts for post-publication tracking
ALTER TABLE instagram_posts 
ADD COLUMN IF NOT EXISTS analyzed_at TIMESTAMP WITH TIME ZONE;

-- Add index for analyzed_at for tracking unanalyzed posts
CREATE INDEX IF NOT EXISTS idx_instagram_posts_analyzed_at 
ON instagram_posts(analyzed_at) 
WHERE analyzed_at IS NULL;

-- Add index for post-publication performance tracking
CREATE INDEX IF NOT EXISTS idx_instagram_posts_client_posted 
ON instagram_posts(client_id, posted_at DESC);

-- Add composite index for youtube videos performance tracking
CREATE INDEX IF NOT EXISTS idx_youtube_videos_client_published 
ON youtube_videos(client_id, published_at DESC);