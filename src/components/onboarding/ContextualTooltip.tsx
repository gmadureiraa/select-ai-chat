import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "@/hooks/useOnboarding";
import { cn } from "@/lib/utils";

interface ContextualTooltipProps {
  id: string;
  title: string;
  description: string;
  position?: "top" | "bottom" | "left" | "right";
  className?: string;
  children: React.ReactNode;
  delay?: number;
}

export function ContextualTooltip({
  id,
  title,
  description,
  position = "bottom",
  className,
  children,
  delay = 1000,
}: ContextualTooltipProps) {
  const { isTooltipDismissed, dismissTooltip, hasCompletedOnboarding } = useOnboarding();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only show tooltip after onboarding is complete and not already dismissed
    if (hasCompletedOnboarding && !isTooltipDismissed(id)) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [id, hasCompletedOnboarding, isTooltipDismissed, delay]);

  const handleDismiss = () => {
    setIsVisible(false);
    dismissTooltip(id);
  };

  const handleDismissForever = () => {
    setIsVisible(false);
    dismissTooltip(id);
  };

  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  const arrowClasses = {
    top: "top-full left-1/2 -translate-x-1/2 border-t-primary/90 border-l-transparent border-r-transparent border-b-transparent",
    bottom: "bottom-full left-1/2 -translate-x-1/2 border-b-primary/90 border-l-transparent border-r-transparent border-t-transparent",
    left: "left-full top-1/2 -translate-y-1/2 border-l-primary/90 border-t-transparent border-b-transparent border-r-transparent",
    right: "right-full top-1/2 -translate-y-1/2 border-r-primary/90 border-t-transparent border-b-transparent border-l-transparent",
  };

  return (
    <div className={cn("relative inline-block", className)}>
      {children}
      
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "absolute z-50 w-64 p-3 rounded-xl bg-primary/90 text-primary-foreground shadow-lg",
              positionClasses[position]
            )}
          >
            {/* Arrow */}
            <div
              className={cn(
                "absolute w-0 h-0 border-[6px]",
                arrowClasses[position]
              )}
            />
            
            {/* Content */}
            <div className="flex items-start gap-2">
              <Lightbulb className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm mb-1">{title}</p>
                <p className="text-xs opacity-90">{description}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
                className="h-5 w-5 p-0 hover:bg-primary-foreground/10 -mr-1 -mt-1"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            
            {/* Actions */}
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-primary-foreground/20">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
                className="h-7 text-xs hover:bg-primary-foreground/10 flex-1"
              >
                Entendi
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismissForever}
                className="h-7 text-xs hover:bg-primary-foreground/10 text-primary-foreground/70"
              >
                Não mostrar
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
