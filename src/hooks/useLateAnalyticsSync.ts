import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SyncResult {
  success: boolean;
  syncedPosts: number;
  syncedMetrics: number;
  platforms: string[];
  errors: string[];
  message?: string;
}

interface SyncOptions {
  clientId: string;
  platform?: string;
  daysBack?: number;
}

export function useLateAnalyticsSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ clientId, platform, daysBack = 30 }: SyncOptions): Promise<SyncResult> => {
      const { data, error } = await supabase.functions.invoke("late-fetch-analytics", {
        body: { clientId, platform, daysBack },
      });

      if (error) throw error;
      return data as SyncResult;
    },
    onSuccess: (data, variables) => {
      // Invalidate relevant queries
      const { clientId, platform } = variables;
      
      queryClient.invalidateQueries({ queryKey: ["performance-metrics", clientId] });
      queryClient.invalidateQueries({ queryKey: ["instagram-posts", clientId] });
      queryClient.invalidateQueries({ queryKey: ["twitter-posts", clientId] });
      queryClient.invalidateQueries({ queryKey: ["linkedin-posts", clientId] });
      queryClient.invalidateQueries({ queryKey: ["client-social-credentials", clientId] });

      if (data.syncedPosts > 0 || data.syncedMetrics > 0) {
        toast.success(`Sincronizado: ${data.syncedPosts} posts, ${data.syncedMetrics} métricas`);
      } else if (data.message) {
        toast.info(data.message);
      } else {
        toast.info("Nenhum dado novo encontrado");
      }
    },
    onError: (error) => {
      console.error("Sync error:", error);
      toast.error("Erro ao sincronizar métricas");
    },
  });
}

// Hook to get last sync time for a platform
export function useLastSyncTime(clientId: string, platform?: string) {
  return useQuery({
    queryKey: ["last-sync-time", clientId, platform],
    queryFn: async () => {
      const query = supabase
        .from("client_social_credentials")
        .select("platform, metadata, updated_at")
        .eq("client_id", clientId)
        .eq("is_valid", true);

      if (platform) {
        query.eq("platform", platform);
      }

      const { data, error } = await query;
      if (error) throw error;

      const syncTimes: Record<string, string | null> = {};
      
      for (const cred of data || []) {
        const meta = cred.metadata as Record<string, unknown> | null;
        syncTimes[cred.platform] = (meta?.last_analytics_sync as string) || null;
      }

      return syncTimes;
    },
    staleTime: 30000,
  });
}

// Metrics that Late API can provide vs those that need manual entry
export const LATE_API_METRICS = {
  instagram: {
    automatic: ['likes', 'comments', 'shares', 'impressions', 'reach', 'engagement_rate'],
    manual: ['saves', 'link_clicks', 'profile_visits', 'website_taps'],
  },
  twitter: {
    automatic: ['likes', 'retweets', 'replies', 'impressions', 'engagement_rate'],
    manual: ['link_clicks', 'profile_visits', 'bookmarks'],
  },
  linkedin: {
    automatic: ['likes', 'comments', 'shares', 'impressions', 'clicks', 'engagement_rate'],
    manual: ['video_views', 'follows'],
  },
};

export function getManualMetricsForPlatform(platform: string): string[] {
  return LATE_API_METRICS[platform as keyof typeof LATE_API_METRICS]?.manual || [];
}

export function getAutomaticMetricsForPlatform(platform: string): string[] {
  return LATE_API_METRICS[platform as keyof typeof LATE_API_METRICS]?.automatic || [];
}
