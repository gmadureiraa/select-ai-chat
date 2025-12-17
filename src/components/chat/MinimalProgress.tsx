import { Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProcessStep, MultiAgentStep } from "@/types/chat";
import { useState, useEffect, useRef } from "react";

interface MinimalProgressProps {
  currentStep: ProcessStep;
  multiAgentStep?: MultiAgentStep;
}

interface CompletedStep {
  id: string;
  text: string;
}

const getStepText = (currentStep: ProcessStep, multiAgentStep?: MultiAgentStep): string => {
  if (multiAgentStep) {
    const texts: Record<string, string> = {
      researcher: "Analisando contexto",
      writer: "Escrevendo rascunho",
      editor: "Refinando estilo",
      reviewer: "Revisão final",
      complete: "Finalizando",
      error: "Erro no processamento"
    };
    return texts[multiAgentStep] || "Processando";
  }
  
  const texts: Record<string, string> = {
    analyzing: "Analisando",
    analyzing_library: "Buscando referências",
    selecting: "Selecionando conteúdo",
    reviewing: "Preparando resposta",
    creating: "Gerando",
    generating_image: "Criando imagem",
    multi_agent: "Processando"
  };
  
  return texts[currentStep || ""] || "Pensando";
};

export const MinimalProgress = ({
  currentStep,
  multiAgentStep,
}: MinimalProgressProps) => {
  const [completedSteps, setCompletedSteps] = useState<CompletedStep[]>([]);
  const lastStepRef = useRef<string | null>(null);
  
  const currentText = getStepText(currentStep, multiAgentStep);
  const currentStepId = multiAgentStep || currentStep || "thinking";
  
  // Track step changes and accumulate completed steps
  useEffect(() => {
    if (currentStepId && currentStepId !== lastStepRef.current && lastStepRef.current) {
      // Previous step completed, add it to completed list
      const previousText = getStepText(
        lastStepRef.current as ProcessStep, 
        lastStepRef.current as MultiAgentStep
      );
      
      // Avoid duplicates
      setCompletedSteps(prev => {
        if (prev.some(s => s.id === lastStepRef.current)) return prev;
        return [...prev, { id: lastStepRef.current!, text: previousText }];
      });
    }
    lastStepRef.current = currentStepId;
  }, [currentStepId]);
  
  // Reset on unmount or when loading stops
  useEffect(() => {
    return () => {
      setCompletedSteps([]);
      lastStepRef.current = null;
    };
  }, []);

  return (
    <div className="flex items-start gap-3 py-4 px-1 animate-fade-in">
      <div className="flex flex-col gap-1.5 text-sm">
        {/* Completed steps */}
        {completedSteps.map((step, index) => (
          <div 
            key={step.id} 
            className="flex items-center gap-2 text-muted-foreground/50 animate-fade-in"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <Check className="h-3.5 w-3.5 text-muted-foreground/40" />
            <span className="font-normal">{step.text}</span>
          </div>
        ))}
        
        {/* Current step */}
        <div className="flex items-center gap-2 text-muted-foreground/70 animate-fade-in">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span className="font-normal">
            {currentText}
            <span className="animate-pulse">...</span>
          </span>
        </div>
      </div>
    </div>
  );
};
