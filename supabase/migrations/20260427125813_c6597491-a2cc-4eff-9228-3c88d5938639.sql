ALTER TABLE public.viral_carousels
  ADD COLUMN IF NOT EXISTS published_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS scheduled_for timestamp with time zone,
  ADD COLUMN IF NOT EXISTS last_publish_media_urls jsonb;