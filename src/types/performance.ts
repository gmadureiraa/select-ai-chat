// Centralized TypeScript types for performance metrics

export interface PlatformMetric {
  id: string;
  client_id: string;
  platform: Platform;
  metric_date: string;
  views?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  subscribers?: number | null;
  engagement_rate?: number | null;
  open_rate?: number | null;
  click_rate?: number | null;
  total_posts?: number | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export type Platform = 
  | 'instagram' 
  | 'youtube' 
  | 'twitter' 
  | 'newsletter' 
  | 'tiktok' 
  | 'linkedin'
  | 'meta_ads';

export interface PerformanceGoal {
  id: string;
  client_id: string;
  platform: Platform;
  metric_name: MetricName;
  target_value: number;
  current_value?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  period?: GoalPeriod | null;
  status?: GoalStatus | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export type MetricName = 
  | 'followers' 
  | 'views' 
  | 'engagement_rate' 
  | 'reach' 
  | 'subscribers'
  | 'likes'
  | 'comments'
  | 'shares'
  | 'open_rate'
  | 'click_rate';

export type GoalPeriod = 'weekly' | 'monthly' | 'quarterly' | 'yearly';
export type GoalStatus = 'active' | 'completed' | 'failed' | 'paused';

export interface InstagramPost {
  id: string;
  client_id: string;
  post_id?: string | null;
  caption?: string | null;
  post_type?: PostType | null;
  permalink?: string | null;
  thumbnail_url?: string | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  saves?: number | null;
  reach?: number | null;
  impressions?: number | null;
  engagement_rate?: number | null;
  posted_at?: string | null;
  analyzed_at?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export type PostType = 'image' | 'video' | 'carousel' | 'reel' | 'story';

export interface YouTubeVideo {
  id: string;
  client_id: string;
  video_id: string;
  title: string;
  thumbnail_url?: string | null;
  published_at?: string | null;
  total_views?: number | null;
  watch_hours?: number | null;
  subscribers_gained?: number | null;
  impressions?: number | null;
  click_rate?: number | null;
  duration_seconds?: number | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface StatCardData {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  sparklineData?: number[];
  color?: 'primary' | 'green' | 'blue' | 'orange' | 'purple' | 'pink';
  highlight?: boolean;
}

export interface ChartDataPoint {
  date: string;
  value: number;
  label?: string;
}

export interface MetricTrend {
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
}

export interface PerformanceInsight {
  id: string;
  type: 'success' | 'warning' | 'info' | 'tip';
  title: string;
  description: string;
  metric?: string;
  value?: number;
  recommendation?: string;
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface PerformanceFilters {
  dateRange: DateRange;
  platform?: Platform;
  metricType?: MetricName;
}
