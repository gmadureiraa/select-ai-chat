import { useState, useCallback } from "react";

export interface N8nWorkflow {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  triggerCount: number;
  webhookUrl?: string;
  createdAt: string;
  updatedAt: string;
}

// Known n8n workflows from MCP - these are fetched and cached
const CACHED_N8N_WORKFLOWS: N8nWorkflow[] = [
  {
    id: "c7szXhtpjXUqaRKK",
    name: "Resumo cripto emails das últimas 24 horas",
    description: "Workflow que coleta emails de newsletters cripto, faz resumo com AI e envia por email",
    active: true,
    triggerCount: 2,
    webhookUrl: "https://n8n.srv789271.hstgr.cloud/webhook/30cde8f1-2bd8-4504-9ea0-c62ce17b550a",
    createdAt: "2025-07-02T12:23:51.190Z",
    updatedAt: "2025-11-29T14:53:11.000Z",
  },
];

export function useN8nWorkflows() {
  const [workflows, setWorkflows] = useState<N8nWorkflow[]>(CACHED_N8N_WORKFLOWS);
  const [isLoading, setIsLoading] = useState(false);

  const refreshWorkflows = useCallback(async () => {
    setIsLoading(true);
    try {
      // In production, this would call an edge function that uses the n8n MCP
      // For now, we use the cached workflows from the MCP response
      setWorkflows(CACHED_N8N_WORKFLOWS);
    } catch (error) {
      console.error("Failed to fetch n8n workflows:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const executeWorkflow = useCallback(async (workflowId: string, webhookUrl?: string, data?: Record<string, any>) => {
    const workflow = workflows.find(w => w.id === workflowId);
    const url = webhookUrl || workflow?.webhookUrl;
    
    if (!url) {
      throw new Error("Webhook URL not found for workflow");
    }

    try {
      // Call the n8n webhook with data
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        mode: "no-cors", // n8n webhooks may not have CORS headers
        body: JSON.stringify(data || {}),
      });

      return { success: true, message: "Workflow triggered successfully" };
    } catch (error) {
      console.error("Failed to execute n8n workflow:", error);
      throw error;
    }
  }, [workflows]);

  return {
    workflows,
    isLoading,
    refreshWorkflows,
    executeWorkflow,
  };
}
