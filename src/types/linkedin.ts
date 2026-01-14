// LinkedIn Analytics Types

export interface LinkedInPost {
  id: string;
  client_id: string;
  post_id: string;
  post_url?: string | null;
  content?: string | null;
  posted_at?: string | null;
  impressions?: number | null;
  engagements?: number | null;
  engagement_rate?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  clicks?: number | null;
  follows?: number | null;
  full_content?: string | null;
  images?: string[] | null;
  content_synced_at?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface LinkedInDailyMetric {
  date: string;
  impressions: number;
  engagements: number;
  followers?: number;
}

export interface LinkedInExcelData {
  posts: Array<{
    post_id: string;
    post_url: string;
    posted_at: string | null;
    impressions: number;
    engagements: number;
    engagement_rate: number;
  }>;
  dailyMetrics: LinkedInDailyMetric[];
  followers: {
    total: number;
    daily: Array<{ date: string; new_followers: number }>;
  };
}
