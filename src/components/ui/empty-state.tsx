import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  variant?: "default" | "chart" | "table" | "chat";
  className?: string;
}

// SVG illustrations for different variants
const illustrations = {
  default: (
    <svg viewBox="0 0 200 200" className="w-full h-full" fill="none">
      <circle cx="100" cy="100" r="80" className="fill-muted/30" />
      <circle cx="100" cy="100" r="60" className="fill-muted/20" />
      <circle cx="100" cy="100" r="40" className="fill-muted/10" />
      <path
        d="M70 100 L90 120 L130 80"
        className="stroke-primary"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  ),
  chart: (
    <svg viewBox="0 0 200 200" className="w-full h-full" fill="none">
      <rect x="20" y="120" width="25" height="60" rx="4" className="fill-muted/40" />
      <rect x="55" y="90" width="25" height="90" rx="4" className="fill-muted/50" />
      <rect x="90" y="60" width="25" height="120" rx="4" className="fill-primary/30" />
      <rect x="125" y="100" width="25" height="80" rx="4" className="fill-muted/50" />
      <rect x="160" y="80" width="25" height="100" rx="4" className="fill-muted/40" />
      <path
        d="M30 110 Q70 70 100 50 T170 70"
        className="stroke-primary"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        strokeDasharray="6 4"
      />
      <circle cx="100" cy="50" r="6" className="fill-primary" />
    </svg>
  ),
  table: (
    <svg viewBox="0 0 200 200" className="w-full h-full" fill="none">
      <rect x="30" y="50" width="140" height="100" rx="8" className="fill-muted/20 stroke-border" strokeWidth="2" />
      <line x1="30" y1="80" x2="170" y2="80" className="stroke-border" strokeWidth="2" />
      <line x1="30" y1="110" x2="170" y2="110" className="stroke-muted/50" strokeWidth="1" strokeDasharray="4 2" />
      <line x1="30" y1="130" x2="170" y2="130" className="stroke-muted/50" strokeWidth="1" strokeDasharray="4 2" />
      <rect x="40" y="60" width="30" height="10" rx="2" className="fill-muted/50" />
      <rect x="80" y="60" width="40" height="10" rx="2" className="fill-muted/50" />
      <rect x="130" y="60" width="30" height="10" rx="2" className="fill-muted/50" />
      <circle cx="100" cy="120" r="15" className="fill-primary/20" />
      <path d="M95 120 L100 125 L108 115" className="stroke-primary" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  chat: (
    <svg viewBox="0 0 200 200" className="w-full h-full" fill="none">
      <rect x="40" y="50" width="100" height="60" rx="12" className="fill-muted/30" />
      <rect x="60" y="130" width="100" height="40" rx="12" className="fill-primary/20" />
      <circle cx="60" cy="70" r="4" className="fill-muted-foreground/40" />
      <circle cx="80" cy="70" r="4" className="fill-muted-foreground/40" />
      <circle cx="100" cy="70" r="4" className="fill-muted-foreground/40" />
      <rect x="55" y="85" width="60" height="8" rx="2" className="fill-muted/50" />
      <rect x="75" y="140" width="70" height="8" rx="2" className="fill-primary/40" />
      <rect x="85" y="152" width="50" height="6" rx="2" className="fill-primary/30" />
      <path
        d="M180 100 L175 90 L170 100"
        className="stroke-primary"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="175" cy="100" r="20" className="stroke-primary/30" strokeWidth="2" fill="none" strokeDasharray="4 2" />
    </svg>
  ),
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = "default",
  className,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={cn(
        "flex flex-col items-center justify-center py-12 px-6 text-center",
        className
      )}
    >
      <motion.div
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
        className="w-32 h-32 mb-6 opacity-80"
      >
        {illustrations[variant]}
      </motion.div>

      {Icon && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.3, delay: 0.2, type: "spring" }}
          className="mb-4 p-3 rounded-xl bg-primary/10"
        >
          <Icon className="h-6 w-6 text-primary" />
        </motion.div>
      )}

      <motion.h3
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.25 }}
        className="text-lg font-semibold mb-2"
      >
        {title}
      </motion.h3>

      {description && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          className="text-sm text-muted-foreground max-w-sm mb-4"
        >
          {description}
        </motion.p>
      )}

      {action && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.35 }}
        >
          {action}
        </motion.div>
      )}
    </motion.div>
  );
}
