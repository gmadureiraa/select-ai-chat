import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProcessStep, MultiAgentStep } from "@/types/chat";

interface MinimalProgressProps {
  currentStep: ProcessStep;
  multiAgentStep?: MultiAgentStep;
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
  const text = getStepText(currentStep, multiAgentStep);

  return (
    <div className="flex items-center gap-3 py-4 px-1 animate-fade-in">
      <div className="relative">
        <Loader2 className="h-4 w-4 text-muted-foreground/60 animate-spin" />
      </div>
      <span className="text-sm text-muted-foreground/70 font-normal">
        {text}
        <span className="animate-pulse">...</span>
      </span>
    </div>
  );
};
