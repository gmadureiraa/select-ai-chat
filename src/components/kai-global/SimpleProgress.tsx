import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { ProcessStep, MultiAgentStep } from "@/types/chat";

interface SimpleProgressProps {
  currentStep?: ProcessStep;
  multiAgentStep?: MultiAgentStep;
}

const STEP_MESSAGES: Record<string, string> = {
  // Basic steps
  routing: "Analisando...",
  thinking: "Pensando...",
  generating: "Gerando...",
  searching: "Buscando informações...",
  analyzing: "Analisando dados...",
  
  // Multi-agent steps (simplified)
  researcher: "Pesquisando...",
  writer: "Criando conteúdo...",
  editor: "Refinando...",
  reviewer: "Finalizando...",
  multi_agent: "Criando conteúdo...",
  
  // Completion
  complete: "Pronto!",
};

export function SimpleProgress({ currentStep, multiAgentStep }: SimpleProgressProps) {
  // Determine message based on step
  const getMessage = (): string => {
    if (multiAgentStep && multiAgentStep !== "complete" && multiAgentStep !== "error") {
      return STEP_MESSAGES[multiAgentStep] || "Processando...";
    }
    if (currentStep) {
      return STEP_MESSAGES[currentStep] || "Processando...";
    }
    return "Pensando...";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 text-muted-foreground py-3"
    >
      <Loader2 className="h-4 w-4 animate-spin text-primary" />
      <span className="text-sm">{getMessage()}</span>
    </motion.div>
  );
}
