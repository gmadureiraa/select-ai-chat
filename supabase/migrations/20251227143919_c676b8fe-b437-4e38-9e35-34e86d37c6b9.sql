-- Create instagram_tokens table for OAuth credentials
CREATE TABLE public.instagram_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  user_access_token TEXT,
  page_id TEXT,
  page_access_token TEXT,
  instagram_business_id TEXT,
  instagram_username TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id, user_id)
);

-- Enable RLS
ALTER TABLE public.instagram_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own instagram tokens"
ON public.instagram_tokens FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own instagram tokens"
ON public.instagram_tokens FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own instagram tokens"
ON public.instagram_tokens FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own instagram tokens"
ON public.instagram_tokens FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_instagram_tokens_updated_at
  BEFORE UPDATE ON public.instagram_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();