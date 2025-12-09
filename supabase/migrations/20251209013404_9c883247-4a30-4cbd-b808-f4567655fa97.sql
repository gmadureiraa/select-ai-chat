-- Create youtube_tokens table for storing OAuth tokens
CREATE TABLE public.youtube_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  channel_id TEXT,
  channel_title TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, client_id)
);

-- Enable RLS
ALTER TABLE public.youtube_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own YouTube tokens"
ON public.youtube_tokens FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own YouTube tokens"
ON public.youtube_tokens FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own YouTube tokens"
ON public.youtube_tokens FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own YouTube tokens"
ON public.youtube_tokens FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_youtube_tokens_updated_at
BEFORE UPDATE ON public.youtube_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();