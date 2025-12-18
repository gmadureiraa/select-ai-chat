import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAIWorkflows } from "./useAIWorkflows";
import { useWorkflowExecution } from "./useWorkflowExecution";
import { toast } from "sonner";

interface WorkflowMatch {
  id: string;
  name: string;
  description: string | null;
  confidence: number;
}

interface WorkflowExecutionState {
  isExecuting: boolean;
  workflowId: string | null;
  workflowName: string | null;
  status: "pending" | "running" | "completed" | "failed";
  result: string | null;
  error: string | null;
}

// Patterns para detectar pedidos de workflow
const WORKFLOW_PATTERNS = [
  /execut(?:e|ar?)\s+(?:o\s+)?workflow\s+["']?(.+?)["']?(?:\s|$)/i,
  /rod(?:e|ar?)\s+(?:o\s+)?workflow\s+["']?(.+?)["']?(?:\s|$)/i,
  /us(?:e|ar?)\s+(?:o\s+)?workflow\s+["']?(.+?)["']?(?:\s|$)/i,
  /workflow\s+["'](.+?)["']/i,
  /inici(?:e|ar?)\s+(?:o\s+)?workflow\s+["']?(.+?)["']?(?:\s|$)/i,
];

// Detecta se a mensagem pede para listar workflows
const LIST_WORKFLOW_PATTERNS = [
  /list(?:e|ar?)?\s+(?:os\s+)?workflows/i,
  /quais\s+workflows/i,
  /mostrar?\s+workflows/i,
  /workflows?\s+dispon[ií]ve[li]s/i,
  /ver\s+workflows/i,
];

export function useChatWorkflows() {
  const { workflows } = useAIWorkflows();
  const [executionState, setExecutionState] = useState<WorkflowExecutionState>({
    isExecuting: false,
    workflowId: null,
    workflowName: null,
    status: "pending",
    result: null,
    error: null,
  });

  // Detecta se a mensagem quer listar workflows
  const detectListWorkflowsRequest = useCallback((message: string): boolean => {
    return LIST_WORKFLOW_PATTERNS.some(p => p.test(message));
  }, []);

  // Detecta se a mensagem quer executar um workflow específico
  const detectWorkflowRequest = useCallback((message: string): WorkflowMatch | null => {
    for (const pattern of WORKFLOW_PATTERNS) {
      const match = message.match(pattern);
      if (match && match[1]) {
        const requestedName = match[1].trim().toLowerCase();
        
        // Buscar workflow por nome (fuzzy match)
        const matchedWorkflow = workflows.find(w => {
          const workflowName = w.name.toLowerCase();
          return workflowName.includes(requestedName) || 
                 requestedName.includes(workflowName) ||
                 calculateSimilarity(workflowName, requestedName) > 0.6;
        });

        if (matchedWorkflow) {
          return {
            id: matchedWorkflow.id,
            name: matchedWorkflow.name,
            description: matchedWorkflow.description,
            confidence: calculateSimilarity(matchedWorkflow.name.toLowerCase(), requestedName),
          };
        }
      }
    }
    return null;
  }, [workflows]);

  // Executa um workflow pelo ID
  const executeWorkflow = useCallback(async (
    workflowId: string,
    input: string,
    clientId?: string,
    clientContext?: Record<string, any>
  ): Promise<{ success: boolean; result: string; error?: string }> => {
    const workflow = workflows.find(w => w.id === workflowId);
    if (!workflow) {
      return { success: false, result: "", error: "Workflow não encontrado" };
    }

    setExecutionState({
      isExecuting: true,
      workflowId,
      workflowName: workflow.name,
      status: "running",
      result: null,
      error: null,
    });

    try {
      const { data, error } = await supabase.functions.invoke("execute-workflow", {
        body: {
          workflowId,
          triggerData: {
            input,
            message: input,
            variables: {
              clientId,
              clientContext,
            },
          },
        },
      });

      if (error) throw error;

      if (data.success) {
        setExecutionState(prev => ({
          ...prev,
          isExecuting: false,
          status: "completed",
          result: typeof data.result === "string" ? data.result : JSON.stringify(data.result, null, 2),
        }));

        return {
          success: true,
          result: typeof data.result === "string" ? data.result : JSON.stringify(data.result, null, 2),
        };
      } else {
        throw new Error(data.error || "Erro desconhecido");
      }
    } catch (error: any) {
      const errorMessage = error.message || "Erro ao executar workflow";
      
      setExecutionState(prev => ({
        ...prev,
        isExecuting: false,
        status: "failed",
        error: errorMessage,
      }));

      return { success: false, result: "", error: errorMessage };
    }
  }, [workflows]);

  // Formata lista de workflows para exibição no chat
  const formatWorkflowsList = useCallback((): string => {
    if (workflows.length === 0) {
      return "Você ainda não tem workflows criados. Acesse o **Agent Builder** para criar seu primeiro workflow.";
    }

    let response = `## Workflows Disponíveis (${workflows.length})\n\n`;
    
    const activeWorkflows = workflows.filter(w => w.is_active);
    const inactiveWorkflows = workflows.filter(w => !w.is_active);

    if (activeWorkflows.length > 0) {
      response += `### ✅ Ativos\n`;
      activeWorkflows.forEach(w => {
        response += `- **${w.name}**${w.description ? `: ${w.description}` : ""}\n`;
        response += `  → Para executar: \`execute workflow "${w.name}"\`\n`;
      });
    }

    if (inactiveWorkflows.length > 0) {
      response += `\n### ⏸️ Inativos\n`;
      inactiveWorkflows.forEach(w => {
        response += `- ${w.name}${w.description ? `: ${w.description}` : ""}\n`;
      });
    }

    return response;
  }, [workflows]);

  // Reset execution state
  const resetExecution = useCallback(() => {
    setExecutionState({
      isExecuting: false,
      workflowId: null,
      workflowName: null,
      status: "pending",
      result: null,
      error: null,
    });
  }, []);

  return {
    workflows,
    executionState,
    detectListWorkflowsRequest,
    detectWorkflowRequest,
    executeWorkflow,
    formatWorkflowsList,
    resetExecution,
  };
}

// Função auxiliar para calcular similaridade entre strings
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}
