import { useState, useEffect, useCallback } from "react";
import { 
  Play, 
  Pause, 
  RotateCcw, 
  CheckCircle2, 
  XCircle,
  ChevronDown,
  ChevronRight,
  Zap,
  Brain,
  FileText,
  Search,
  Sparkles,
  Clock,
  PenTool,
  Palette,
  BarChart3,
  Mail,
  Lightbulb,
  Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { AgentExecution, OrchestratorDecision, SpecializedAgentType } from "@/types/orchestrator";

export interface ExecutionStep {
  id: string;
  name: string;
  description: string;
  status: "pending" | "running" | "completed" | "error" | "skipped";
  result?: string;
  duration?: number;
  tool?: string;
  agentType?: SpecializedAgentType;
}

export interface ExecutionPlan {
  goal: string;
  steps: ExecutionStep[];
  estimatedDuration: number;
}

interface AutonomousExecutorProps {
  plan: ExecutionPlan;
  isRunning: boolean;
  isPaused: boolean;
  executions?: AgentExecution[];
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onViewOutput?: (stepId: string) => void;
}

const agentIcons: Record<SpecializedAgentType | string, typeof Brain> = {
  content_writer: PenTool,
  design_agent: Palette,
  metrics_analyst: BarChart3,
  email_developer: Mail,
  researcher: Search,
  strategist: Lightbulb,
  analyze: Brain,
  search: Search,
  read: FileText,
  generate: Sparkles,
  default: Zap
};

const agentColors: Record<SpecializedAgentType, string> = {
  content_writer: "text-blue-500 bg-blue-500/20 border-blue-500/40",
  design_agent: "text-purple-500 bg-purple-500/20 border-purple-500/40",
  metrics_analyst: "text-green-500 bg-green-500/20 border-green-500/40",
  email_developer: "text-orange-500 bg-orange-500/20 border-orange-500/40",
  researcher: "text-cyan-500 bg-cyan-500/20 border-cyan-500/40",
  strategist: "text-amber-500 bg-amber-500/20 border-amber-500/40"
};

export const AutonomousExecutor = ({
  plan,
  isRunning,
  isPaused,
  executions = [],
  onPause,
  onResume,
  onCancel,
  onRetry,
  onViewOutput
}: AutonomousExecutorProps) => {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning && !isPaused) {
      interval = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, isPaused]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  // Merge plan steps with execution data
  const enrichedSteps = plan.steps.map(step => {
    const execution = executions.find(e => e.stepId === step.id);
    return {
      ...step,
      status: execution?.status || step.status,
      result: execution?.output || step.result,
      duration: execution?.durationMs || step.duration,
      intermediateOutputs: execution?.intermediateOutputs
    };
  });

  const completedSteps = enrichedSteps.filter(s => s.status === "completed").length;
  const progress = Math.round((completedSteps / plan.steps.length) * 100);
  const currentStep = enrichedSteps.find(s => s.status === "running");
  const hasError = enrichedSteps.some(s => s.status === "error");

  const toggleStepExpand = (stepId: string) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(stepId)) {
      newExpanded.delete(stepId);
    } else {
      newExpanded.add(stepId);
    }
    setExpandedSteps(newExpanded);
  };

  const getStepIcon = (step: ExecutionStep) => {
    if (step.agentType) {
      return agentIcons[step.agentType] || agentIcons.default;
    }
    return agentIcons[step.tool || "default"] || agentIcons.default;
  };

  const getAgentColor = (step: ExecutionStep) => {
    if (step.agentType && agentColors[step.agentType]) {
      return agentColors[step.agentType];
    }
    return "text-primary bg-primary/20 border-primary/40";
  };

  return (
    <Card className="overflow-hidden border-2 border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-transparent">
      {/* Header */}
      <div className="p-4 border-b border-border/50 bg-muted/30">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-amber-500/20 border border-amber-500/40">
              <Zap className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium">Execução Autônoma</h3>
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-[10px]",
                    isRunning && !isPaused && "bg-green-500/20 border-green-500/40 text-green-600",
                    isPaused && "bg-yellow-500/20 border-yellow-500/40 text-yellow-600",
                    hasError && "bg-red-500/20 border-red-500/40 text-red-600",
                    !isRunning && !hasError && completedSteps === plan.steps.length && "bg-primary/20 border-primary/40 text-primary"
                  )}
                >
                  {hasError ? "Erro" : isPaused ? "Pausado" : isRunning ? "Em execução" : completedSteps === plan.steps.length ? "Concluído" : "Aguardando"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{plan.goal}</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {isRunning && !hasError && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={isPaused ? onResume : onPause}
              >
                {isPaused ? (
                  <Play className="h-4 w-4 text-green-500" />
                ) : (
                  <Pause className="h-4 w-4 text-yellow-500" />
                )}
              </Button>
            )}
            {hasError && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={onRetry}
              >
                <RotateCcw className="h-4 w-4 text-amber-500" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={onCancel}
            >
              <XCircle className="h-4 w-4 text-muted-foreground hover:text-destructive" />
            </Button>
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{completedSteps}/{plan.steps.length} etapas</span>
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatTime(elapsedTime)}
              </span>
              <span className="text-primary font-medium">{progress}%</span>
            </div>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        {/* Current step highlight */}
        {currentStep && (
          <div className="mt-3 p-2 rounded-lg bg-primary/10 border border-primary/20 flex items-center gap-2">
            <div className="animate-pulse">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-primary">{currentStep.name}</p>
              <p className="text-[10px] text-muted-foreground truncate">{currentStep.description}</p>
            </div>
          </div>
        )}
      </div>

      {/* Steps List */}
      <ScrollArea className="max-h-80">
        <div className="p-3 space-y-1.5">
          {enrichedSteps.map((step, index) => {
            const Icon = getStepIcon(step);
            const isExpanded = expandedSteps.has(step.id);
            const colorClass = step.agentType ? getAgentColor(step) : "";
            
            return (
              <Collapsible 
                key={step.id} 
                open={isExpanded}
                onOpenChange={() => step.result && toggleStepExpand(step.id)}
              >
                <div 
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-lg transition-all",
                    step.status === "running" && "bg-primary/10 border border-primary/20",
                    step.status === "completed" && "bg-muted/30",
                    step.status === "error" && "bg-destructive/10 border border-destructive/20",
                    step.status === "pending" && "opacity-50"
                  )}
                >
                  {/* Status icon */}
                  <div className={cn("flex-shrink-0 p-1.5 rounded-full border", step.agentType && colorClass)}>
                    {step.status === "completed" && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
                    {step.status === "running" && (
                      <div className="relative">
                        <div className="absolute inset-0 bg-primary/30 rounded-full blur-sm animate-pulse" />
                        <Icon className="h-3.5 w-3.5 text-primary animate-pulse relative" />
                      </div>
                    )}
                    {step.status === "pending" && (
                      <div className="h-3.5 w-3.5 rounded-full border border-muted-foreground/50 flex items-center justify-center text-[9px] text-muted-foreground">
                        {index + 1}
                      </div>
                    )}
                    {step.status === "error" && <XCircle className="h-3.5 w-3.5 text-destructive" />}
                    {step.status === "skipped" && <div className="h-3.5 w-3.5 rounded-full bg-muted" />}
                  </div>

                  {/* Step info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className={cn(
                        "text-xs",
                        step.status === "running" && "text-primary font-medium",
                        step.status === "completed" && "text-foreground",
                        step.status === "error" && "text-destructive",
                        step.status === "pending" && "text-muted-foreground"
                      )}>
                        {step.name}
                      </p>
                      {step.agentType && (
                        <Badge variant="secondary" className="text-[9px] h-4 px-1">
                          {step.agentType.replace("_", " ")}
                        </Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">{step.description}</p>
                  </div>

                  {/* Duration */}
                  {step.duration && step.status === "completed" && (
                    <span className="text-[10px] text-muted-foreground">
                      {step.duration > 1000 ? `${(step.duration / 1000).toFixed(1)}s` : `${step.duration}ms`}
                    </span>
                  )}

                  {/* View output button */}
                  {step.result && onViewOutput && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewOutput(step.id);
                      }}
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                  )}

                  {/* Expand trigger */}
                  {step.result && (
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-5 w-5 p-0">
                        {isExpanded ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                  )}
                </div>

                {/* Expanded result */}
                <CollapsibleContent>
                  <div className="mt-1 ml-8 p-2 rounded-lg bg-muted/50 text-xs text-muted-foreground max-h-32 overflow-y-auto">
                    <pre className="whitespace-pre-wrap font-sans">{step.result?.substring(0, 500)}{step.result && step.result.length > 500 && "..."}</pre>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </ScrollArea>
    </Card>
  );
};

// Helper function to create an execution plan from orchestrator decision
export const createExecutionPlanFromDecision = (
  decision: OrchestratorDecision,
  goal: string
): ExecutionPlan => {
  return {
    goal,
    steps: decision.executionPlan.map(step => ({
      id: step.id,
      name: step.name,
      description: step.description,
      status: "pending" as const,
      tool: step.tools[0],
      agentType: step.agentType
    })),
    estimatedDuration: decision.estimatedDuration
  };
};

// Legacy helper function for simple requests
export const createExecutionPlan = (goal: string, complexity: "simple" | "medium" | "complex"): ExecutionPlan => {
  const baseSteps: ExecutionStep[] = [
    { id: "1", name: "Análise de contexto", description: "Carregando informações do cliente", status: "pending", tool: "analyze" },
    { id: "2", name: "Leitura de referências", description: "Buscando materiais relevantes", status: "pending", tool: "read" },
  ];

  if (complexity === "medium" || complexity === "complex") {
    baseSteps.push(
      { id: "3", name: "Pesquisa de padrões", description: "Analisando biblioteca de conteúdo", status: "pending", tool: "search" },
      { id: "4", name: "Síntese de informações", description: "Combinando dados coletados", status: "pending", tool: "analyze" }
    );
  }

  if (complexity === "complex") {
    baseSteps.push(
      { id: "5", name: "Geração de rascunho", description: "Criando primeira versão", status: "pending", tool: "generate" },
      { id: "6", name: "Revisão de estilo", description: "Aplicando tom do cliente", status: "pending", tool: "analyze" },
      { id: "7", name: "Refinamento final", description: "Polindo conteúdo final", status: "pending", tool: "generate" }
    );
  }

  baseSteps.push(
    { id: String(baseSteps.length + 1), name: "Geração de resposta", description: "Finalizando output", status: "pending", tool: "generate" }
  );

  return {
    goal,
    steps: baseSteps,
    estimatedDuration: baseSteps.length * 3
  };
};
