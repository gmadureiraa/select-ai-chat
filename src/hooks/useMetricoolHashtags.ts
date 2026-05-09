// Hashtags Tracker (Metricool) — list / create / distribution.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiInvoke } from '../lib/apiInvoke';

export interface MetricoolHashtagSession {
  id: string | number;
  hashtag: string;
  network: string;
  startDate: string;
  endDate?: string;
  active: boolean;
  [key: string]: unknown;
}

export interface CreateHashtagVars {
  hashtag: string;
  network: string;
  durationDays?: number;
}

export function useMetricoolHashtagSessions(clientId: string) {
  return useQuery({
    queryKey: ['metricool-hashtags', clientId, 'list'],
    queryFn: async (): Promise<MetricoolHashtagSession[]> => {
      const { data, error } = await apiInvoke('metricool-hashtags', {
        body: { clientId, mode: 'list' },
      });
      if (error) throw error;
      return ((data as any)?.sessions || []) as MetricoolHashtagSession[];
    },
    enabled: !!clientId,
    staleTime: 1000 * 60 * 2,
  });
}

export function useMetricoolHashtagDistribution(
  clientId: string,
  sessionId: string | number | null,
) {
  return useQuery({
    queryKey: ['metricool-hashtags', clientId, 'distribution', String(sessionId ?? '')],
    queryFn: async () => {
      const { data, error } = await apiInvoke('metricool-hashtags', {
        body: { clientId, mode: 'distribution', sessionId },
      });
      if (error) throw error;
      return (data as any)?.distribution ?? null;
    },
    enabled: !!clientId && sessionId != null,
    staleTime: 1000 * 60 * 5,
  });
}

export function useCreateMetricoolHashtag(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: CreateHashtagVars) => {
      const { data, error } = await apiInvoke('metricool-hashtags', {
        body: { clientId, mode: 'create', ...vars },
      });
      if (error) throw error;
      return (data as any)?.session;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['metricool-hashtags', clientId, 'list'] });
    },
  });
}
