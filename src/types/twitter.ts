// Twitter/X Analytics Types

export interface TwitterPost {
  id: string;
  client_id: string;
  tweet_id?: string | null;
  content?: string | null;
  posted_at?: string | null;
  impressions?: number | null;
  engagements?: number | null;
  engagement_rate?: number | null;
  retweets?: number | null;
  replies?: number | null;
  likes?: number | null;
  profile_clicks?: number | null;
  url_clicks?: number | null;
  hashtag_clicks?: number | null;
  detail_expands?: number | null;
  media_views?: number | null;
  media_engagements?: number | null;
  full_content?: string | null;
  images?: string[] | null;
  content_synced_at?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface TwitterMetric {
  id: string;
  client_id: string;
  metric_date: string;
  impressions?: number | null;
  engagements?: number | null;
  followers?: number | null;
  following?: number | null;
  tweets_count?: number | null;
  profile_visits?: number | null;
  mentions?: number | null;
  metadata?: Record<string, unknown> | null;
}

export interface TwitterCSVRow {
  tweet_id?: string;
  tweet_permalink?: string;
  tweet_text?: string;
  time?: string;
  date?: string;
  impressions?: string;
  engagements?: string;
  engagement_rate?: string;
  retweets?: string;
  replies?: string;
  likes?: string;
  user_profile_clicks?: string;
  url_clicks?: string;
  hashtag_clicks?: string;
  detail_expands?: string;
  media_views?: string;
  media_engagements?: string;
  [key: string]: string | undefined;
}
