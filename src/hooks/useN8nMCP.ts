import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

export interface N8nWorkflow {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  triggerType?: string;
  inputSchema?: Record<string, any>;
}

export interface WorkflowExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
}

// This hook provides integration with n8n MCP
// The MCP tools are available to the Lovable agent, not directly to the app
// This hook simulates the workflow operations for UI purposes
export function useN8nMCP() {
  const [workflows, setWorkflows] = useState<N8nWorkflow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const { toast } = useToast();

  // Fetch workflows from cache/local storage or default list
  const fetchWorkflows = useCallback(async () => {
    setIsLoading(true);
    try {
      // In a real implementation, this would call an edge function
      // that uses the n8n MCP to list workflows
      const cached = localStorage.getItem("n8n_workflows");
      if (cached) {
        setWorkflows(JSON.parse(cached));
      } else {
        // Default workflows from MCP
        const defaultWorkflows: N8nWorkflow[] = [
          {
            id: "c7szXhtpjXUqaRKK",
            name: "Resumo cripto emails das últimas 24 horas",
            description: "Workflow que coleta emails de newsletters cripto, faz resumo com AI e envia por email",
            active: true,
            triggerType: "webhook",
          },
        ];
        setWorkflows(defaultWorkflows);
        localStorage.setItem("n8n_workflows", JSON.stringify(defaultWorkflows));
      }
    } catch (error) {
      console.error("Failed to fetch n8n workflows:", error);
      toast({
        title: "Erro ao carregar workflows",
        description: "Não foi possível carregar os workflows do n8n",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Add a new workflow to the list
  const addWorkflow = useCallback((workflow: N8nWorkflow) => {
    setWorkflows((prev) => {
      const updated = [...prev, workflow];
      localStorage.setItem("n8n_workflows", JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Remove a workflow from the list
  const removeWorkflow = useCallback((workflowId: string) => {
    setWorkflows((prev) => {
      const updated = prev.filter((w) => w.id !== workflowId);
      localStorage.setItem("n8n_workflows", JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Execute a workflow via webhook
  const executeWorkflow = useCallback(async (
    webhookUrl: string,
    data?: Record<string, any>
  ): Promise<WorkflowExecutionResult> => {
    setIsExecuting(true);
    try {
      // Call the webhook with no-cors mode (n8n webhooks may not have CORS)
      await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        mode: "no-cors",
        body: JSON.stringify(data || {}),
      });

      toast({
        title: "Workflow executado",
        description: "O workflow foi acionado com sucesso",
      });

      return { success: true };
    } catch (error) {
      console.error("Failed to execute workflow:", error);
      toast({
        title: "Erro ao executar workflow",
        description: "Não foi possível acionar o workflow",
        variant: "destructive",
      });
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      };
    } finally {
      setIsExecuting(false);
    }
  }, [toast]);

  // Update a workflow's webhook URL
  const updateWorkflowWebhook = useCallback((workflowId: string, webhookUrl: string) => {
    const webhooks = JSON.parse(localStorage.getItem("n8n_webhooks") || "{}");
    webhooks[workflowId] = webhookUrl;
    localStorage.setItem("n8n_webhooks", JSON.stringify(webhooks));
  }, []);

  // Get a workflow's webhook URL
  const getWorkflowWebhook = useCallback((workflowId: string): string | null => {
    const webhooks = JSON.parse(localStorage.getItem("n8n_webhooks") || "{}");
    return webhooks[workflowId] || null;
  }, []);

  return {
    workflows,
    isLoading,
    isExecuting,
    fetchWorkflows,
    addWorkflow,
    removeWorkflow,
    executeWorkflow,
    updateWorkflowWebhook,
    getWorkflowWebhook,
  };
}
