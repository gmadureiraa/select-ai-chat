// Linkin Bio (Metricool) — gestão da página linkin bio do IG.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiInvoke } from '../lib/apiInvoke';

export interface MetricoolBioCatalogItem {
  id: number;
  blogId?: number;
  postId?: string;
  timestamp?: number;
  url?: string;
  imageUrl?: string;
  linkId?: number;
  shortUrl?: string;
  type?: string;
  [key: string]: unknown;
}

export interface MetricoolBioButton {
  id: number;
  blogId?: number;
  link?: string;
  text?: string;
  position?: number;
  color?: string;
  linkId?: number;
  shortUrl?: string;
  [key: string]: unknown;
}

export interface MetricoolLinkinBio {
  catalog: MetricoolBioCatalogItem[];
  buttons: MetricoolBioButton[];
}

const KEY = (clientId: string) => ['metricool-linkin-bio', clientId];

export function useMetricoolLinkinBio(clientId: string) {
  return useQuery({
    queryKey: KEY(clientId),
    queryFn: async (): Promise<MetricoolLinkinBio> => {
      const { data, error } = await apiInvoke('metricool-linkin-bio', {
        body: { clientId, mode: 'get' },
      });
      if (error) throw error;
      return {
        catalog: ((data as any)?.catalog || []) as MetricoolBioCatalogItem[],
        buttons: ((data as any)?.buttons || []) as MetricoolBioButton[],
      };
    },
    enabled: !!clientId,
    staleTime: 1000 * 60 * 2,
  });
}

export function useAddMetricoolBioButton(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { textButton: string; link: string }) => {
      const { data, error } = await apiInvoke('metricool-linkin-bio', {
        body: { clientId, mode: 'add-button', ...vars },
      });
      if (error) throw error;
      return ((data as any)?.buttons || []) as MetricoolBioButton[];
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY(clientId) });
    },
  });
}

export function useEditMetricoolBioButton(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { itemid: number | string; link?: string; text?: string }) => {
      const { data, error } = await apiInvoke('metricool-linkin-bio', {
        body: { clientId, mode: 'edit-button', ...vars },
      });
      if (error) throw error;
      return ((data as any)?.buttons || []) as MetricoolBioButton[];
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY(clientId) });
    },
  });
}

export function useReorderMetricoolBioButton(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { itemid: number | string }) => {
      const { data, error } = await apiInvoke('metricool-linkin-bio', {
        body: { clientId, mode: 'reorder', ...vars },
      });
      if (error) throw error;
      return ((data as any)?.buttons || []) as MetricoolBioButton[];
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY(clientId) });
    },
  });
}

export function useDeleteMetricoolBioButton(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { itemid: number | string }) => {
      const { data, error } = await apiInvoke('metricool-linkin-bio', {
        body: { clientId, mode: 'delete-button', ...vars },
      });
      if (error) throw error;
      return ((data as any)?.buttons || []) as MetricoolBioButton[];
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY(clientId) });
    },
  });
}

export function useEditMetricoolBioCatalog(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { itemid: number | string; link: string }) => {
      const { data, error } = await apiInvoke('metricool-linkin-bio', {
        body: { clientId, mode: 'edit-catalog', ...vars },
      });
      if (error) throw error;
      return ((data as any)?.catalog || []) as MetricoolBioCatalogItem[];
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY(clientId) });
    },
  });
}

export function useDeleteMetricoolBioCatalog(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { itemid: number | string }) => {
      const { data, error } = await apiInvoke('metricool-linkin-bio', {
        body: { clientId, mode: 'delete-catalog', ...vars },
      });
      if (error) throw error;
      return ((data as any)?.catalog || []) as MetricoolBioCatalogItem[];
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY(clientId) });
    },
  });
}
