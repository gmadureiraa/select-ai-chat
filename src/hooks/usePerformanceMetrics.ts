import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PerformanceMetrics {
  id: string;
  client_id: string;
  platform: 'newsletter' | 'instagram' | 'youtube' | 'tiktok';
  metric_date: string;
  subscribers?: number;
  total_posts?: number;
  engagement_rate?: number;
  open_rate?: number;
  click_rate?: number;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export const usePerformanceMetrics = (clientId: string, platform: string, limit: number = 30) => {
  return useQuery({
    queryKey: ['performance-metrics', clientId, platform, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_metrics')
        .select('*')
        .eq('client_id', clientId)
        .eq('platform', platform)
        .order('metric_date', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as PerformanceMetrics[];
    },
    enabled: !!clientId && !!platform,
  });
};

export const useFetchBeehiivMetrics = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (clientId: string) => {
      const { data, error } = await supabase.functions.invoke('fetch-beehiiv-metrics', {
        body: { clientId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performance-metrics'] });
    },
  });
};

export const useScrapeMetrics = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      clientId, 
      platform, 
      url 
    }: { 
      clientId: string; 
      platform: string; 
      url: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('scrape-social-metrics', {
        body: { clientId, platform, url },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performance-metrics'] });
    },
  });
};

export const useFetchInstagramMetrics = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      clientId, 
      username 
    }: { 
      clientId: string; 
      username: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('fetch-instagram-metrics', {
        body: { clientId, username },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performance-metrics'] });
    },
  });
};

export const useFetchNotionMetrics = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      clientId, 
      databaseId 
    }: { 
      clientId: string; 
      databaseId: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('fetch-notion-metrics', {
        body: { clientId, databaseId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performance-metrics'] });
    },
  });
};
