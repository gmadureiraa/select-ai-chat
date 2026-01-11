-- Create table for Meta Ads Campaigns
CREATE TABLE public.meta_ads_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  campaign_name TEXT NOT NULL,
  campaign_status TEXT,
  budget NUMERIC(12,2),
  budget_type TEXT,
  attribution_setting TEXT,
  results INTEGER,
  result_type TEXT,
  reach INTEGER,
  impressions INTEGER,
  cost_per_result NUMERIC(10,4),
  amount_spent NUMERIC(12,2),
  start_date DATE,
  end_date DATE,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id, campaign_name, start_date, end_date)
);

-- Create table for Meta Ads Ad Sets
CREATE TABLE public.meta_ads_adsets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  adset_name TEXT NOT NULL,
  adset_status TEXT,
  bid NUMERIC(10,2),
  bid_type TEXT,
  budget NUMERIC(12,2),
  budget_type TEXT,
  attribution_setting TEXT,
  results INTEGER,
  result_type TEXT,
  reach INTEGER,
  impressions INTEGER,
  cost_per_result NUMERIC(10,4),
  amount_spent NUMERIC(12,2),
  start_date DATE,
  end_date DATE,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id, adset_name, start_date, end_date)
);

-- Create table for Meta Ads Ads
CREATE TABLE public.meta_ads_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  ad_name TEXT NOT NULL,
  adset_name TEXT,
  ad_status TEXT,
  results INTEGER,
  result_type TEXT,
  reach INTEGER,
  impressions INTEGER,
  cost_per_result NUMERIC(10,4),
  quality_ranking TEXT,
  engagement_rate_ranking TEXT,
  conversion_rate_ranking TEXT,
  amount_spent NUMERIC(12,2),
  start_date DATE,
  end_date DATE,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id, ad_name, start_date, end_date)
);

-- Enable RLS on all tables
ALTER TABLE public.meta_ads_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_ads_adsets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_ads_ads ENABLE ROW LEVEL SECURITY;

-- RLS policies for meta_ads_campaigns
CREATE POLICY "Users can view campaigns for their workspace clients"
ON public.meta_ads_campaigns FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
    WHERE c.id = meta_ads_campaigns.client_id AND wm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert campaigns for their workspace clients"
ON public.meta_ads_campaigns FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.clients c
    JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
    WHERE c.id = meta_ads_campaigns.client_id AND wm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update campaigns for their workspace clients"
ON public.meta_ads_campaigns FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
    WHERE c.id = meta_ads_campaigns.client_id AND wm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete campaigns for their workspace clients"
ON public.meta_ads_campaigns FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
    WHERE c.id = meta_ads_campaigns.client_id AND wm.user_id = auth.uid()
  )
);

-- RLS policies for meta_ads_adsets
CREATE POLICY "Users can view adsets for their workspace clients"
ON public.meta_ads_adsets FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
    WHERE c.id = meta_ads_adsets.client_id AND wm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert adsets for their workspace clients"
ON public.meta_ads_adsets FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.clients c
    JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
    WHERE c.id = meta_ads_adsets.client_id AND wm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update adsets for their workspace clients"
ON public.meta_ads_adsets FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
    WHERE c.id = meta_ads_adsets.client_id AND wm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete adsets for their workspace clients"
ON public.meta_ads_adsets FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
    WHERE c.id = meta_ads_adsets.client_id AND wm.user_id = auth.uid()
  )
);

-- RLS policies for meta_ads_ads
CREATE POLICY "Users can view ads for their workspace clients"
ON public.meta_ads_ads FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
    WHERE c.id = meta_ads_ads.client_id AND wm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert ads for their workspace clients"
ON public.meta_ads_ads FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.clients c
    JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
    WHERE c.id = meta_ads_ads.client_id AND wm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update ads for their workspace clients"
ON public.meta_ads_ads FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
    WHERE c.id = meta_ads_ads.client_id AND wm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete ads for their workspace clients"
ON public.meta_ads_ads FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
    WHERE c.id = meta_ads_ads.client_id AND wm.user_id = auth.uid()
  )
);

-- Create indexes for better performance
CREATE INDEX idx_meta_ads_campaigns_client_id ON public.meta_ads_campaigns(client_id);
CREATE INDEX idx_meta_ads_campaigns_dates ON public.meta_ads_campaigns(start_date, end_date);
CREATE INDEX idx_meta_ads_adsets_client_id ON public.meta_ads_adsets(client_id);
CREATE INDEX idx_meta_ads_adsets_dates ON public.meta_ads_adsets(start_date, end_date);
CREATE INDEX idx_meta_ads_ads_client_id ON public.meta_ads_ads(client_id);
CREATE INDEX idx_meta_ads_ads_dates ON public.meta_ads_ads(start_date, end_date);

-- Create update trigger for updated_at
CREATE TRIGGER update_meta_ads_campaigns_updated_at
BEFORE UPDATE ON public.meta_ads_campaigns
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_meta_ads_adsets_updated_at
BEFORE UPDATE ON public.meta_ads_adsets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_meta_ads_ads_updated_at
BEFORE UPDATE ON public.meta_ads_ads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();