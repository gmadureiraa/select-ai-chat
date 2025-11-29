-- Create table for image generation history
CREATE TABLE IF NOT EXISTS public.image_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.client_templates(id) ON DELETE SET NULL,
  prompt TEXT NOT NULL,
  image_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.image_generations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view image generations"
  ON public.image_generations
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create image generations"
  ON public.image_generations
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete image generations"
  ON public.image_generations
  FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Add index for performance
CREATE INDEX idx_image_generations_client_id ON public.image_generations(client_id);
CREATE INDEX idx_image_generations_created_at ON public.image_generations(created_at DESC);