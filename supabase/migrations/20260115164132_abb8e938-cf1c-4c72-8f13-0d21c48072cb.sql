-- Add is_favorite column to instagram_posts, twitter_posts, linkedin_posts, and client_content_library
ALTER TABLE public.instagram_posts ADD COLUMN IF NOT EXISTS is_favorite boolean DEFAULT false;
ALTER TABLE public.twitter_posts ADD COLUMN IF NOT EXISTS is_favorite boolean DEFAULT false;
ALTER TABLE public.linkedin_posts ADD COLUMN IF NOT EXISTS is_favorite boolean DEFAULT false;
ALTER TABLE public.client_content_library ADD COLUMN IF NOT EXISTS is_favorite boolean DEFAULT false;

-- Create indexes for faster favorite filtering
CREATE INDEX IF NOT EXISTS idx_instagram_posts_favorite ON public.instagram_posts(client_id, is_favorite) WHERE is_favorite = true;
CREATE INDEX IF NOT EXISTS idx_twitter_posts_favorite ON public.twitter_posts(client_id, is_favorite) WHERE is_favorite = true;
CREATE INDEX IF NOT EXISTS idx_linkedin_posts_favorite ON public.linkedin_posts(client_id, is_favorite) WHERE is_favorite = true;
CREATE INDEX IF NOT EXISTS idx_client_content_library_favorite ON public.client_content_library(client_id, is_favorite) WHERE is_favorite = true;