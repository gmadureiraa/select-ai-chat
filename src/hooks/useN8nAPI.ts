import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";

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

async function callN8nAPI<T>(action: string, workspaceId: string, params?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('n8n-api', {
    body: { action, workspaceId, ...params }
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
  const { workspace } = useWorkspaceContext();

  return useQuery({
    queryKey: ['n8n-workflows', workspace?.id],
    queryFn: async () => {
      if (!workspace?.id) return [];
      const result = await callN8nAPI<{ data: N8nWorkflow[] }>('list_workflows', workspace.id);
      return result.data || [];
    },
    enabled: !!workspace?.id,
    staleTime: 30000,
    retry: (failureCount, error) => {
      // Don't retry if n8n is not configured
      if (error instanceof Error && error.message === 'N8N_NOT_CONFIGURED') {
        return false;
      }
      return failureCount < 3;
    },
  });
}

export function useN8nWorkflow(workflowId: string | null) {
  const { workspace } = useWorkspaceContext();

  return useQuery({
    queryKey: ['n8n-workflow', workspace?.id, workflowId],
    queryFn: async () => {
      if (!workflowId || !workspace?.id) return null;
      return callN8nAPI<N8nWorkflow>('get_workflow', workspace.id, { workflowId });
    },
    enabled: !!workflowId && !!workspace?.id,
  });
}

export function useN8nExecutions(workflowId?: string) {
  const { workspace } = useWorkspaceContext();

  return useQuery({
    queryKey: ['n8n-executions', workspace?.id, workflowId],
    queryFn: async () => {
      if (!workspace?.id) return [];
      const result = await callN8nAPI<{ data: N8nExecution[] }>('list_executions', workspace.id, { 
        workflowId 
      });
      return result.data || [];
    },
    enabled: !!workspace?.id,
    staleTime: 10000,
    refetchInterval: 30000,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message === 'N8N_NOT_CONFIGURED') {
        return false;
      }
      return failureCount < 3;
    },
  });
}

export function useN8nExecution(executionId: string | null) {
  const { workspace } = useWorkspaceContext();

  return useQuery({
    queryKey: ['n8n-execution', workspace?.id, executionId],
    queryFn: async () => {
      if (!executionId || !workspace?.id) return null;
      return callN8nAPI<N8nExecution>('get_execution', workspace.id, { executionId });
    },
    enabled: !!executionId && !!workspace?.id,
  });
}

export function useActivateWorkflow() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspaceContext();
  
  return useMutation({
    mutationFn: async (workflowId: string) => {
      if (!workspace?.id) throw new Error('No workspace selected');
      return callN8nAPI('activate_workflow', workspace.id, { workflowId });
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
  const { workspace } = useWorkspaceContext();
  
  return useMutation({
    mutationFn: async (workflowId: string) => {
      if (!workspace?.id) throw new Error('No workspace selected');
      return callN8nAPI('deactivate_workflow', workspace.id, { workflowId });
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
  const { workspace } = useWorkspaceContext();
  
  return useMutation({
    mutationFn: async ({ workflowId, data }: { workflowId: string; data?: Record<string, unknown> }) => {
      if (!workspace?.id) throw new Error('No workspace selected');
      return callN8nAPI('execute_workflow', workspace.id, { workflowId, data });
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
  const { workspace } = useWorkspaceContext();
  
  return useMutation({
    mutationFn: async (executionId: string) => {
      if (!workspace?.id) throw new Error('No workspace selected');
      return callN8nAPI('retry_execution', workspace.id, { executionId });
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
  const { workspace } = useWorkspaceContext();
  
  return useMutation({
    mutationFn: async (executionId: string) => {
      if (!workspace?.id) throw new Error('No workspace selected');
      return callN8nAPI('delete_execution', workspace.id, { executionId });
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