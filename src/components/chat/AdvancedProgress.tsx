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
    <div className="space-y-4 p-4 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent backdrop-blur-sm">
      {/* Header com status principal */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/30 rounded-full blur-md animate-pulse" />
            <div className="relative p-2.5 rounded-full bg-primary/20 border border-primary/30">
              <Icon className="h-5 w-5 text-primary animate-pulse" />
            </div>
          </div>
          <div>
            <p className="text-sm font-medium">{getCurrentStepLabel()}</p>
            {isAutonomous && (
              <Badge variant="outline" className="text-[10px] bg-amber-500/20 border-amber-500/40 text-amber-600 mt-1">
                <Zap className="h-2.5 w-2.5 mr-1" />
                Modo Autônomo
              </Badge>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{formatTime(elapsedTime)}</span>
          </div>
          {estimatedTimeRemaining && (
            <span className="text-primary">~{formatTime(estimatedTimeRemaining)} restante</span>
          )}
        </div>
      </div>

      {/* Barra de progresso */}
      <div className="space-y-1.5">
        <Progress value={getProgressPercentage()} className="h-1.5" />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>{getProgressPercentage()}% completo</span>
          {multiAgentStep && (
            <span>Etapa {["researcher", "writer", "editor", "reviewer", "complete"].indexOf(multiAgentStep) + 1}/5</span>
          )}
        </div>
      </div>

      {/* Sub-tarefas (se houver) */}
      {subTasks.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-border/30">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Sub-tarefas</p>
          {subTasks.map((task) => (
            <div 
              key={task.id} 
              className={cn(
                "flex items-center gap-2 p-2 rounded-lg transition-all",
                task.status === "running" && "bg-primary/10",
                task.status === "completed" && "bg-muted/30",
                task.status === "error" && "bg-destructive/10"
              )}
            >
              <div className="flex-shrink-0">
                {task.status === "completed" && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
                {task.status === "running" && <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />}
                {task.status === "pending" && <Circle className="h-3.5 w-3.5 text-muted-foreground/50" />}
                {task.status === "error" && <Circle className="h-3.5 w-3.5 text-destructive" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-xs",
                  task.status === "running" && "text-primary font-medium",
                  task.status === "completed" && "text-muted-foreground",
                  task.status === "pending" && "text-muted-foreground/60"
                )}>
                  {task.label}
                </p>
                {task.description && task.status === "running" && (
                  <p className="text-[10px] text-muted-foreground truncate">{task.description}</p>
                )}
              </div>
              {task.duration && task.status === "completed" && (
                <span className="text-[10px] text-muted-foreground">{task.duration}ms</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Multi-agent details */}
      {multiAgentStep && Object.keys(multiAgentDetails).length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-border/30">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Pipeline Multi-Agente</p>
          {["researcher", "writer", "editor", "reviewer"].map((agent) => {
            const detail = multiAgentDetails[agent];
            const isActive = agent === multiAgentStep;
            const isCompleted = ["researcher", "writer", "editor", "reviewer"].indexOf(agent) < 
                               ["researcher", "writer", "editor", "reviewer"].indexOf(multiAgentStep);
            
            return (
              <div 
                key={agent}
                className={cn(
                  "flex items-center gap-2 p-2 rounded-lg transition-all",
                  isActive && "bg-primary/10",
                  isCompleted && "bg-muted/30"
                )}
              >
                {isCompleted && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
                {isActive && <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />}
                {!isCompleted && !isActive && <Circle className="h-3.5 w-3.5 text-muted-foreground/50" />}
                <span className={cn(
                  "text-xs capitalize",
                  isActive && "text-primary font-medium",
                  isCompleted && "text-muted-foreground"
                )}>
                  {agent === "researcher" && "🔍 Pesquisador"}
                  {agent === "writer" && "✍️ Escritor"}
                  {agent === "editor" && "📝 Editor de Estilo"}
                  {agent === "reviewer" && "✅ Revisor"}
                </span>
                {detail && isActive && (
                  <span className="text-[10px] text-muted-foreground truncate ml-2">{detail}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Thought Process (collapsible) */}
      {thoughtProcess.length > 0 && (
        <Collapsible open={isThoughtOpen} onOpenChange={setIsThoughtOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 w-full pt-2 border-t border-border/30 text-xs text-muted-foreground hover:text-foreground transition-colors">
            {isThoughtOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            <MessageSquare className="h-3 w-3" />
            <span>Processo de Pensamento ({thoughtProcess.length} etapas)</span>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="space-y-1.5 pl-5 border-l-2 border-primary/20">
              {thoughtProcess.map((thought, i) => (
                <p key={i} className="text-[11px] text-muted-foreground">
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
