// Smart Links (Metricool) — list / create / update / delete / analytics.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiInvoke } from '../lib/apiInvoke';

export interface MetricoolSmartLink {
  id?: number;
  slug?: string;
  name?: string;
  appearance?: Record<string, unknown>;
  content?: {
    icons?: any[];
    buttons?: any[];
    images?: any[];
    header?: Record<string, unknown>;
  };
  version?: number;
  free?: boolean;
  createDate?: { dateTime: string; timezone: string };
  shortUrl?: string;
  originalUrl?: string;
  clicks?: number;
  [key: string]: unknown;
}

export interface MetricoolSmartLinkTimelinePoint {
  date?: string;
  value?: number;
  [key: string]: unknown;
}

export interface CreateSmartLinkVars {
  name?: string;
  slug?: string;
  content?: MetricoolSmartLink['content'];
  appearance?: Record<string, unknown>;
  // Sobreposição genérica caso a UI precise mandar payload custom
  body?: Partial<MetricoolSmartLink>;
}

export interface UpdateSmartLinkVars {
  id: number | string;
  patch: Partial<MetricoolSmartLink>;
}

export function useMetricoolSmartLinks(clientId: string) {
  return useQuery({
    queryKey: ['metricool-smart-links', clientId, 'list'],
    queryFn: async (): Promise<MetricoolSmartLink[]> => {
      const { data, error } = await apiInvoke('metricool-smart-links', {
        body: { clientId, mode: 'list' },
      });
      if (error) throw error;
      return ((data as any)?.links || []) as MetricoolSmartLink[];
    },
    enabled: !!clientId,
    staleTime: 1000 * 60 * 2,
  });
}

export function useMetricoolSmartLinkTimeline(
  clientId: string,
  id: number | string | null,
  metric = 'clicks',
  range?: { from?: string; to?: string },
) {
  return useQuery({
    queryKey: ['metricool-smart-links', clientId, 'timeline', String(id ?? ''), metric, range?.from, range?.to],
    queryFn: async (): Promise<MetricoolSmartLinkTimelinePoint[]> => {
      const { data, error } = await apiInvoke('metricool-smart-links', {
        body: { clientId, mode: 'timeline', id, metric, ...(range || {}) },
      });
      if (error) throw error;
      const tl = (data as any)?.timeline;
      if (Array.isArray(tl)) return tl;
      // Algumas séries vêm em { values: [{date, value}] }
      if (Array.isArray(tl?.values)) return tl.values as MetricoolSmartLinkTimelinePoint[];
      return [];
    },
    enabled: !!clientId && id != null,
    staleTime: 1000 * 60 * 5,
  });
}

export function useCreateMetricoolSmartLink(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: CreateSmartLinkVars) => {
      const { data, error } = await apiInvoke('metricool-smart-links', {
        body: { clientId, mode: 'create', ...vars },
      });
      if (error) throw error;
      return (data as any)?.link as MetricoolSmartLink;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['metricool-smart-links', clientId, 'list'] });
    },
  });
}

export function useUpdateMetricoolSmartLink(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: UpdateSmartLinkVars) => {
      const { data, error } = await apiInvoke('metricool-smart-links', {
        body: { clientId, mode: 'update', id: vars.id, body: vars.patch },
      });
      if (error) throw error;
      return (data as any)?.link as MetricoolSmartLink;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['metricool-smart-links', clientId, 'list'] });
    },
  });
}

export function useDeleteMetricoolSmartLink(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number | string) => {
      const { error } = await apiInvoke('metricool-smart-links', {
        body: { clientId, mode: 'delete', id },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['metricool-smart-links', clientId, 'list'] });
    },
  });
}
