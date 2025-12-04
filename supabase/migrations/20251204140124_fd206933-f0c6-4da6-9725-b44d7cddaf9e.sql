-- Create youtube_videos table for storing individual video metrics
CREATE TABLE public.youtube_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL,
  title TEXT NOT NULL,
  published_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  total_views INTEGER DEFAULT 0,
  watch_hours NUMERIC(12,4) DEFAULT 0,
  subscribers_gained INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  click_rate NUMERIC(5,2) DEFAULT 0,
  thumbnail_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create unique index for upsert operations
CREATE UNIQUE INDEX idx_youtube_videos_client_video ON public.youtube_videos(client_id, video_id);

-- Create index for faster queries by client
CREATE INDEX idx_youtube_videos_client_id ON public.youtube_videos(client_id);

-- Enable RLS
ALTER TABLE public.youtube_videos ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Workspace members can view youtube videos"
ON public.youtube_videos
FOR SELECT
USING (client_workspace_accessible(client_id, auth.uid()));

CREATE POLICY "Workspace members can create youtube videos"
ON public.youtube_videos
FOR INSERT
WITH CHECK (client_workspace_accessible(client_id, auth.uid()));

CREATE POLICY "Workspace members can update youtube videos"
ON public.youtube_videos
FOR UPDATE
USING (client_workspace_accessible(client_id, auth.uid()));

CREATE POLICY "Only owners/admins can delete youtube videos"
ON public.youtube_videos
FOR DELETE
USING (client_workspace_can_delete(client_id, auth.uid()));

-- Add updated_at trigger
CREATE TRIGGER update_youtube_videos_updated_at
BEFORE UPDATE ON public.youtube_videos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();