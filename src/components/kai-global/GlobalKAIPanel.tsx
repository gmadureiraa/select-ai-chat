import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface GlobalKAIPanelProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  selectedClientId?: string | null;
  selectedClientName?: string;
}

export function GlobalKAIPanel({
  isOpen,
  onClose,
  children,
  className,
  selectedClientId,
  selectedClientName,
}: GlobalKAIPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when panel is open on mobile
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop overlay - minimal */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel - Clean, minimal design */}
          <motion.div
            ref={panelRef}
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ 
              type: "spring", 
              damping: 30, 
              stiffness: 350,
              mass: 0.8
            }}
            className={cn(
              "fixed right-0 top-0 z-50",
              "w-full sm:w-[400px] lg:w-[440px]",
              "h-screen max-h-screen",
              "bg-background border-l border-border",
              "flex flex-col overflow-hidden",
              className
            )}
          >
            {/* Minimal Header */}
            <div className="flex items-center justify-between h-14 px-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-accent">
                  <Sparkles className="h-4 w-4 text-sidebar-accent-foreground" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">kAI</span>
                  {selectedClientName && (
                    <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {selectedClientName}
                    </span>
                  )}
                </div>
              </div>
              
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
