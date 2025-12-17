import { useState, useCallback } from "react";
import { Task, TaskStatus, ContextType, getTasksForContext } from "@/config/contextualTasks";

interface UseContextualTasksReturn {
  tasks: Task[];
  isActive: boolean;
  currentTaskId: string | null;
  startTasks: (context: ContextType) => void;
  advanceToTask: (taskId: string) => void;
  completeTask: (taskId: string) => void;
  setTaskError: (taskId: string, detail?: string) => void;
  setTaskDetail: (taskId: string, detail: string) => void;
  completeAllTasks: () => void;
  reset: () => void;
}

export function useContextualTasks(): UseContextualTasksReturn {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isActive, setIsActive] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);

  const startTasks = useCallback((context: ContextType) => {
    const newTasks = getTasksForContext(context);
    setTasks(newTasks);
    setIsActive(true);
    
    // Auto-start first task
    if (newTasks.length > 0) {
      setCurrentTaskId(newTasks[0].id);
      setTasks(prev => prev.map((t, i) => 
        i === 0 ? { ...t, status: "running" as TaskStatus } : t
      ));
    }
  }, []);

  const advanceToTask = useCallback((taskId: string) => {
    setTasks(prev => {
      const taskIndex = prev.findIndex(t => t.id === taskId);
      if (taskIndex === -1) return prev;

      return prev.map((t, i) => {
        if (i < taskIndex) {
          return { ...t, status: "completed" as TaskStatus };
        }
        if (i === taskIndex) {
          return { ...t, status: "running" as TaskStatus };
        }
        return t;
      });
    });
    setCurrentTaskId(taskId);
  }, []);

  const completeTask = useCallback((taskId: string) => {
    setTasks(prev => {
      const taskIndex = prev.findIndex(t => t.id === taskId);
      if (taskIndex === -1) return prev;

      const updated = prev.map((t, i) => {
        if (i === taskIndex) {
          return { ...t, status: "completed" as TaskStatus };
        }
        // Start next task
        if (i === taskIndex + 1) {
          setCurrentTaskId(t.id);
          return { ...t, status: "running" as TaskStatus };
        }
        return t;
      });

      // Check if all complete
      if (taskIndex === prev.length - 1) {
        setCurrentTaskId(null);
      }

      return updated;
    });
  }, []);

  const setTaskError = useCallback((taskId: string, detail?: string) => {
    setTasks(prev => prev.map(t => 
      t.id === taskId ? { ...t, status: "error" as TaskStatus, detail } : t
    ));
  }, []);

  const setTaskDetail = useCallback((taskId: string, detail: string) => {
    setTasks(prev => prev.map(t => 
      t.id === taskId ? { ...t, detail } : t
    ));
  }, []);

  const completeAllTasks = useCallback(() => {
    setTasks(prev => prev.map(t => ({ ...t, status: "completed" as TaskStatus })));
    setCurrentTaskId(null);
    
    // Auto-hide after completion
    setTimeout(() => {
      setIsActive(false);
    }, 2000);
  }, []);

  const reset = useCallback(() => {
    setTasks([]);
    setIsActive(false);
    setCurrentTaskId(null);
  }, []);

  return {
    tasks,
    isActive,
    currentTaskId,
    startTasks,
    advanceToTask,
    completeTask,
    setTaskError,
    setTaskDetail,
    completeAllTasks,
    reset,
  };
}
