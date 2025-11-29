-- Create platform_metrics table to store all platform metrics
CREATE TABLE IF NOT EXISTS public.platform_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  platform TEXT NOT NULL, -- 'newsletter', 'instagram', 'youtube', 'tiktok'
  metric_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Common metrics
  subscribers INTEGER,
  total_posts INTEGER,
  engagement_rate DECIMAL(5,2),
  
  -- Newsletter specific (Beehiiv)
  open_rate DECIMAL(5,2),
  click_rate DECIMAL(5,2),
  
  -- Social media specific
  views INTEGER,
  likes INTEGER,
  comments INTEGER,
  shares INTEGER,
  
  -- Additional data as JSON
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(client_id, platform, metric_date)
);

-- Enable RLS
ALTER TABLE public.platform_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view platform metrics"
  ON public.platform_metrics FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert platform metrics"
  ON public.platform_metrics FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update platform metrics"
  ON public.platform_metrics FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete platform metrics"
  ON public.platform_metrics FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Create indexes for performance
CREATE INDEX idx_platform_metrics_client_platform ON public.platform_metrics(client_id, platform);
CREATE INDEX idx_platform_metrics_date ON public.platform_metrics(metric_date DESC);

-- Trigger for updated_at
CREATE TRIGGER update_platform_metrics_updated_at
  BEFORE UPDATE ON public.platform_metrics
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();