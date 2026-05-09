// usePostizAnalytics — drop-in pro `useLateAnalytics` antigo.
//
// Bate em `/api/postiz-summary` que fan-out chama Postiz `/analytics/{integrationId}`
// pra cada plataforma conectada do cliente, retornando shape compat com
// `LateAnalyticsResponse` pra zero refactor nos consumers.
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

export interface PostizAnalyticsResponse {
  success: boolean;
  lastSyncedAt: string;
  platforms: Record<string, PlatformMetrics>;
  message?: string;
  error?: string;
  errors?: Record<string, string>;
}

export function usePostizAnalytics(clientId: string, period: number = 30) {
  return useQuery({
    queryKey: ['postiz-analytics', clientId, period],
    queryFn: async (): Promise<PostizAnalyticsResponse> => {
      const { data, error } = await apiInvoke('postiz-summary', {
        body: { clientId, period },
      });
      if (error) throw error;
      return data as PostizAnalyticsResponse;
    },
    staleTime: 1000 * 60 * 5,
    refetchOnMount: true,
    enabled: !!clientId,
  });
}
