// TypeScript types for Meta Ads (Facebook/Instagram Ads)

export interface MetaAdsCampaign {
  id: string;
  client_id: string;
  campaign_name: string;
  campaign_status?: string | null;
  budget?: number | null;
  budget_type?: string | null;
  attribution_setting?: string | null;
  results?: number | null;
  result_type?: string | null;
  reach?: number | null;
  impressions?: number | null;
  cost_per_result?: number | null;
  amount_spent?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface MetaAdsAdSet {
  id: string;
  client_id: string;
  adset_name: string;
  adset_status?: string | null;
  bid?: number | null;
  bid_type?: string | null;
  budget?: number | null;
  budget_type?: string | null;
  attribution_setting?: string | null;
  results?: number | null;
  result_type?: string | null;
  reach?: number | null;
  impressions?: number | null;
  cost_per_result?: number | null;
  amount_spent?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface MetaAdsAd {
  id: string;
  client_id: string;
  ad_name: string;
  adset_name?: string | null;
  ad_status?: string | null;
  results?: number | null;
  result_type?: string | null;
  reach?: number | null;
  impressions?: number | null;
  cost_per_result?: number | null;
  quality_ranking?: string | null;
  engagement_rate_ranking?: string | null;
  conversion_rate_ranking?: string | null;
  amount_spent?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export type CampaignStatus = 'active' | 'inactive' | 'archived';
export type BudgetType = 'daily' | 'lifetime';
export type ResultType = 'lead' | 'purchase' | 'link_click' | 'reach' | 'impressions' | 'engagement' | 'video_views' | 'messages' | 'app_installs' | 'other';

export interface MetaAdsKPIs {
  totalSpent: number;
  totalResults: number;
  avgCostPerResult: number;
  totalReach: number;
  totalImpressions: number;
  activeCampaigns: number;
  totalCampaigns: number;
  spentChange?: number;
  resultsChange?: number;
}

export interface MetaAdsParsedCSV {
  type: 'campaigns' | 'adsets' | 'ads';
  data: Array<Partial<MetaAdsCampaign | MetaAdsAdSet | MetaAdsAd>>;
  dateRange?: { start: string; end: string };
}
