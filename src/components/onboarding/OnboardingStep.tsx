import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface OnboardingStepProps {
  title: string;
  description: string;
  children?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export function OnboardingStep({
  title,
  description,
  children,
  icon,
  className,
}: OnboardingStepProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className={cn("flex flex-col items-center text-center", className)}
    >
      {icon && (
        <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6">
          {icon}
        </div>
      )}
      
      <h2 className="text-2xl font-semibold text-foreground mb-3">{title}</h2>
      <p className="text-muted-foreground text-base max-w-md mb-6">{description}</p>
      
      {children && <div className="w-full">{children}</div>}
    </motion.div>
  );
}
