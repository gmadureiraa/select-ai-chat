import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ChannelDataStatus {
  channel: string;
  hasData: boolean;
  daysOfData: number;
  lastUpdate: string | null;
}

export const useChannelDataStatus = (clientId: string) => {
  return useQuery({
    queryKey: ['channel-data-status', clientId],
    queryFn: async () => {
      const platforms = ['instagram', 'twitter', 'youtube', 'newsletter', 'cortes'];
      
      const statusPromises = platforms.map(async (platform) => {
        const { data, error, count } = await supabase
          .from('platform_metrics')
          .select('metric_date', { count: 'exact' })
          .eq('client_id', clientId)
          .eq('platform', platform)
          .order('metric_date', { ascending: false })
          .limit(1);

        if (error) {
          console.error(`Error fetching status for ${platform}:`, error);
          return {
            channel: platform,
            hasData: false,
            daysOfData: 0,
            lastUpdate: null,
          };
        }

        return {
          channel: platform,
          hasData: (count || 0) > 0,
          daysOfData: count || 0,
          lastUpdate: data?.[0]?.metric_date || null,
        };
      });

      const statuses = await Promise.all(statusPromises);
      
      // Also check youtube_videos table for YouTube
      const { count: videoCount } = await supabase
        .from('youtube_videos')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId);

      // Update YouTube status with video data
      const youtubeIndex = statuses.findIndex(s => s.channel === 'youtube');
      if (youtubeIndex >= 0 && videoCount && videoCount > 0) {
        statuses[youtubeIndex].hasData = true;
      }

      return statuses.reduce((acc, status) => {
        acc[status.channel] = status;
        return acc;
      }, {} as Record<string, ChannelDataStatus>);
    },
    enabled: !!clientId,
  });
};

export const useClientDataSummary = () => {
  return useQuery({
    queryKey: ['clients-data-summary'],
    queryFn: async () => {
      // Get all clients
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('id, name')
        .order('name');

      if (clientsError) throw clientsError;

      // Get metrics count per client
      const { data: metricsData, error: metricsError } = await supabase
        .from('platform_metrics')
        .select('client_id, platform, metric_date')
        .order('metric_date', { ascending: false });

      if (metricsError) throw metricsError;

      // Process data
      const summaries = clients?.map(client => {
        const clientMetrics = metricsData?.filter(m => m.client_id === client.id) || [];
        
        const platforms = new Set(clientMetrics.map(m => m.platform));
        const lastUpdate = clientMetrics[0]?.metric_date || null;
        
        return {
          clientId: client.id,
          clientName: client.name,
          platformsWithData: Array.from(platforms),
          totalDays: clientMetrics.length,
          lastUpdate,
        };
      }) || [];

      return summaries;
    },
  });
};
