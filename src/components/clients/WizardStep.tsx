import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface WizardStepProps {
  children: ReactNode;
  isActive: boolean;
  direction?: "forward" | "backward";
}

export function WizardStep({ children, isActive, direction = "forward" }: WizardStepProps) {
  return (
    <AnimatePresence mode="wait">
      {isActive && (
        <motion.div
          initial={{ 
            opacity: 0, 
            x: direction === "forward" ? 20 : -20 
          }}
          animate={{ 
            opacity: 1, 
            x: 0 
          }}
          exit={{ 
            opacity: 0, 
            x: direction === "forward" ? -20 : 20 
          }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="min-h-[300px]"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface StepSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function StepSection({ title, description, children, className }: StepSectionProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <div>
        <h3 className="text-lg font-medium">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}
