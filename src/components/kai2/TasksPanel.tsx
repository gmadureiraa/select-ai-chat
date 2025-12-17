import { motion, AnimatePresence } from "framer-motion";
import { Check, Circle, Loader2, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { Task } from "@/config/contextualTasks";
import { cn } from "@/lib/utils";

interface TasksPanelProps {
  tasks: Task[];
  isActive: boolean;
  className?: string;
  collapsible?: boolean;
}

export function TasksPanel({ tasks, isActive, className, collapsible = true }: TasksPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!isActive || tasks.length === 0) return null;

  const completedCount = tasks.filter(t => t.status === "completed").length;
  const hasError = tasks.some(t => t.status === "error");
  const allComplete = completedCount === tasks.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        "rounded-lg border border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div 
        className={cn(
          "flex items-center justify-between px-4 py-3 border-b border-border/30",
          collapsible && "cursor-pointer hover:bg-muted/30 transition-colors"
        )}
        onClick={() => collapsible && setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">Tasks</span>
          <span className="text-xs text-muted-foreground">
            {completedCount}/{tasks.length}
          </span>
          {allComplete && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="text-xs text-green-500 font-medium"
            >
              Completo
            </motion.span>
          )}
          {hasError && (
            <span className="text-xs text-destructive font-medium">Erro</span>
          )}
        </div>
        {collapsible && (
          <button className="text-muted-foreground hover:text-foreground transition-colors">
            {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        )}
      </div>

      {/* Tasks List */}
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-3 space-y-1">
              {tasks.map((task, index) => (
                <TaskItem key={task.id} task={task} index={index} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

interface TaskItemProps {
  task: Task;
  index: number;
}

function TaskItem({ task, index }: TaskItemProps) {
  const getStatusIcon = () => {
    switch (task.status) {
      case "completed":
        return (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="h-4 w-4 rounded-full bg-green-500 flex items-center justify-center"
          >
            <Check className="h-2.5 w-2.5 text-white" />
          </motion.div>
        );
      case "running":
        return (
          <div className="h-4 w-4 relative">
            <Loader2 className="h-4 w-4 text-primary animate-spin" />
          </div>
        );
      case "error":
        return (
          <div className="h-4 w-4 rounded-full bg-destructive flex items-center justify-center">
            <AlertCircle className="h-2.5 w-2.5 text-white" />
          </div>
        );
      default:
        return (
          <Circle className="h-4 w-4 text-muted-foreground/50" />
        );
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        "flex items-center gap-3 py-2 px-2 rounded-md transition-colors",
        task.status === "running" && "bg-primary/5",
        task.status === "error" && "bg-destructive/5"
      )}
    >
      {getStatusIcon()}
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-sm truncate",
          task.status === "completed" && "text-muted-foreground",
          task.status === "running" && "text-foreground font-medium",
          task.status === "pending" && "text-muted-foreground/70",
          task.status === "error" && "text-destructive"
        )}>
          {task.label}
        </p>
        {task.detail && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {task.detail}
          </p>
        )}
      </div>
      {task.status === "running" && (
        <motion.div
          className="h-1 w-8 bg-primary/20 rounded-full overflow-hidden"
        >
          <motion.div
            className="h-full bg-primary"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </motion.div>
      )}
    </motion.div>
  );
}

// Compact version for inline use
export function TasksCompact({ tasks, isActive }: { tasks: Task[]; isActive: boolean }) {
  if (!isActive || tasks.length === 0) return null;

  const currentTask = tasks.find(t => t.status === "running");
  const completedCount = tasks.filter(t => t.status === "completed").length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center gap-2 text-sm text-muted-foreground"
    >
      <Loader2 className="h-3 w-3 animate-spin text-primary" />
      <span>{currentTask?.label || "Processando..."}</span>
      <span className="text-xs">({completedCount}/{tasks.length})</span>
    </motion.div>
  );
}
