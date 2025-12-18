import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  OrchestratorDecision,
  OrchestrationState,
  AgentExecution,
  SpecializedAgentType,
  detectRequestComplexity,
  detectRequiredAgents,
} from "@/types/orchestrator";

interface UseOrchestratorOptions {
  clientId: string;
  clientContext?: {
    name: string;
    description?: string;
    identityGuide?: string;
  };
  onStepStart?: (step: AgentExecution) => void;
  onStepComplete?: (step: AgentExecution) => void;
  onComplete?: (finalOutput: string) => void;
  onError?: (error: string) => void;
}

export function useOrchestrator(options: UseOrchestratorOptions) {
  const { user } = useAuth();
  const [state, setState] = useState<OrchestrationState>({
    isActive: false,
    isPaused: false,
    plan: null,
    executions: [],
    currentStepId: null,
    finalOutput: null,
    startedAt: null,
    completedAt: null,
  });

  const analyzeRequest = useCallback(async (
    userMessage: string,
    availableData: Record<string, any>
  ): Promise<OrchestratorDecision | null> => {
    try {
      // Quick local analysis first
      const complexity = detectRequestComplexity(userMessage);
      const detectedAgents = detectRequiredAgents(userMessage);
      
      // For simple requests, skip orchestrator call
      if (complexity === "simple" && detectedAgents.length === 1) {
        return {
          shouldUseOrchestrator: false,
          complexity: "simple",
          selectedAgents: detectedAgents,
          executionPlan: [{
            id: "step-1",
            agentType: detectedAgents[0],
            name: "Execução direta",
            description: "Processamento simples",
            dependencies: [],
            expectedOutput: "Resposta final",
            tools: []
          }],
          reasoning: "Pedido simples - execução direta",
          estimatedDuration: 15
        };
      }

      // For complex requests, call orchestrator
      const { data, error } = await supabase.functions.invoke("orchestrator", {
        body: {
          userMessage,
          clientContext: options.clientContext,
          availableData,
          userId: user?.id,
          clientId: options.clientId
        }
      });

      if (error) throw error;
      return data as OrchestratorDecision;
    } catch (error: any) {
      console.error("[ORCHESTRATOR] Analysis error:", error);
      options.onError?.(error.message);
      return null;
    }
  }, [options.clientId, options.clientContext, user?.id, options.onError]);

  const executeStep = useCallback(async (
    step: AgentExecution,
    userMessage: string,
    additionalData: Record<string, any>
  ): Promise<AgentExecution> => {
    const startTime = new Date().toISOString();
    
    try {
      options.onStepStart?.({
        ...step,
        status: "running",
        startedAt: startTime
      });

      setState(prev => ({
        ...prev,
        currentStepId: step.stepId,
        executions: prev.executions.map(e => 
          e.stepId === step.stepId 
            ? { ...e, status: "running" as const, startedAt: startTime }
            : e
        )
      }));

      // Get previous outputs from completed steps
      const previousOutputs: Record<string, string> = {};
      state.executions
        .filter(e => e.status === "completed" && e.output)
        .forEach(e => {
          previousOutputs[e.agentType] = e.output!;
        });

      const { data, error } = await supabase.functions.invoke("execute-agent", {
        body: {
          agentType: step.agentType,
          stepId: step.stepId,
          userMessage,
          clientContext: options.clientContext,
          previousOutputs,
          additionalData,
          userId: user?.id,
          clientId: options.clientId
        }
      });

      if (error) throw error;

      const completedStep: AgentExecution = {
        ...step,
        status: "completed",
        output: data.output,
        startedAt: startTime,
        completedAt: new Date().toISOString(),
        durationMs: data.durationMs
      };

      setState(prev => ({
        ...prev,
        executions: prev.executions.map(e =>
          e.stepId === step.stepId ? completedStep : e
        )
      }));

      options.onStepComplete?.(completedStep);
      return completedStep;

    } catch (error: any) {
      const errorStep: AgentExecution = {
        ...step,
        status: "error",
        error: error.message,
        startedAt: startTime,
        completedAt: new Date().toISOString()
      };

      setState(prev => ({
        ...prev,
        executions: prev.executions.map(e =>
          e.stepId === step.stepId ? errorStep : e
        )
      }));

      throw error;
    }
  }, [state.executions, options, user?.id]);

  const executePlan = useCallback(async (
    plan: OrchestratorDecision,
    userMessage: string,
    additionalData: Record<string, any>
  ) => {
    // Initialize executions
    const initialExecutions: AgentExecution[] = plan.executionPlan.map(step => ({
      stepId: step.id,
      agentType: step.agentType,
      status: "pending" as const
    }));

    setState({
      isActive: true,
      isPaused: false,
      plan,
      executions: initialExecutions,
      currentStepId: null,
      finalOutput: null,
      startedAt: new Date().toISOString(),
      completedAt: null
    });

    try {
      let lastOutput = "";
      
      for (const planStep of plan.executionPlan) {
        // Check if paused
        if (state.isPaused) {
          console.log("[ORCHESTRATOR] Execution paused");
          break;
        }

        // Check dependencies
        const dependenciesMet = planStep.dependencies.every(depId => {
          const depExecution = initialExecutions.find(e => e.stepId === depId);
          return depExecution?.status === "completed";
        });

        if (!dependenciesMet) {
          console.warn(`[ORCHESTRATOR] Dependencies not met for step ${planStep.id}`);
          continue;
        }

        const execution = initialExecutions.find(e => e.stepId === planStep.id);
        if (!execution) continue;

        const completedStep = await executeStep(execution, userMessage, additionalData);
        if (completedStep.output) {
          lastOutput = completedStep.output;
        }
      }

      setState(prev => ({
        ...prev,
        isActive: false,
        finalOutput: lastOutput,
        completedAt: new Date().toISOString()
      }));

      options.onComplete?.(lastOutput);

    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isActive: false,
        completedAt: new Date().toISOString()
      }));
      options.onError?.(error.message);
    }
  }, [executeStep, state.isPaused, options]);

  const pause = useCallback(() => {
    setState(prev => ({ ...prev, isPaused: true }));
  }, []);

  const resume = useCallback(() => {
    setState(prev => ({ ...prev, isPaused: false }));
  }, []);

  const cancel = useCallback(() => {
    setState({
      isActive: false,
      isPaused: false,
      plan: null,
      executions: [],
      currentStepId: null,
      finalOutput: null,
      startedAt: null,
      completedAt: null
    });
  }, []);

  const reset = useCallback(() => {
    cancel();
  }, [cancel]);

  return {
    state,
    analyzeRequest,
    executePlan,
    pause,
    resume,
    cancel,
    reset
  };
}
