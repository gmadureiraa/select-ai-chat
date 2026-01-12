-- Create content_canvas table for persisting canvas state
CREATE TABLE public.content_canvas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'Canvas sem título',
  nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
  edges JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.content_canvas ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view own canvas" 
ON public.content_canvas 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own canvas" 
ON public.content_canvas 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own canvas" 
ON public.content_canvas 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own canvas" 
ON public.content_canvas 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_content_canvas_client ON public.content_canvas(client_id);
CREATE INDEX idx_content_canvas_user ON public.content_canvas(user_id);
CREATE INDEX idx_content_canvas_workspace ON public.content_canvas(workspace_id);

-- Create trigger for updating updated_at
CREATE TRIGGER update_content_canvas_updated_at
BEFORE UPDATE ON public.content_canvas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();