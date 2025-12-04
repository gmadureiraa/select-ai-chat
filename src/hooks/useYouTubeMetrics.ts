import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface YouTubeVideo {
  id: string;
  client_id: string;
  video_id: string;
  title: string;
  published_at: string | null;
  duration_seconds: number | null;
  total_views: number;
  watch_hours: number;
  subscribers_gained: number;
  impressions: number;
  click_rate: number;
  thumbnail_url: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export const useYouTubeVideos = (clientId: string, limit: number = 100) => {
  return useQuery({
    queryKey: ['youtube-videos', clientId, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('youtube_videos')
        .select('*')
        .eq('client_id', clientId)
        .order('total_views', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as YouTubeVideo[];
    },
    enabled: !!clientId,
  });
};

export const useYouTubeVideosByDate = (clientId: string, startDate?: string, limit: number = 100) => {
  return useQuery({
    queryKey: ['youtube-videos-by-date', clientId, startDate, limit],
    queryFn: async () => {
      let query = supabase
        .from('youtube_videos')
        .select('*')
        .eq('client_id', clientId)
        .order('published_at', { ascending: false })
        .limit(limit);

      if (startDate) {
        query = query.gte('published_at', startDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as YouTubeVideo[];
    },
    enabled: !!clientId,
  });
};

export const useFetchYouTubeMetrics = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      clientId, 
      channelId 
    }: { 
      clientId: string; 
      channelId: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('fetch-youtube-metrics', {
        body: { clientId, channelId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['youtube-videos'] });
      queryClient.invalidateQueries({ queryKey: ['performance-metrics'] });
    },
  });
};

export const useImportYouTubeCSV = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      clientId, 
      videos,
      dailyViews
    }: { 
      clientId: string; 
      videos: Array<{
        video_id: string;
        title: string;
        published_at: string | null;
        duration_seconds: number;
        total_views: number;
        watch_hours: number;
        subscribers_gained: number;
        impressions: number;
        click_rate: number;
      }>;
      dailyViews: Array<{
        date: string;
        views: number;
      }>;
    }) => {
      // Upsert videos
      if (videos.length > 0) {
        const { error: videosError } = await supabase
          .from('youtube_videos')
          .upsert(
            videos.map(v => ({
              client_id: clientId,
              ...v
            })),
            { onConflict: 'client_id,video_id' }
          );
        if (videosError) throw videosError;
      }

      // Insert daily views into platform_metrics
      if (dailyViews.length > 0) {
        for (const day of dailyViews) {
          const { error: metricsError } = await supabase
            .from('platform_metrics')
            .upsert({
              client_id: clientId,
              platform: 'youtube',
              metric_date: day.date,
              views: day.views,
            }, { 
              onConflict: 'client_id,platform,metric_date'
            });
          if (metricsError) console.error('Error inserting metric:', metricsError);
        }
      }

      return { videosImported: videos.length, daysImported: dailyViews.length };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['youtube-videos'] });
      queryClient.invalidateQueries({ queryKey: ['performance-metrics'] });
    },
  });
};
