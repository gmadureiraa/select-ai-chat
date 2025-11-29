import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { ProcessStep } from "@/types/chat";
import { cn } from "@/lib/utils";

interface AutonomousProgressProps {
  currentStep: ProcessStep;
}

const steps = [
  { key: "analyzing", label: "Analisando pergunta", description: "Identificando informações necessárias" },
  { key: "reviewing", label: "Carregando documentos", description: "Lendo informações selecionadas" },
  { key: "creating", label: "Criando resposta", description: "Gerando conteúdo com base nos documentos" },
];

export const AutonomousProgress = ({ currentStep }: AutonomousProgressProps) => {
  const getCurrentStepIndex = () => {
    if (!currentStep) return -1;
    return steps.findIndex(s => s.key === currentStep);
  };

  const currentIndex = getCurrentStepIndex();

  return (
    <div className="space-y-4 p-6 bg-card/50 backdrop-blur-sm border border-primary/10 rounded-xl">
      <div className="flex items-center gap-2 text-sm font-medium text-primary">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Trabalhando...</span>
      </div>
      
      <div className="space-y-3">
        {steps.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isPending = index > currentIndex;

          return (
            <div
              key={step.key}
              className={cn(
                "flex items-start gap-3 transition-all duration-300",
                isCurrent && "scale-105",
                isPending && "opacity-40"
              )}
            >
              <div className="flex-shrink-0 mt-0.5">
                {isCompleted && (
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                )}
                {isCurrent && (
                  <Loader2 className="h-5 w-5 text-primary animate-spin" />
                )}
                {isPending && (
                  <Circle className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-sm font-medium transition-colors",
                  isCurrent ? "text-primary" : isCompleted ? "text-foreground" : "text-muted-foreground"
                )}>
                  {step.label}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
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
