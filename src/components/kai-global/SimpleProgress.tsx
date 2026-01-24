import { motion } from "framer-motion";
import { ProcessStep, MultiAgentStep } from "@/types/chat";
import { useState, useEffect } from "react";

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
  const [elapsedTime, setElapsedTime] = useState(0);

  // Track elapsed time
  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [currentStep, multiAgentStep]);

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
      className="flex items-center gap-2 text-muted-foreground py-2"
    >
      {/* Animated typing dots */}
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-primary"
            animate={{
              opacity: [0.3, 1, 0.3],
              scale: [0.8, 1, 0.8],
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              delay: i * 0.15,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      <span className="text-sm">{getMessage()}</span>

      {/* Show elapsed time after 5 seconds */}
      {elapsedTime >= 5 && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-xs text-muted-foreground/60 ml-auto"
        >
          {elapsedTime}s
        </motion.span>
      )}
    </motion.div>
  );
}
