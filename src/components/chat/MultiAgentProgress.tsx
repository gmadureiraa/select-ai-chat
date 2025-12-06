import { CheckCircle2, Circle, Loader2, Search, PenTool, Sparkles, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export type MultiAgentStep = "researcher" | "writer" | "editor" | "reviewer" | "complete" | "error" | null;

interface MultiAgentProgressProps {
  currentStep: MultiAgentStep;
  stepDetails?: Record<string, string>;
}

const AGENT_STEPS = [
  { 
    key: "researcher", 
    label: "Pesquisador", 
    description: "Selecionando materiais relevantes da biblioteca",
    icon: Search,
    model: "Gemini Flash"
  },
  { 
    key: "writer", 
    label: "Escritor", 
    description: "Criando primeira versão do conteúdo",
    icon: PenTool,
    model: "Gemini Pro"
  },
  { 
    key: "editor", 
    label: "Editor de Estilo", 
    description: "Refinando tom de voz e linguagem",
    icon: Sparkles,
    model: "Gemini Pro"
  },
  { 
    key: "reviewer", 
    label: "Revisor Final", 
    description: "Checklist de qualidade e polish",
    icon: CheckCheck,
    model: "Gemini Flash"
  },
];

export const MultiAgentProgress = ({ currentStep, stepDetails = {} }: MultiAgentProgressProps) => {
  const getCurrentStepIndex = () => {
    if (!currentStep || currentStep === "error") return -1;
    if (currentStep === "complete") return AGENT_STEPS.length;
    return AGENT_STEPS.findIndex(s => s.key === currentStep);
  };

  const currentIndex = getCurrentStepIndex();

  return (
    <div className="space-y-4 p-4 bg-gradient-to-br from-primary/5 to-secondary/5 border border-primary/20 rounded-xl">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <Loader2 className="h-4 w-4 text-primary animate-spin" />
          </div>
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full animate-pulse" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-foreground">Pipeline Multi-Agente</h4>
          <p className="text-xs text-muted-foreground">4 agentes especializados trabalhando</p>
        </div>
      </div>

      {/* Agent Steps */}
      <div className="space-y-2">
        {AGENT_STEPS.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = step.key === currentStep;
          const isPending = index > currentIndex;
          const Icon = step.icon;
          const detail = stepDetails[step.key];

          return (
            <div
              key={step.key}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg transition-all duration-300",
                isCurrent && "bg-primary/10 border border-primary/30 shadow-sm",
                isCompleted && "bg-muted/50",
                isPending && "opacity-40"
              )}
            >
              <div className="flex-shrink-0 relative">
                {isCompleted && (
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  </div>
                )}
                {isCurrent && (
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                    <Loader2 className="h-4 w-4 text-primary animate-spin" />
                  </div>
                )}
                {isPending && (
                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                    <Circle className="h-4 w-4 text-muted-foreground/50" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Icon className={cn(
                    "h-3.5 w-3.5",
                    isCurrent ? "text-primary" : isCompleted ? "text-primary/70" : "text-muted-foreground"
                  )} />
                  <span className={cn(
                    "text-sm font-medium",
                    isCurrent ? "text-primary" : isCompleted ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {step.label}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    {step.model}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {detail || step.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-muted rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-500"
          style={{ width: `${Math.min((currentIndex + 1) / AGENT_STEPS.length * 100, 100)}%` }}
        />
      </div>
    </div>
  );
};
