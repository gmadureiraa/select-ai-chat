import { motion } from "framer-motion";
import { Loader2, Search, Database, CheckCircle2, AlertCircle } from "lucide-react";
import { KAIActionStatus } from "@/types/kaiActions";

interface ActionProgressIndicatorProps {
  status: KAIActionStatus;
  actionLabel?: string;
}

const STATUS_CONFIG: Record<
  KAIActionStatus,
  {
    icon: React.ElementType;
    label: string;
    color: string;
    animate: boolean;
  }
> = {
  idle: {
    icon: CheckCircle2,
    label: "Pronto",
    color: "text-muted-foreground",
    animate: false,
  },
  detecting: {
    icon: Search,
    label: "Analisando intenção...",
    color: "text-blue-500",
    animate: true,
  },
  analyzing: {
    icon: Search,
    label: "Analisando dados...",
    color: "text-blue-500",
    animate: true,
  },
  previewing: {
    icon: Loader2,
    label: "Preparando preview...",
    color: "text-amber-500",
    animate: true,
  },
  confirming: {
    icon: Loader2,
    label: "Aguardando confirmação...",
    color: "text-amber-500",
    animate: false,
  },
  executing: {
    icon: Database,
    label: "Executando ação...",
    color: "text-purple-500",
    animate: true,
  },
  completed: {
    icon: CheckCircle2,
    label: "Concluído!",
    color: "text-green-500",
    animate: false,
  },
  error: {
    icon: AlertCircle,
    label: "Erro ao processar",
    color: "text-destructive",
    animate: false,
  },
};

export function ActionProgressIndicator({
  status,
  actionLabel,
}: ActionProgressIndicatorProps) {
  if (status === "idle") return null;

  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg"
    >
      <Icon
        className={`h-4 w-4 ${config.color} ${
          config.animate ? "animate-spin" : ""
        }`}
      />
      <span className="text-sm text-muted-foreground">
        {actionLabel || config.label}
      </span>

      {/* Progress dots for animated states */}
      {config.animate && (
        <div className="flex gap-1 ml-auto">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className={`h-1.5 w-1.5 rounded-full ${config.color.replace(
                "text-",
                "bg-"
              )}`}
              animate={{
                opacity: [0.3, 1, 0.3],
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: i * 0.2,
              }}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}

/**
 * Inline progress indicator for chat messages
 */
export function InlineProgressIndicator({
  status,
}: {
  status: KAIActionStatus;
}) {
  if (status === "idle" || status === "completed") return null;

  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icon
        className={`h-3 w-3 ${config.color} ${
          config.animate ? "animate-spin" : ""
        }`}
      />
      <span>{config.label}</span>
    </div>
  );
}
