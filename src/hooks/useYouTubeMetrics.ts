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
  transcript: string | null;
  content_synced_at: string | null;
  content_library_id: string | null;
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
        total_posts?: number;
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

      // Insert daily metrics into platform_metrics
      if (dailyViews.length > 0) {
        for (const day of dailyViews) {
          // Build update object dynamically based on what data we have
          const updateData: {
            client_id: string;
            platform: 'youtube';
            metric_date: string;
            views?: number;
            total_posts?: number;
          } = {
            client_id: clientId,
            platform: 'youtube',
            metric_date: day.date,
          };
          
          // Only set views if > 0 (to not overwrite existing data)
          if (day.views > 0) {
            updateData.views = day.views;
          }
          
          // Only set total_posts if > 0
          if (day.total_posts && day.total_posts > 0) {
            updateData.total_posts = day.total_posts;
          }
          
          const { error: metricsError } = await supabase
            .from('platform_metrics')
            .upsert(updateData, { 
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
