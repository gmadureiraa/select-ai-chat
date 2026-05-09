// Competitors Analysis (Metricool) — list / add / posts.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiInvoke } from '../lib/apiInvoke';

export interface MetricoolCompetitor {
  id: string | number;
  name: string;
  network: string;
  username?: string;
  followers?: number;
  growth?: number;
  picture?: string;
  avatar?: string;
  [key: string]: unknown;
}

export interface MetricoolCompetitorPost {
  id?: string | number;
  caption?: string;
  text?: string;
  message?: string;
  thumbnail?: string;
  picture?: string;
  imageUrl?: string;
  mediaUrl?: string;
  url?: string;
  link?: string;
  likes?: number;
  comments?: number;
  views?: number;
  date?: string;
  publishedAt?: string;
  [key: string]: unknown;
}

export function useMetricoolCompetitors(clientId: string, network: string) {
  return useQuery({
    queryKey: ['metricool-competitors', clientId, network, 'list'],
    queryFn: async (): Promise<MetricoolCompetitor[]> => {
      const { data, error } = await apiInvoke('metricool-competitors', {
        body: { clientId, mode: 'list', network },
      });
      if (error) throw error;
      return ((data as any)?.competitors || []) as MetricoolCompetitor[];
    },
    enabled: !!clientId && !!network,
    staleTime: 1000 * 60 * 5,
  });
}

export function useMetricoolCompetitorPosts(
  clientId: string,
  network: string,
  competitorId: string | number | null,
) {
  return useQuery({
    queryKey: ['metricool-competitors', clientId, network, 'posts', String(competitorId ?? '')],
    queryFn: async (): Promise<MetricoolCompetitorPost[]> => {
      const now = new Date();
      const from = new Date(now.getTime() - 30 * 86400_000).toISOString().slice(0, 19);
      const to = now.toISOString().slice(0, 19);
      const { data, error } = await apiInvoke('metricool-competitors', {
        body: { clientId, mode: 'posts', network, competitorId, from, to },
      });
      if (error) throw error;
      return ((data as any)?.posts || []) as MetricoolCompetitorPost[];
    },
    enabled: !!clientId && !!network && competitorId != null,
    staleTime: 1000 * 60 * 5,
  });
}

export function useAddMetricoolCompetitor(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { network: string; username: string; name?: string }) => {
      const { data, error } = await apiInvoke('metricool-competitors', {
        body: { clientId, mode: 'add', ...vars },
      });
      if (error) throw error;
      return (data as any)?.competitor;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: ['metricool-competitors', clientId, vars.network, 'list'],
      });
    },
  });
}
