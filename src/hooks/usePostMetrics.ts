// usePostMetrics — leitura + refresh manual de métricas de UM planning_item publicado.
//
// Read path: lê direto de `item.metadata.metrics` quando disponível (sem ida ao DB).
// Mutation path: força chamada `metricool-fetch-post-metrics` pra atualizar agora.
//
// Mantém invalidação coerente das queries de planning_items.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiInvoke } from '@/lib/apiInvoke';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { PlanningItem } from '@/hooks/usePlanningItems';

export interface PlanningPostMetrics {
  likes: number;
  comments: number;
  shares: number;
  reach: number;
  impressions: number;
  video_views: number;
  saves: number;
  eng_rate: number;
  last_synced_at: string;
}

export interface FetchPostMetricsResult {
  ok: boolean;
  source: 'metricool' | 'cache' | 'unsupported';
  metrics?: PlanningPostMetrics;
  planningItemId?: string;
  postId?: string;
  message?: string;
  error?: string;
}

/**
 * Lê metrics persistidas no metadata do item. Não bate em rede — só decompõe.
 * Use junto de `useFetchPostMetrics()` quando precisar forçar refresh.
 */
export function getPlanningItemMetrics(item: PlanningItem | null | undefined): PlanningPostMetrics | null {
  if (!item) return null;
  const meta = (item.metadata as Record<string, unknown>) || {};
  const metrics = meta.metrics as PlanningPostMetrics | undefined;
  if (!metrics || typeof metrics !== 'object') return null;
  if (typeof metrics.likes !== 'number') return null;
  return metrics;
}

interface UsePostMetricsOptions {
  /** Se true, busca de novo a cada 5min (default false) */
  autoRefetch?: boolean;
  /** Se true, faz query inicial via API (em vez de só ler metadata) */
  fetchOnMount?: boolean;
}

/**
 * Read-mostly hook — retorna metrics atual + helper pra refrescar.
 * Não dispara fetch a menos que `fetchOnMount=true`.
 */
export function usePostMetrics(planningItemId: string | null | undefined, options: UsePostMetricsOptions = {}) {
  const { autoRefetch = false, fetchOnMount = false } = options;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['planning-item-metrics', planningItemId],
    queryFn: async (): Promise<PlanningPostMetrics | null> => {
      if (!planningItemId) return null;
      // Lê direto do DB pra não depender da árvore de planning_items
      const { data, error } = await supabase
        .from('planning_items')
        .select('metadata')
        .eq('id', planningItemId)
        .single();
      if (error) throw error;
      const meta = (data?.metadata as Record<string, unknown>) || {};
      const m = meta.metrics as PlanningPostMetrics | undefined;
      return m && typeof m === 'object' && typeof m.likes === 'number' ? m : null;
    },
    enabled: !!planningItemId && fetchOnMount,
    staleTime: 1000 * 60 * 5,
    refetchInterval: autoRefetch ? 1000 * 60 * 5 : false,
  });

  return {
    metrics: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    invalidate: () => {
      queryClient.invalidateQueries({ queryKey: ['planning-item-metrics', planningItemId] });
    },
  };
}

/**
 * Mutation — força fetch das métricas via Metricool API agora.
 * Atualiza planning_items.metadata.metrics e invalida queries relevantes.
 */
export function useFetchPostMetrics() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      planningItemId?: string;
      postId?: string;
      clientId?: string;
      platform?: string;
      force?: boolean;
    }): Promise<FetchPostMetricsResult> => {
      // 2026-05-18 rev2 — metricool-fetch-post-metrics removido. fetch-late-metrics
      // é o equivalente Late/Zernio (recupera métricas por late_post_id).
      const { data, error } = await apiInvoke<FetchPostMetricsResult>(
        'fetch-late-metrics',
        { body: input },
      );
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'Falha ao buscar métricas');
      return data;
    },
    onSuccess: (data, vars) => {
      if (vars.planningItemId) {
        queryClient.invalidateQueries({ queryKey: ['planning-item-metrics', vars.planningItemId] });
      }
      // Invalida planning lists
      queryClient.invalidateQueries({ queryKey: ['planning-items'] });
      if (data.source === 'metricool') {
        toast.success('Métricas atualizadas', { duration: 2000 });
      } else if (data.source === 'cache') {
        toast.info('Métricas já estão atualizadas (cache 12h)', { duration: 2000 });
      }
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Erro ao atualizar métricas');
    },
  });
}
