import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type AiWorkflowRunStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'failed'
  | 'failed_validation'
  | 'partial';

export interface AiWorkflowRun {
  id: string;
  workflow_id: string;
  status: AiWorkflowRunStatus | string;
  /** Output: lista de planning_item ids criados (ex: [{ id, content_type, status }]) ou strings. */
  output: unknown[];
  /** Violações do validator (frames proibidos, etc) e tentativas de repair. */
  violations: Array<{
    rule?: string;
    matched?: string;
    message?: string;
    [key: string]: unknown;
  }>;
  attempts: number;
  error: string | null;
  duration_ms: number | null;
  cost_usd: number | null;
  started_at: string;
  finished_at: string | null;
  created_at: string;
}

/**
 * Lista runs de um workflow específico (mais recentes primeiro).
 * Limit default 20 — suficiente pra ver últimas execuções num modal.
 */
export function useAiWorkflowRuns(workflowId: string | null, limit = 20) {
  return useQuery({
    queryKey: ['ai-workflow-runs', workflowId, limit],
    queryFn: async () => {
      if (!workflowId) return [];

      const { data, error } = await (supabase as any)
        .from('ai_workflow_runs')
        .select('*')
        .eq('workflow_id', workflowId)
        .order('started_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.warn('[useAiWorkflowRuns] error:', error.message);
        return [];
      }

      return (data || []) as unknown as AiWorkflowRun[];
    },
    enabled: !!workflowId,
  });
}

/**
 * Última run de cada workflow (latest-per-workflow).
 * Usado pro card visual de status — verde/amarelo/cinza.
 */
export function useLatestRunsByWorkflow(workflowIds: string[]) {
  return useQuery({
    queryKey: ['ai-workflow-runs-latest', workflowIds.sort().join(',')],
    queryFn: async () => {
      if (workflowIds.length === 0) return {};

      // Pega últimas N runs por workflow_id e filtra a mais recente em memória.
      // (Postgres distinct on é melhor mas Supabase JS não expõe; o volume aqui é baixo.)
      const { data, error } = await (supabase as any)
        .from('ai_workflow_runs')
        .select('*')
        .in('workflow_id', workflowIds)
        .order('started_at', { ascending: false })
        .limit(workflowIds.length * 5); // generous buffer

      if (error) {
        console.warn('[useLatestRunsByWorkflow] error:', error.message);
        return {};
      }

      const byWorkflow: Record<string, AiWorkflowRun> = {};
      for (const run of (data || []) as unknown as AiWorkflowRun[]) {
        if (!byWorkflow[run.workflow_id]) {
          byWorkflow[run.workflow_id] = run;
        }
      }

      return byWorkflow;
    },
    enabled: workflowIds.length > 0,
  });
}
