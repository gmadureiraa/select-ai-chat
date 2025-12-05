import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface WorkflowRun {
  id: string;
  workflow_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  trigger_data: any;
  execution_log: any[];
  result: any;
  error: string | null;
  started_at: string;
  completed_at: string | null;
}

interface ExecuteWorkflowParams {
  workflowId: string;
  triggerData?: {
    input?: string;
    message?: string;
    variables?: Record<string, any>;
  };
}

interface ExecutionResult {
  success: boolean;
  result: any;
  error?: string;
  runId: string;
}

export function useWorkflowExecution(workflowId?: string) {
  const queryClient = useQueryClient();
  const [isExecuting, setIsExecuting] = useState(false);

  // Fetch workflow runs for a specific workflow
  const { data: runs, isLoading: isLoadingRuns, refetch: refetchRuns } = useQuery({
    queryKey: ['workflow-runs', workflowId],
    queryFn: async () => {
      if (!workflowId) return [];
      
      const { data, error } = await supabase
        .from('ai_workflow_runs')
        .select('*')
        .eq('workflow_id', workflowId)
        .order('started_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as WorkflowRun[];
    },
    enabled: !!workflowId,
  });

  // Fetch a specific run
  const fetchRun = async (runId: string): Promise<WorkflowRun | null> => {
    const { data, error } = await supabase
      .from('ai_workflow_runs')
      .select('*')
      .eq('id', runId)
      .single();

    if (error) {
      console.error('Error fetching run:', error);
      return null;
    }
    return data as WorkflowRun;
  };

  // Execute workflow mutation
  const executeWorkflowMutation = useMutation({
    mutationFn: async ({ workflowId, triggerData }: ExecuteWorkflowParams): Promise<ExecutionResult> => {
      setIsExecuting(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await supabase.functions.invoke('execute-workflow', {
        body: { workflowId, triggerData },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Execution failed');
      }

      return response.data as ExecutionResult;
    },
    onSuccess: (data) => {
      setIsExecuting(false);
      if (data.success) {
        toast.success('Workflow executado com sucesso!');
      } else {
        toast.error(`Erro na execução: ${data.error}`);
      }
      queryClient.invalidateQueries({ queryKey: ['workflow-runs', workflowId] });
    },
    onError: (error: Error) => {
      setIsExecuting(false);
      toast.error(`Erro ao executar workflow: ${error.message}`);
    },
  });

  // Delete a run
  const deleteRunMutation = useMutation({
    mutationFn: async (runId: string) => {
      const { error } = await supabase
        .from('ai_workflow_runs')
        .delete()
        .eq('id', runId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Execução removida');
      queryClient.invalidateQueries({ queryKey: ['workflow-runs', workflowId] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao remover execução: ${error.message}`);
    },
  });

  // Poll for run status updates
  const pollRunStatus = async (runId: string, onUpdate: (run: WorkflowRun) => void, interval = 1000) => {
    const checkStatus = async () => {
      const run = await fetchRun(runId);
      if (run) {
        onUpdate(run);
        if (run.status === 'running' || run.status === 'pending') {
          setTimeout(checkStatus, interval);
        }
      }
    };
    checkStatus();
  };

  return {
    runs,
    isLoadingRuns,
    refetchRuns,
    isExecuting,
    executeWorkflow: executeWorkflowMutation.mutate,
    executeWorkflowAsync: executeWorkflowMutation.mutateAsync,
    deleteRun: deleteRunMutation.mutate,
    fetchRun,
    pollRunStatus,
  };
}
