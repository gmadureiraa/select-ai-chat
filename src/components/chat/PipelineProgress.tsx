import { motion } from "framer-motion";
import { Check, Loader2, Circle, BookOpen, PenTool, CheckCircle2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

export type PipelineStage = 
  | "context" 
  | "writing" 
  | "validating" 
  | "repairing"
  | "reviewing" 
  | "complete"
  | "error";

interface PipelineProgressProps {
  currentStage: PipelineStage;
  className?: string;
  showElapsedTime?: boolean;
}

interface StageConfig {
  id: PipelineStage;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STAGES: StageConfig[] = [
  { id: "context", label: "Carregando contexto", icon: BookOpen },
  { id: "writing", label: "Escrevendo", icon: PenTool },
  { id: "validating", label: "Validando", icon: CheckCircle2 },
  { id: "reviewing", label: "Revisando", icon: Sparkles },
];

const STAGE_ORDER: Record<PipelineStage, number> = {
  context: 0,
  writing: 1,
  validating: 2,
  repairing: 2.5, // Same visual position as validating
  reviewing: 3,
  complete: 4,
  error: -1,
};

export function PipelineProgress({ 
  currentStage, 
  className,
  showElapsedTime = true,
}: PipelineProgressProps) {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [stageStartTime, setStageStartTime] = useState<Record<string, number>>({});

  // Track elapsed time
  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Track stage start times
  useEffect(() => {
    if (!stageStartTime[currentStage]) {
      setStageStartTime(prev => ({
        ...prev,
        [currentStage]: Date.now(),
      }));
    }
  }, [currentStage, stageStartTime]);

  const currentStageOrder = STAGE_ORDER[currentStage] ?? 0;

  const getStageStatus = (stage: StageConfig): "completed" | "current" | "pending" => {
    const stageOrder = STAGE_ORDER[stage.id];
    
    if (currentStage === "complete") return "completed";
    if (currentStage === "error") return stageOrder < currentStageOrder ? "completed" : "pending";
    
    if (stageOrder < currentStageOrder) return "completed";
    if (stageOrder === currentStageOrder || 
        (stage.id === "validating" && currentStage === "repairing")) return "current";
    return "pending";
  };

  // Show repair status inside validating if applicable
  const getCurrentLabel = (stage: StageConfig): string => {
    if (stage.id === "validating" && currentStage === "repairing") {
      return "Corrigindo...";
    }
    return stage.label;
  };

  if (currentStage === "complete") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn(
          "flex items-center gap-2 text-sm text-green-600 dark:text-green-400",
          className
        )}
      >
        <Check className="h-4 w-4" />
        <span>Pronto!</span>
        {showElapsedTime && elapsedTime > 0 && (
          <span className="text-xs text-muted-foreground">({elapsedTime}s)</span>
        )}
      </motion.div>
    );
  }

  if (currentStage === "error") {
    return null; // Error is handled by the chat component
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("space-y-2", className)}
    >
      {/* Progress steps */}
      <div className="flex flex-col gap-1">
        {STAGES.map((stage) => {
          const status = getStageStatus(stage);
          const Icon = stage.icon;
          const label = getCurrentLabel(stage);
          
          return (
            <motion.div
              key={stage.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: STAGE_ORDER[stage.id] * 0.1 }}
              className={cn(
                "flex items-center gap-2.5 text-sm transition-colors duration-200",
                status === "completed" && "text-muted-foreground",
                status === "current" && "text-foreground",
                status === "pending" && "text-muted-foreground/40"
              )}
            >
              {/* Status indicator */}
              <div className="relative flex-shrink-0 w-5 h-5">
                {status === "completed" && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="flex items-center justify-center w-full h-full rounded-full bg-green-500/20 text-green-600 dark:text-green-400"
                  >
                    <Check className="h-3 w-3" />
                  </motion.div>
                )}
                {status === "current" && (
                  <div className="flex items-center justify-center w-full h-full rounded-full bg-primary/20">
                    <Loader2 className="h-3 w-3 text-primary animate-spin" />
                  </div>
                )}
                {status === "pending" && (
                  <div className="flex items-center justify-center w-full h-full">
                    <Circle className="h-3 w-3 text-muted-foreground/30" />
                  </div>
                )}
              </div>

              {/* Stage label */}
              <span className={cn(
                "text-xs",
                status === "current" && "font-medium"
              )}>
                {label}
                {status === "current" && "..."}
              </span>
            </motion.div>
          );
        })}
      </div>

      {/* Elapsed time */}
      {showElapsedTime && elapsedTime >= 3 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-xs text-muted-foreground/60 pl-7"
        >
          {elapsedTime}s
        </motion.div>
      )}
    </motion.div>
  );
}

/**
 * Simple inline progress indicator (alternative to full pipeline view)
 */
interface SimpleStageIndicatorProps {
  stage: PipelineStage;
  className?: string;
}

export function SimpleStageIndicator({ stage, className }: SimpleStageIndicatorProps) {
  const [dots, setDots] = useState("");

  useEffect(() => {
    if (stage === "complete" || stage === "error") return;
    
    const interval = setInterval(() => {
      setDots(prev => (prev.length >= 3 ? "" : prev + "."));
    }, 400);

    return () => clearInterval(interval);
  }, [stage]);

  const getLabel = (): string => {
    switch (stage) {
      case "context": return "Carregando contexto";
      case "writing": return "Escrevendo";
      case "validating": return "Validando";
      case "repairing": return "Corrigindo";
      case "reviewing": return "Revisando";
      case "complete": return "Pronto!";
      case "error": return "Erro";
      default: return "Processando";
    }
  };

  return (
    <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
      {stage !== "complete" && stage !== "error" && (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
      )}
      {stage === "complete" && (
        <Check className="h-3.5 w-3.5 text-green-500" />
      )}
      <span>
        {getLabel()}
        {stage !== "complete" && stage !== "error" && dots}
      </span>
    </div>
  );
}
