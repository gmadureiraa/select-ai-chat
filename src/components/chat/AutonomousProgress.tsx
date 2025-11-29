import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { ProcessStep } from "@/types/chat";
import { cn } from "@/lib/utils";

interface AutonomousProgressProps {
  currentStep: ProcessStep;
}

const steps = [
  { key: "analyzing", label: "Analisando demanda", description: "Entendendo o que você precisa" },
  { key: "reviewing", label: "Revisando contexto", description: "Consultando informações do cliente" },
  { key: "creating", label: "Criando conteúdo", description: "Executando tarefa com base nas regras" },
];

export const AutonomousProgress = ({ currentStep }: AutonomousProgressProps) => {
  const getCurrentStepIndex = () => {
    if (!currentStep) return -1;
    return steps.findIndex(s => s.key === currentStep);
  };

  const currentIndex = getCurrentStepIndex();

  return (
    <div className="space-y-3 md:space-y-4 p-4 md:p-6 bg-muted/30 backdrop-blur-sm border border-border rounded-xl max-w-2xl mx-auto animate-fade-in">
      <div className="flex items-center gap-2 text-xs md:text-sm font-medium text-primary">
        <Loader2 className="h-3.5 w-3.5 md:h-4 md:w-4 animate-spin" />
        <span>Trabalhando...</span>
      </div>
      
      <div className="space-y-2 md:space-y-3">
        {steps.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isPending = index > currentIndex;

          return (
            <div
              key={step.key}
              className={cn(
                "flex items-start gap-2 md:gap-3 transition-all duration-300",
                isCurrent && "scale-[1.02]",
                isPending && "opacity-40"
              )}
            >
              <div className="flex-shrink-0 mt-0.5">
                {isCompleted && (
                  <CheckCircle2 className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                )}
                {isCurrent && (
                  <Loader2 className="h-4 w-4 md:h-5 md:w-5 text-primary animate-spin" />
                )}
                {isPending && (
                  <Circle className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground/50" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-xs md:text-sm font-medium transition-colors",
                  isCurrent ? "text-primary" : isCompleted ? "text-foreground" : "text-muted-foreground"
                )}>
                  {step.label}
                </p>
                <p className="text-[10px] md:text-xs text-muted-foreground/80 mt-0.5 leading-tight">
                  {step.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};