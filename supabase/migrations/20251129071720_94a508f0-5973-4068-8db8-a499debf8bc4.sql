-- Add structured fields to clients table
ALTER TABLE public.clients 
ADD COLUMN social_media JSONB DEFAULT '{}'::jsonb,
ADD COLUMN tags JSONB DEFAULT '{}'::jsonb;

-- Create table for client websites with scraped content
CREATE TABLE public.client_websites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  scraped_content TEXT,
  scraped_markdown TEXT,
  last_scraped_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(client_id, url)
);

-- Enable RLS on client_websites
ALTER TABLE public.client_websites ENABLE ROW LEVEL SECURITY;

-- Create policies for client_websites
CREATE POLICY "Allow all operations on client_websites" 
ON public.client_websites 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Add indexes for better performance
CREATE INDEX idx_client_websites_client_id ON public.client_websites(client_id);