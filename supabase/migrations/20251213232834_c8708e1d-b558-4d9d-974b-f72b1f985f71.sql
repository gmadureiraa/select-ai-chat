-- Create instagram_posts table for individual post metrics
CREATE TABLE public.instagram_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  post_id TEXT,
  post_type TEXT DEFAULT 'image',
  caption TEXT,
  posted_at TIMESTAMP WITH TIME ZONE,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  engagement_rate NUMERIC DEFAULT 0,
  thumbnail_url TEXT,
  permalink TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique constraint for upserts
CREATE UNIQUE INDEX instagram_posts_client_post_idx ON public.instagram_posts(client_id, post_id);

-- Enable RLS
ALTER TABLE public.instagram_posts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Workspace members can view instagram posts"
ON public.instagram_posts FOR SELECT
USING (client_workspace_accessible(client_id, auth.uid()));

CREATE POLICY "Workspace members can create instagram posts"
ON public.instagram_posts FOR INSERT
WITH CHECK (client_workspace_accessible(client_id, auth.uid()));

CREATE POLICY "Workspace members can update instagram posts"
ON public.instagram_posts FOR UPDATE
USING (client_workspace_accessible(client_id, auth.uid()));

CREATE POLICY "Only owners/admins can delete instagram posts"
ON public.instagram_posts FOR DELETE
USING (client_workspace_can_delete(client_id, auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_instagram_posts_updated_at
BEFORE UPDATE ON public.instagram_posts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();