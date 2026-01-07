-- Create table for saved performance reports
CREATE TABLE public.performance_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  period TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,
  highlights JSONB DEFAULT '[]'::jsonb,
  insights JSONB DEFAULT '[]'::jsonb,
  recommendations JSONB DEFAULT '[]'::jsonb,
  content_recommendations JSONB DEFAULT '[]'::jsonb,
  top_content JSONB DEFAULT '[]'::jsonb,
  kpis JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.performance_reports ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view reports for clients they have access to"
ON public.performance_reports
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = performance_reports.client_id
  )
);

CREATE POLICY "Users can create reports"
ON public.performance_reports
FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete their own reports"
ON public.performance_reports
FOR DELETE
USING (auth.uid() = created_by);

-- Create index for faster lookups
CREATE INDEX idx_performance_reports_client ON public.performance_reports(client_id);
CREATE INDEX idx_performance_reports_created ON public.performance_reports(created_at DESC);

-- Add trigger for updated_at
CREATE TRIGGER update_performance_reports_updated_at
BEFORE UPDATE ON public.performance_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();