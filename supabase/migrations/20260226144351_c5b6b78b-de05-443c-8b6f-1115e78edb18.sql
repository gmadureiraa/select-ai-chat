
-- Create engagement_opportunities table
CREATE TABLE public.engagement_opportunities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  tweet_id TEXT NOT NULL,
  author_username TEXT NOT NULL,
  author_name TEXT,
  author_avatar TEXT,
  author_followers INTEGER,
  tweet_text TEXT NOT NULL,
  tweet_metrics JSONB DEFAULT '{}'::jsonb,
  tweet_created_at TIMESTAMP WITH TIME ZONE,
  category TEXT DEFAULT 'community' CHECK (category IN ('networking', 'community', 'growth')),
  relevance_score FLOAT DEFAULT 0,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'saved', 'replied', 'dismissed')),
  reply_text TEXT,
  reply_tweet_id TEXT,
  replied_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique constraint on client + tweet to avoid duplicates
CREATE UNIQUE INDEX idx_engagement_opportunities_client_tweet ON public.engagement_opportunities(client_id, tweet_id);

-- Index for filtering by status
CREATE INDEX idx_engagement_opportunities_status ON public.engagement_opportunities(client_id, status);

-- Index for sorting by relevance
CREATE INDEX idx_engagement_opportunities_relevance ON public.engagement_opportunities(client_id, relevance_score DESC);

-- Enable RLS
ALTER TABLE public.engagement_opportunities ENABLE ROW LEVEL SECURITY;

-- RLS: workspace members can view
CREATE POLICY "Workspace members can view engagement opportunities"
ON public.engagement_opportunities
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
    WHERE c.id = engagement_opportunities.client_id
    AND wm.user_id = auth.uid()
  )
);

-- RLS: workspace members (non-viewer) can insert
CREATE POLICY "Workspace members can insert engagement opportunities"
ON public.engagement_opportunities
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.clients c
    JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
    WHERE c.id = engagement_opportunities.client_id
    AND wm.user_id = auth.uid()
    AND wm.role IN ('owner', 'admin', 'member')
  )
);

-- RLS: workspace members (non-viewer) can update
CREATE POLICY "Workspace members can update engagement opportunities"
ON public.engagement_opportunities
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
    WHERE c.id = engagement_opportunities.client_id
    AND wm.user_id = auth.uid()
    AND wm.role IN ('owner', 'admin', 'member')
  )
);

-- RLS: owners/admins can delete
CREATE POLICY "Workspace admins can delete engagement opportunities"
ON public.engagement_opportunities
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
    WHERE c.id = engagement_opportunities.client_id
    AND wm.user_id = auth.uid()
    AND wm.role IN ('owner', 'admin')
  )
);
