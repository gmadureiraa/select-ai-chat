// Lista todas as brands da conta Metricool — usado pra mapear KAI client → Metricool blogId.
import { useQuery } from '@tanstack/react-query';
import { apiInvoke } from '../lib/apiInvoke';

export interface MetricoolBrand {
  id: number;
  label: string;
  url?: string;
  picture?: string;
  timezone?: string;
  ownerId?: number;
  role?: string;
}

export function useMetricoolBrands() {
  return useQuery({
    queryKey: ['metricool-brands'],
    queryFn: async (): Promise<MetricoolBrand[]> => {
      const { data, error } = await apiInvoke('metricool-list-brands', { body: {} });
      if (error) throw error;
      return (data as any)?.brands || [];
    },
    staleTime: 1000 * 60 * 10,
  });
}
