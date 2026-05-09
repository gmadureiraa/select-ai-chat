import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { apiInvoke } from '@/lib/apiInvoke';
import { toast } from 'sonner';

export interface AiWorkflowConfig {
  client_id?: string;
  format?: string;
  platform?: string;
  content_type?: string;
  pilar_dia?: string;
  capa_format?: string;
  slides_min?: number;
  slides_max?: number;
  duration_seconds?: number;
  duration_min?: number;
  duration_max?: number;
  tweets_min?: number;
  tweets_max?: number;
  batch_size?: number;
  max_chars?: number;
  caption_max_chars?: number;
  first_line_max_chars?: number;
  hashtag_allowed?: boolean;
  hashtags_min?: number;
  hashtags_max?: number;
  language?: string;
  due_date_offset_days?: number;
  status_after_generation?: 'idea' | 'draft' | 'approved';
  rotation_by_weekday?: Record<string, string>;
  trigger?: string;
  sources?: string[];
  posts_per_day?: number;
  distribute_over?: string;
  tipo?: string;
  [key: string]: unknown;
}

export interface AiWorkflow {
  id: string;
  workspace_id: string;
  agent_id: string;
  name: string;
  description: string | null;
  schedule_cron: string;
  config: AiWorkflowConfig;
  is_active: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiAgent {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  skill_id: string | null;
  knowledge_base: Record<string, unknown>;
  sub_agents: Record<string, unknown>;
  model: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const WEEKDAY_LABELS: Record<number, string> = {
  0: 'Dom',
  1: 'Seg',
  2: 'Ter',
  3: 'Qua',
  4: 'Qui',
  5: 'Sex',
  6: 'Sáb',
};

/**
 * Converte cron expression em descrição human-readable em PT-BR.
 * Suporta sintaxe básica: min hour dom month dow (com vírgulas e ranges).
 *
 * Ex: '0 9 * * 1' → 'Segunda às 09:00 UTC'
 *     '0 12 * * 1-5' → 'Seg-Sex às 12:00 UTC'
 *     '0 12 1 * *' → 'Dia 1 do mês às 12:00 UTC'
 *     '0 13 * * *' → 'Diário às 13:00 UTC'
 */
export function describeCron(cron: string): string {
  try {
    const parts = cron.trim().split(/\s+/);
    if (parts.length < 5) return cron;
    const [min, hour, dom, , dow] = parts;

    const time = `${hour.padStart(2, '0')}:${min.padStart(2, '0')} UTC`;

    if (dom !== '*' && dow === '*') {
      return `Dia ${dom} do mês às ${time}`;
    }

    if (dow === '*') {
      return `Diário às ${time}`;
    }

    // Parse dow expression
    const days: number[] = [];
    for (const segment of dow.split(',')) {
      if (segment.includes('-')) {
        const [a, b] = segment.split('-').map(Number);
        for (let i = a; i <= b; i++) days.push(i);
      } else {
        days.push(Number(segment));
      }
    }

    // Detecta range contínuo (ex: 1-5)
    const isContinuousRange =
      days.length > 2 &&
      days.every((d, i) => i === 0 || d === days[i - 1] + 1);

    if (isContinuousRange) {
      return `${WEEKDAY_LABELS[days[0]]}-${WEEKDAY_LABELS[days[days.length - 1]]} às ${time}`;
    }

    const labels = days.map((d) => WEEKDAY_LABELS[d] ?? `?${d}`).join(', ');
    return `${labels} às ${time}`;
  } catch {
    return cron;
  }
}

/**
 * Estima próxima execução baseado no cron + last_run_at.
 * Implementação simples — assume próximo dia da semana válido.
 * Para cálculo preciso, deixa undefined (UI mostra '—').
 */
export function estimateNextRun(cron: string, _now: Date = new Date()): Date | null {
  try {
    const parts = cron.trim().split(/\s+/);
    if (parts.length < 5) return null;
    const [min, hour, dom, , dow] = parts;

    const targetHour = parseInt(hour, 10);
    const targetMin = parseInt(min, 10);
    if (isNaN(targetHour) || isNaN(targetMin)) return null;

    const now = new Date();
    const candidate = new Date(now);
    candidate.setUTCHours(targetHour, targetMin, 0, 0);

    // Daily
    if (dow === '*' && dom === '*') {
      if (candidate <= now) candidate.setUTCDate(candidate.getUTCDate() + 1);
      return candidate;
    }

    // Day-of-month
    if (dom !== '*' && dow === '*') {
      const targetDom = parseInt(dom.split(',')[0], 10);
      if (isNaN(targetDom)) return null;
      candidate.setUTCDate(targetDom);
      if (candidate <= now) candidate.setUTCMonth(candidate.getUTCMonth() + 1);
      return candidate;
    }

    // Day-of-week — find next valid
    if (dow !== '*') {
      const validDays: number[] = [];
      for (const segment of dow.split(',')) {
        if (segment.includes('-')) {
          const [a, b] = segment.split('-').map(Number);
          for (let i = a; i <= b; i++) validDays.push(i);
        } else {
          validDays.push(Number(segment));
        }
      }
      // Search up to 7 days ahead
      for (let i = 0; i < 8; i++) {
        const test = new Date(now);
        test.setUTCDate(now.getUTCDate() + i);
        test.setUTCHours(targetHour, targetMin, 0, 0);
        if (test > now && validDays.includes(test.getUTCDay())) {
          return test;
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

export function useAiWorkflows() {
  const { workspace } = useWorkspace();
  const workspaceId = workspace?.id;
  const queryClient = useQueryClient();

  const { data: workflows, isLoading, refetch } = useQuery({
    queryKey: ['ai-workflows', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];

      const { data, error } = await (supabase as any)
        .from('ai_workflows')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('schedule_cron', { ascending: true });

      if (error) {
        // ai_workflows pode nao existir em workspaces que não rodaram migration 0016
        console.warn('[useAiWorkflows] error:', error.message);
        return [];
      }

      return (data || []) as unknown as AiWorkflow[];
    },
    enabled: !!workspaceId,
  });

  const { data: agents } = useQuery({
    queryKey: ['ai-agents', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data, error } = await (supabase as any)
        .from('ai_agents')
        .select('*')
        .eq('workspace_id', workspaceId);

      if (error) {
        console.warn('[useAiWorkflows agents] error:', error.message);
        return [];
      }
      return (data || []) as unknown as AiAgent[];
    },
    enabled: !!workspaceId,
  });

  const toggleWorkflow = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { data, error } = await (supabase as any)
        .from('ai_workflows')
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['ai-workflows', workspaceId] });
      toast.success(data?.is_active ? 'Workflow ativado' : 'Workflow pausado');
    },
    onError: (error: Error) => {
      console.error('Error toggling workflow:', error);
      toast.error('Erro ao alterar status do workflow');
    },
  });

  // Update workflow (admin / super_admin) — name, description, schedule_cron, config, is_active
  const updateWorkflow = useMutation({
    mutationFn: async (payload: {
      id: string;
      name?: string;
      description?: string | null;
      schedule_cron?: string;
      is_active?: boolean;
      config?: Record<string, unknown>;
    }) => {
      const { data, error } = await apiInvoke('ai-workflow-update', { body: payload });
      if (error) throw new Error(error.message);
      return data?.workflow as AiWorkflow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-workflows', workspaceId] });
      toast.success('Workflow atualizado');
    },
    onError: (error: Error) => {
      console.error('Error updating workflow:', error);
      toast.error(`Erro ao atualizar workflow: ${error.message}`);
    },
  });

  // Trigger workflow agora (manual test, bypass cron schedule)
  const triggerWorkflow = useMutation({
    mutationFn: async (workflowId: string) => {
      const { data, error } = await apiInvoke('ai-workflow-trigger', {
        body: { workflow_id: workflowId },
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-workflows', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['ai-workflow-runs-latest'] });
      toast.success('Workflow disparado. Veja runs pra acompanhar.');
    },
    onError: (error: Error) => {
      console.error('Error triggering workflow:', error);
      toast.error(`Erro ao disparar workflow: ${error.message}`);
    },
  });

  // Update agent (admin / super_admin) — knowledge_base, sub_agents, model etc.
  const updateAgent = useMutation({
    mutationFn: async (payload: {
      id: string;
      name?: string;
      description?: string | null;
      skill_id?: string | null;
      knowledge_base?: Record<string, unknown>;
      sub_agents?: Record<string, unknown>;
      model?: string | null;
      is_active?: boolean;
    }) => {
      const { data, error } = await apiInvoke('ai-agent-update', { body: payload });
      if (error) throw new Error(error.message);
      return data?.agent as AiAgent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-agents', workspaceId] });
      toast.success('Agent atualizado');
    },
    onError: (error: Error) => {
      console.error('Error updating agent:', error);
      toast.error(`Erro ao atualizar agent: ${error.message}`);
    },
  });

  return {
    workflows: workflows || [],
    agents: agents || [],
    isLoading,
    refetch,
    toggleWorkflow,
    updateWorkflow,
    updateAgent,
    triggerWorkflow,
  };
}
