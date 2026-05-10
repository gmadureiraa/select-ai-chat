// useMetricoolAnalytics — bate em /api/metricool-summary.
import { useQuery } from '@tanstack/react-query';
import { apiInvoke } from '../lib/apiInvoke';

export interface PlatformMetrics {
  followerStats: {
    current: number;
    change7d: number;
    change30d: number;
    history: Array<{ date: string; followers: number }>;
  };
  recentPosts: Array<{
    id: string;
    content: string;
    publishedAt: string;
    url: string;
    metrics: {
      impressions: number;
      reach: number;
      likes: number;
      comments: number;
      shares: number;
      engagementRate: number;
    };
  }>;
  aggregates: {
    avgEngagementRate: number;
    totalImpressions: number;
    totalLikes: number;
    totalComments: number;
    totalShares: number;
    totalReach: number;
    postsCount: number;
  };
}

export interface MetricoolAnalyticsResponse {
  success: boolean;
  lastSyncedAt: string;
  platforms: Record<string, PlatformMetrics>;
  message?: string;
  error?: string;
  errors?: Record<string, string>;
}

export function useMetricoolAnalytics(clientId: string, period: number = 30) {
  return useQuery({
    queryKey: ['metricool-analytics', clientId, period],
    queryFn: async (): Promise<MetricoolAnalyticsResponse> => {
      const { data, error } = await apiInvoke('metricool-summary', { body: { clientId, period } });
      if (error) throw error;
      return data as MetricoolAnalyticsResponse;
    },
    staleTime: 1000 * 60 * 5,
    refetchOnMount: true,
    enabled: !!clientId,
  });
}
