import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface N8nWorkflow {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  nodes?: N8nNode[];
  connections?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  tags?: { id: string; name: string }[];
}

export interface N8nNode {
  id: string;
  name: string;
  type: string;
  position: [number, number];
  parameters: Record<string, unknown>;
  typeVersion?: number;
}

export interface N8nExecution {
  id: string;
  workflowId: string;
  finished: boolean;
  mode: string;
  startedAt: string;
  stoppedAt?: string;
  status: 'success' | 'error' | 'waiting' | 'running' | 'canceled';
  data?: {
    resultData?: {
      runData?: Record<string, N8nNodeExecution[]>;
      error?: { message: string; stack?: string };
    };
  };
  workflowData?: N8nWorkflow;
}

export interface N8nNodeExecution {
  startTime: number;
  executionTime: number;
  source: unknown[];
  data: {
    main?: Array<Array<{ json: Record<string, unknown>; binary?: unknown }>>;
  };
  error?: { message: string };
}

async function callN8nAPI<T>(action: string, params?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('n8n-api', {
    body: { action, ...params }
  });

  if (error) {
    console.error('n8n API error:', error);
    throw new Error(error.message || 'Failed to call n8n API');
  }

  if (!data.success) {
    throw new Error(data.error || 'n8n API request failed');
  }

  return data.data;
}

export function useN8nWorkflows() {
  return useQuery({
    queryKey: ['n8n-workflows'],
    queryFn: async () => {
      const result = await callN8nAPI<{ data: N8nWorkflow[] }>('list_workflows');
      return result.data || [];
    },
    staleTime: 30000, // 30 seconds
  });
}

export function useN8nWorkflow(workflowId: string | null) {
  return useQuery({
    queryKey: ['n8n-workflow', workflowId],
    queryFn: async () => {
      if (!workflowId) return null;
      return callN8nAPI<N8nWorkflow>('get_workflow', { workflowId });
    },
    enabled: !!workflowId,
  });
}

export function useN8nExecutions(workflowId?: string) {
  return useQuery({
    queryKey: ['n8n-executions', workflowId],
    queryFn: async () => {
      const result = await callN8nAPI<{ data: N8nExecution[] }>('list_executions', { 
        workflowId 
      });
      return result.data || [];
    },
    staleTime: 10000, // 10 seconds
    refetchInterval: 30000, // Auto-refresh every 30s
  });
}

export function useN8nExecution(executionId: string | null) {
  return useQuery({
    queryKey: ['n8n-execution', executionId],
    queryFn: async () => {
      if (!executionId) return null;
      return callN8nAPI<N8nExecution>('get_execution', { executionId });
    },
    enabled: !!executionId,
  });
}

export function useActivateWorkflow() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (workflowId: string) => {
      return callN8nAPI('activate_workflow', { workflowId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['n8n-workflows'] });
      toast.success('Workflow ativado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao ativar workflow: ${error.message}`);
    },
  });
}

export function useDeactivateWorkflow() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (workflowId: string) => {
      return callN8nAPI('deactivate_workflow', { workflowId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['n8n-workflows'] });
      toast.success('Workflow desativado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao desativar workflow: ${error.message}`);
    },
  });
}

export function useExecuteWorkflow() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ workflowId, data }: { workflowId: string; data?: Record<string, unknown> }) => {
      return callN8nAPI('execute_workflow', { workflowId, data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['n8n-executions'] });
      toast.success('Workflow executado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao executar workflow: ${error.message}`);
    },
  });
}

export function useRetryExecution() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (executionId: string) => {
      return callN8nAPI('retry_execution', { executionId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['n8n-executions'] });
      toast.success('Execução re-executada com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao re-executar: ${error.message}`);
    },
  });
}

export function useDeleteExecution() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (executionId: string) => {
      return callN8nAPI('delete_execution', { executionId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['n8n-executions'] });
      toast.success('Execução removida');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao remover execução: ${error.message}`);
    },
  });
}
