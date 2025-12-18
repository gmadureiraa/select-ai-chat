-- Add brand_assets column to clients table
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS brand_assets JSONB DEFAULT '{}'::jsonb;

-- Create client_visual_references table for storing visual references
CREATE TABLE public.client_visual_references (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  title TEXT,
  description TEXT,
  reference_type TEXT NOT NULL DEFAULT 'style_example', -- 'logo', 'product', 'lifestyle', 'style_example', 'color_palette'
  is_primary BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_visual_references ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Workspace members can view visual references"
ON public.client_visual_references
FOR SELECT
USING (client_workspace_accessible(client_id, auth.uid()));

CREATE POLICY "Non-viewers can create visual references"
ON public.client_visual_references
FOR INSERT
WITH CHECK (client_workspace_accessible(client_id, auth.uid()) AND can_modify_data(auth.uid()));

CREATE POLICY "Non-viewers can update visual references"
ON public.client_visual_references
FOR UPDATE
USING (client_workspace_accessible(client_id, auth.uid()) AND can_modify_data(auth.uid()));

CREATE POLICY "Only owners/admins can delete visual references"
ON public.client_visual_references
FOR DELETE
USING (client_workspace_can_delete(client_id, auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_client_visual_references_updated_at
BEFORE UPDATE ON public.client_visual_references
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_client_visual_references_client_id ON public.client_visual_references(client_id);
CREATE INDEX idx_client_visual_references_is_primary ON public.client_visual_references(client_id, is_primary) WHERE is_primary = true;