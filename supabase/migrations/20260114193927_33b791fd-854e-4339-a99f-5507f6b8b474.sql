-- Create linkedin_posts table
CREATE TABLE IF NOT EXISTS public.linkedin_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  post_id TEXT NOT NULL,
  post_url TEXT,
  content TEXT,
  posted_at TIMESTAMPTZ,
  impressions INTEGER DEFAULT 0,
  engagements INTEGER DEFAULT 0,
  engagement_rate NUMERIC(8,4) DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  follows INTEGER DEFAULT 0,
  full_content TEXT,
  images JSONB DEFAULT '[]'::jsonb,
  content_synced_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(client_id, post_id)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_linkedin_posts_client_id ON public.linkedin_posts(client_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_posts_posted_at ON public.linkedin_posts(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_linkedin_posts_content_synced ON public.linkedin_posts(content_synced_at);

-- Enable RLS
ALTER TABLE public.linkedin_posts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for linkedin_posts
CREATE POLICY "Users can view linkedin posts for their clients"
  ON public.linkedin_posts FOR SELECT
  USING (client_id IN (
    SELECT id FROM public.clients WHERE workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Users can insert linkedin posts for their clients"
  ON public.linkedin_posts FOR INSERT
  WITH CHECK (client_id IN (
    SELECT id FROM public.clients WHERE workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Users can update linkedin posts for their clients"
  ON public.linkedin_posts FOR UPDATE
  USING (client_id IN (
    SELECT id FROM public.clients WHERE workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Users can delete linkedin posts for their clients"
  ON public.linkedin_posts FOR DELETE
  USING (client_id IN (
    SELECT id FROM public.clients WHERE workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  ));

-- Add content columns to twitter_posts if not exists
ALTER TABLE public.twitter_posts 
ADD COLUMN IF NOT EXISTS full_content TEXT,
ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS content_synced_at TIMESTAMPTZ;

-- Add comments on new columns
COMMENT ON TABLE public.linkedin_posts IS 'LinkedIn posts with metrics and content';
COMMENT ON COLUMN public.linkedin_posts.full_content IS 'Full text content including scraped data';
COMMENT ON COLUMN public.linkedin_posts.images IS 'Array of image URLs from the post';
COMMENT ON COLUMN public.linkedin_posts.content_synced_at IS 'When full content was synced';