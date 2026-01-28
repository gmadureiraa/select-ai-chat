import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import kaleidosKaiLogo from "@/assets/kaleidos-kai-logo.png";

interface FloatingKAIButtonProps {
  isOpen: boolean;
  onClick: () => void;
  hasNotifications?: boolean;
  notificationCount?: number;
  className?: string;
}

export function FloatingKAIButton({
  isOpen,
  onClick,
  hasNotifications = false,
  notificationCount = 0,
  className,
}: FloatingKAIButtonProps) {
  return (
    <motion.div
      className={cn(
        "fixed bottom-6 right-6 z-50 pb-[env(safe-area-inset-bottom)]",
        className
      )}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ 
        type: "spring", 
        stiffness: 260, 
        damping: 20,
        delay: 0.2 
      }}
    >
      <Button
        onClick={onClick}
        size="icon"
className={cn(
          "relative h-14 w-14 min-h-14 min-w-14 p-0 rounded-full shadow-lg transition-all duration-300",
          "bg-primary hover:bg-primary/90",
          "hover:shadow-xl hover:scale-105",
          "focus:ring-2 focus:ring-primary/50 focus:ring-offset-2",
          isOpen && "rotate-180"
        )}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -180, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 180, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <X className="h-6 w-6 text-primary-foreground" />
            </motion.div>
          ) : (
            <motion.div
              key="open"
              initial={{ rotate: 180, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -180, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <img 
                src={kaleidosKaiLogo} 
                alt="kAI" 
                className="h-8 w-8 object-contain"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Notification badge */}
        <AnimatePresence>
          {hasNotifications && notificationCount > 0 && !isOpen && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className={cn(
                "absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center",
                "rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground"
              )}
            >
              {notificationCount > 9 ? "9+" : notificationCount}
            </motion.span>
          )}
        </AnimatePresence>

        {/* Pulse animation when has notifications */}
        {hasNotifications && !isOpen && (
          <span className="absolute inset-0 rounded-full animate-ping bg-primary/30" />
        )}
      </Button>
    </motion.div>
  );
}
