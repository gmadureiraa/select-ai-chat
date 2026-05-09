// useMetricoolAnalytics — drop-in compatível com usePostizAnalytics / useLateAnalytics.
// Bate em /api/metricool-summary.
import { useQuery } from '@tanstack/react-query';
import { apiInvoke } from '../lib/apiInvoke';
import type { PlatformMetrics, PostizAnalyticsResponse } from './usePostizAnalytics';

export type MetricoolAnalyticsResponse = PostizAnalyticsResponse;
export type { PlatformMetrics } from './usePostizAnalytics';

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
