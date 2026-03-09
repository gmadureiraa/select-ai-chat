import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

export interface LateAnalyticsResponse {
  success: boolean;
  lastSyncedAt: string;
  platforms: Record<string, PlatformMetrics>;
  message?: string;
  error?: string;
}

export function useLateAnalytics(clientId: string, period: number = 7) {
  return useQuery({
    queryKey: ["late-analytics", clientId, period],
    queryFn: async (): Promise<LateAnalyticsResponse> => {
      const { data, error } = await supabase.functions.invoke("late-analytics", {
        body: { clientId, period },
      });
      if (error) throw error;
      return data as LateAnalyticsResponse;
    },
    staleTime: 1000 * 60 * 5,
    refetchOnMount: true,
    enabled: !!clientId,
  });
}
