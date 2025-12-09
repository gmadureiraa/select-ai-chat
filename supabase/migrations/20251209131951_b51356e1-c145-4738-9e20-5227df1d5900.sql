-- Create twitter_tokens table for OAuth
CREATE TABLE public.twitter_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  twitter_id TEXT,
  username TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, client_id)
);

-- Enable RLS
ALTER TABLE public.twitter_tokens ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own twitter tokens"
ON public.twitter_tokens FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own twitter tokens"
ON public.twitter_tokens FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own twitter tokens"
ON public.twitter_tokens FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own twitter tokens"
ON public.twitter_tokens FOR DELETE
USING (auth.uid() = user_id);