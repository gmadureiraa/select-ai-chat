import { useState, useEffect } from "react";
import { 
  CheckCircle2, 
  Circle, 
  Loader2, 
  ChevronDown, 
  ChevronRight,
  Brain,
  Search,
  FileText,
  Sparkles,
  Clock,
  Zap,
  MessageSquare,
  Coins
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ProcessStep, MultiAgentStep } from "@/types/chat";

interface SubTask {
  id: string;
  label: string;
  status: "pending" | "running" | "completed" | "error";
  description?: string;
  duration?: number; // in ms
}

interface TokenUsage {
  agentId: string;
  agentName: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
}

interface AdvancedProgressProps {
  currentStep: ProcessStep;
  multiAgentStep?: MultiAgentStep;
  multiAgentDetails?: Record<string, string>;
  isAutonomous?: boolean;
  thoughtProcess?: string[];
  subTasks?: SubTask[];
  estimatedTimeRemaining?: number;
  tokenUsage?: TokenUsage[];
  totalTokens?: number;
  totalCost?: number;
}

const stepIcons: Record<string, typeof Brain> = {
  analyzing: Search,
  analyzing_library: FileText,
  selecting: FileText,
  reviewing: Brain,
  creating: Sparkles,
  generating_image: Sparkles,
  multi_agent: Zap,
  researcher: Search,
  writer: FileText,
  editor: Brain,
  reviewer: CheckCircle2,
};

// Model pricing per 1M tokens (input/output) in USD
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "gemini-2.5-flash": { input: 0.075, output: 0.30 },
  "gemini-2.5-pro": { input: 1.25, output: 5.00 },
  "gemini-2.0-flash-lite": { input: 0.02, output: 0.08 },
  "flash": { input: 0.075, output: 0.30 },
  "pro": { input: 1.25, output: 5.00 },
  "flash-lite": { input: 0.02, output: 0.08 },
};

export const AdvancedProgress = ({
  currentStep,
  multiAgentStep,
  multiAgentDetails = {},
  isAutonomous = false,
  thoughtProcess = [],
  subTasks = [],
  estimatedTimeRemaining,
  tokenUsage = [],
  totalTokens = 0,
  totalCost = 0,
}: AdvancedProgressProps) => {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isThoughtOpen, setIsThoughtOpen] = useState(false);
  const [isTokensOpen, setIsTokensOpen] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}k`;
    }
    return tokens.toString();
  };

  const formatCost = (cost: number) => {
    if (cost < 0.01) {
      return `$${cost.toFixed(4)}`;
    }
    return `$${cost.toFixed(3)}`;
  };

  const getProgressPercentage = () => {
    if (multiAgentStep) {
      const steps = ["researcher", "writer", "editor", "reviewer", "complete"];
      const currentIndex = steps.indexOf(multiAgentStep);
      return Math.round(((currentIndex + 1) / steps.length) * 100);
    }
    
    const contentSteps = ["analyzing", "selecting", "analyzing_library", "reviewing", "creating"];
    const currentIndex = contentSteps.indexOf(currentStep || "");
    return Math.round(((currentIndex + 1) / contentSteps.length) * 100);
  };

  const getCurrentStepLabel = () => {
    if (multiAgentStep) {
      const labels: Record<string, string> = {
        researcher: "🔍 Pesquisador analisando contexto...",
        writer: "✍️ Escritor criando rascunho...",
        editor: "📝 Editor de estilo refinando...",
        reviewer: "✅ Revisor finalizando...",
        complete: "✨ Completo!",
        error: "❌ Erro no processamento"
      };
      return labels[multiAgentStep] || "Processando...";
    }
    
    const labels: Record<string, string> = {
      analyzing: "Analisando sua solicitação...",
      analyzing_library: "Lendo biblioteca de conteúdo...",
      selecting: "Selecionando referências...",
      reviewing: "Preparando contexto...",
      creating: "Gerando resposta...",
      generating_image: "Gerando imagem com IA...",
      multi_agent: "Pipeline multi-agente ativo..."
    };
    return labels[currentStep || ""] || "Processando...";
  };

  const Icon = stepIcons[multiAgentStep || currentStep || "analyzing"] || Brain;

  return (
    <div className="space-y-3 p-4 rounded-2xl border border-border/60 bg-gradient-to-br from-card/80 to-card/50 backdrop-blur-sm shadow-lg">
      {/* Header com status principal */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/30 rounded-xl blur-lg animate-pulse" />
            <div className="relative p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/10 border border-primary/30 shadow-inner">
              <Icon className="h-5 w-5 text-primary" />
            </div>
          </div>
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-foreground">{getCurrentStepLabel()}</p>
            <div className="flex items-center gap-2">
              {isAutonomous && (
                <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/30 text-amber-600">
                  <Zap className="h-2.5 w-2.5 mr-0.5" />
                  Pipeline Multi-Agente
                </Badge>
              )}
              {estimatedTimeRemaining && (
                <span className="text-[9px] text-muted-foreground">
                  ~{Math.ceil(estimatedTimeRemaining / 60)}min restante
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-0.5">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/50 px-2 py-1 rounded-lg">
            <Clock className="h-3 w-3" />
            <span className="tabular-nums font-medium">{formatTime(elapsedTime)}</span>
          </div>
          <span className="text-[9px] text-muted-foreground/70">tempo decorrido</span>
        </div>
      </div>

      {/* Token usage display - real-time */}
      {(totalTokens > 0 || tokenUsage.length > 0) && (
        <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 rounded-xl border border-emerald-500/20">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-emerald-500" />
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-foreground">
                {formatTokens(totalTokens)} tokens
              </span>
              <span className="text-xs text-muted-foreground">•</span>
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                {formatCost(totalCost)}
              </span>
            </div>
          </div>
          {tokenUsage.length > 0 && (
            <button 
              onClick={() => setIsTokensOpen(!isTokensOpen)}
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {isTokensOpen ? "Ocultar" : "Detalhes"}
            </button>
          )}
        </div>
      )}

      {/* Token usage breakdown (collapsible) */}
      {isTokensOpen && tokenUsage.length > 0 && (
        <div className="space-y-1 px-2">
          {tokenUsage.map((usage) => (
            <div 
              key={usage.agentId} 
              className="flex items-center justify-between text-[10px] py-1 px-2 bg-muted/30 rounded-lg"
            >
              <span className="text-muted-foreground">{usage.agentName}</span>
              <div className="flex items-center gap-2">
                <span className="tabular-nums">
                  {formatTokens(usage.inputTokens + usage.outputTokens)}
                </span>
                <span className="text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {formatCost(usage.estimatedCost)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Barra de progresso melhorada */}
      <div className="space-y-1.5">
        <div className="relative">
          <Progress value={getProgressPercentage()} className="h-2" />
          <div 
            className="absolute top-0 left-0 h-2 rounded-full bg-gradient-to-r from-primary/50 to-secondary/50 blur-sm transition-all"
            style={{ width: `${getProgressPercentage()}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span className="font-medium">{getProgressPercentage()}% completo</span>
          {multiAgentStep && (
            <span className="text-primary font-medium">
              Etapa {["researcher", "writer", "editor", "reviewer", "complete"].indexOf(multiAgentStep) + 1} de 5
            </span>
          )}
        </div>
      </div>

      {/* Sub-tarefas (se houver) */}
      {subTasks.length > 0 && (
        <div className="space-y-1 pt-2 border-t border-border/40">
          <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Sub-tarefas</p>
          {subTasks.map((task) => (
            <div 
              key={task.id} 
              className={cn(
                "flex items-center gap-2 py-1.5 px-2 rounded-lg transition-all text-xs",
                task.status === "running" && "bg-primary/5",
                task.status === "completed" && "opacity-60"
              )}
            >
              {task.status === "completed" && <CheckCircle2 className="h-3 w-3 text-primary" />}
              {task.status === "running" && <Loader2 className="h-3 w-3 text-primary animate-spin" />}
              {task.status === "pending" && <Circle className="h-3 w-3 text-muted-foreground/40" />}
              <span className={cn(
                task.status === "running" && "text-primary font-medium",
                task.status === "pending" && "text-muted-foreground/60"
              )}>
                {task.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Multi-agent pipeline visualization - Enhanced */}
      {multiAgentStep && (
        <div className="pt-3 border-t border-border/40">
          <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Pipeline de Geração</p>
          <div className="flex items-center gap-1 bg-muted/30 rounded-xl p-2">
            {["researcher", "writer", "editor", "reviewer"].map((agent, i) => {
              const isActive = agent === multiAgentStep;
              const isCompleted = ["researcher", "writer", "editor", "reviewer"].indexOf(agent) < 
                                 ["researcher", "writer", "editor", "reviewer"].indexOf(multiAgentStep);
              
              const agentConfig = {
                researcher: { icon: "🔍", label: "Pesquisador", color: "blue" },
                writer: { icon: "✍️", label: "Escritor", color: "violet" },
                editor: { icon: "📝", label: "Editor", color: "rose" },
                reviewer: { icon: "✅", label: "Revisor", color: "emerald" }
              };
              
              const config = agentConfig[agent as keyof typeof agentConfig];

              // Find token usage for this agent
              const agentUsage = tokenUsage.find(u => u.agentId === agent);
              
              return (
                <div key={agent} className="flex items-center flex-1">
                  <div 
                    className={cn(
                      "flex-1 flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg transition-all",
                      isActive && `bg-${config.color}-500/20 ring-1 ring-${config.color}-500/40`,
                      isActive && "bg-primary/15 ring-1 ring-primary/40 shadow-sm",
                      isCompleted && "bg-muted/50",
                      !isActive && !isCompleted && "opacity-40"
                    )}
                  >
                    <div className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center text-sm transition-all",
                      isActive && "bg-primary/20 animate-pulse",
                      isCompleted && "bg-primary/10"
                    )}>
                      {isCompleted ? (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      ) : isActive ? (
                        <Loader2 className="h-4 w-4 text-primary animate-spin" />
                      ) : (
                        <span>{config.icon}</span>
                      )}
                    </div>
                    <span className={cn(
                      "text-[9px] font-medium",
                      isActive && "text-primary",
                      isCompleted && "text-muted-foreground",
                      !isActive && !isCompleted && "text-muted-foreground/50"
                    )}>
                      {config.label}
                    </span>
                    {/* Token count per agent */}
                    {agentUsage && (
                      <span className="text-[8px] text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {formatTokens(agentUsage.inputTokens + agentUsage.outputTokens)}
                      </span>
                    )}
                  </div>
                  {i < 3 && (
                    <div className={cn(
                      "w-4 h-0.5 mx-0.5 rounded-full transition-all",
                      isCompleted ? "bg-primary/60" : "bg-border/60"
                    )} />
                  )}
                </div>
              );
            })}
          </div>
          {multiAgentDetails[multiAgentStep] && (
            <div className="mt-2 px-3 py-2 bg-muted/40 rounded-lg">
              <p className="text-[10px] text-muted-foreground text-center animate-fade-in">
                {multiAgentDetails[multiAgentStep]}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Thought Process (collapsible) */}
      {thoughtProcess.length > 0 && (
        <Collapsible open={isThoughtOpen} onOpenChange={setIsThoughtOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 w-full pt-2 border-t border-border/40 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
            {isThoughtOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            <MessageSquare className="h-3 w-3" />
            <span>Processo ({thoughtProcess.length})</span>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="space-y-1 pl-4 border-l border-primary/20">
              {thoughtProcess.map((thought, i) => (
                <p key={i} className="text-[10px] text-muted-foreground">
                  {thought}
                </p>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
};
