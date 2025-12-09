-- Add columns for storing Twitter app credentials per client
ALTER TABLE public.twitter_tokens 
ADD COLUMN IF NOT EXISTS twitter_api_key TEXT,
ADD COLUMN IF NOT EXISTS twitter_api_secret TEXT;