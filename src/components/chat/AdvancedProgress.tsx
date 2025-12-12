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
  MessageSquare
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

interface AdvancedProgressProps {
  currentStep: ProcessStep;
  multiAgentStep?: MultiAgentStep;
  multiAgentDetails?: Record<string, string>;
  isAutonomous?: boolean;
  thoughtProcess?: string[];
  subTasks?: SubTask[];
  estimatedTimeRemaining?: number;
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

export const AdvancedProgress = ({
  currentStep,
  multiAgentStep,
  multiAgentDetails = {},
  isAutonomous = false,
  thoughtProcess = [],
  subTasks = [],
  estimatedTimeRemaining,
}: AdvancedProgressProps) => {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isThoughtOpen, setIsThoughtOpen] = useState(false);

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
    <div className="space-y-3 p-4 rounded-2xl border border-border/60 bg-card/50 backdrop-blur-sm">
      {/* Header com status principal */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 rounded-xl blur-lg animate-pulse" />
            <div className="relative p-2 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
              <Icon className="h-4 w-4 text-primary" />
            </div>
          </div>
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-foreground">{getCurrentStepLabel()}</p>
            {isAutonomous && (
              <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-amber-500/10 border-amber-500/30 text-amber-600">
                <Zap className="h-2 w-2 mr-0.5" />
                Multi-Agente
              </Badge>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span className="tabular-nums">{formatTime(elapsedTime)}</span>
        </div>
      </div>

      {/* Barra de progresso */}
      <div className="space-y-1">
        <Progress value={getProgressPercentage()} className="h-1" />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>{getProgressPercentage()}%</span>
          {multiAgentStep && (
            <span className="text-primary/80">
              {["researcher", "writer", "editor", "reviewer", "complete"].indexOf(multiAgentStep) + 1}/5
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

      {/* Multi-agent pipeline visualization */}
      {multiAgentStep && Object.keys(multiAgentDetails).length > 0 && (
        <div className="pt-2 border-t border-border/40">
          <div className="flex items-center gap-1">
            {["researcher", "writer", "editor", "reviewer"].map((agent, i) => {
              const isActive = agent === multiAgentStep;
              const isCompleted = ["researcher", "writer", "editor", "reviewer"].indexOf(agent) < 
                                 ["researcher", "writer", "editor", "reviewer"].indexOf(multiAgentStep);
              
              const icons = {
                researcher: "🔍",
                writer: "✍️",
                editor: "📝",
                reviewer: "✅"
              };
              
              return (
                <div key={agent} className="flex items-center flex-1">
                  <div 
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] transition-all",
                      isActive && "bg-primary/10 text-primary font-medium",
                      isCompleted && "bg-muted/50 text-muted-foreground",
                      !isActive && !isCompleted && "text-muted-foreground/50"
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : isActive ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <span>{icons[agent as keyof typeof icons]}</span>
                    )}
                    <span className="hidden sm:inline capitalize">
                      {agent === "researcher" && "Pesq."}
                      {agent === "writer" && "Escr."}
                      {agent === "editor" && "Edit."}
                      {agent === "reviewer" && "Rev."}
                    </span>
                  </div>
                  {i < 3 && (
                    <div className={cn(
                      "w-3 h-px mx-0.5",
                      isCompleted ? "bg-primary/50" : "bg-border"
                    )} />
                  )}
                </div>
              );
            })}
          </div>
          {multiAgentDetails[multiAgentStep] && (
            <p className="text-[10px] text-muted-foreground text-center mt-2 animate-fade-in">
              {multiAgentDetails[multiAgentStep]}
            </p>
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
