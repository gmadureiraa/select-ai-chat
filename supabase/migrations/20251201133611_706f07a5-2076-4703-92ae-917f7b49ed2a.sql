-- Create enum for content types
CREATE TYPE public.content_type AS ENUM (
  'newsletter',
  'carousel',
  'reel_script',
  'video_script',
  'blog_post',
  'social_post',
  'other'
);

-- Create client_content_library table
CREATE TABLE public.client_content_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content_type public.content_type NOT NULL,
  content TEXT NOT NULL,
  thumbnail_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_content_library ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view content for their clients"
  ON public.client_content_library
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clients
      WHERE clients.id = client_content_library.client_id
      AND clients.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create content for their clients"
  ON public.client_content_library
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clients
      WHERE clients.id = client_content_library.client_id
      AND clients.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update content for their clients"
  ON public.client_content_library
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clients
      WHERE clients.id = client_content_library.client_id
      AND clients.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete content for their clients"
  ON public.client_content_library
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clients
      WHERE clients.id = client_content_library.client_id
      AND clients.user_id = auth.uid()
    )
  );

-- Create trigger for updated_at
CREATE TRIGGER update_client_content_library_updated_at
  BEFORE UPDATE ON public.client_content_library
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for performance
CREATE INDEX idx_client_content_library_client_id ON public.client_content_library(client_id);
CREATE INDEX idx_client_content_library_type ON public.client_content_library(content_type);