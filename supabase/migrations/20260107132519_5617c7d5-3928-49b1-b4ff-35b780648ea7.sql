-- Create twitter_posts table for storing Twitter/X analytics data
CREATE TABLE public.twitter_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  tweet_id TEXT NOT NULL,
  content TEXT,
  posted_at TIMESTAMPTZ,
  impressions INTEGER DEFAULT 0,
  engagements INTEGER DEFAULT 0,
  engagement_rate NUMERIC(10,4) DEFAULT 0,
  retweets INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  profile_clicks INTEGER DEFAULT 0,
  url_clicks INTEGER DEFAULT 0,
  hashtag_clicks INTEGER DEFAULT 0,
  detail_expands INTEGER DEFAULT 0,
  media_views INTEGER DEFAULT 0,
  media_engagements INTEGER DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, tweet_id)
);

-- Enable RLS
ALTER TABLE public.twitter_posts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view twitter posts for their clients"
ON public.twitter_posts
FOR SELECT
USING (
  client_id IN (
    SELECT c.id FROM public.clients c
    WHERE c.user_id = auth.uid()
    OR c.workspace_id IN (
      SELECT wm.workspace_id FROM public.workspace_members wm
      WHERE wm.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can insert twitter posts for their clients"
ON public.twitter_posts
FOR INSERT
WITH CHECK (
  client_id IN (
    SELECT c.id FROM public.clients c
    WHERE c.user_id = auth.uid()
    OR c.workspace_id IN (
      SELECT wm.workspace_id FROM public.workspace_members wm
      WHERE wm.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can update twitter posts for their clients"
ON public.twitter_posts
FOR UPDATE
USING (
  client_id IN (
    SELECT c.id FROM public.clients c
    WHERE c.user_id = auth.uid()
    OR c.workspace_id IN (
      SELECT wm.workspace_id FROM public.workspace_members wm
      WHERE wm.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can delete twitter posts for their clients"
ON public.twitter_posts
FOR DELETE
USING (
  client_id IN (
    SELECT c.id FROM public.clients c
    WHERE c.user_id = auth.uid()
    OR c.workspace_id IN (
      SELECT wm.workspace_id FROM public.workspace_members wm
      WHERE wm.user_id = auth.uid()
    )
  )
);

-- Create index for faster queries
CREATE INDEX idx_twitter_posts_client_id ON public.twitter_posts(client_id);
CREATE INDEX idx_twitter_posts_posted_at ON public.twitter_posts(posted_at DESC);

-- Create trigger for updated_at
CREATE TRIGGER update_twitter_posts_updated_at
BEFORE UPDATE ON public.twitter_posts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();