import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface BatchPlanningItem {
  title: string;
  description?: string;
  format?: string;
  scheduledAt?: Date;
  assigneeId?: string;
  status?: "idea" | "draft" | "review" | "approved";
  platform?: string;
}

export interface BatchSchedule {
  pattern: "weekly" | "specific_days" | "daily";
  dayOfWeek?: number; // 0-6 (Sunday-Saturday)
  startDate: Date;
  count: number;
}

interface UseKAIBatchPlanningResult {
  createBatch: (params: {
    items: BatchPlanningItem[];
    clientId: string;
    workspaceId: string;
    schedule?: BatchSchedule;
  }) => Promise<{ success: boolean; createdCount: number; error?: string }>;
  isCreating: boolean;
}

// Weekday names in Portuguese
const weekdayMap: Record<string, number> = {
  domingo: 0,
  segunda: 1,
  terça: 2,
  quarta: 3,
  quinta: 4,
  sexta: 5,
  sábado: 6,
};

/**
 * Parse relative schedule from text
 */
export function parseRelativeSchedule(text: string): BatchSchedule | null {
  const lowerText = text.toLowerCase();

  // Match patterns like "próximas 4 quartas-feiras" or "próximos 3 domingos"
  const match = lowerText.match(/próxim[oa]s?\s+(\d+)\s+(segunda|terça|quarta|quinta|sexta|sábado|domingo)/);
  
  if (match) {
    const count = parseInt(match[1]);
    const dayName = match[2];
    const dayOfWeek = weekdayMap[dayName];
    
    if (!isNaN(count) && dayOfWeek !== undefined) {
      return {
        pattern: "weekly",
        dayOfWeek,
        startDate: getNextWeekday(dayOfWeek),
        count,
      };
    }
  }

  return null;
}

/**
 * Get the next occurrence of a specific weekday
 */
function getNextWeekday(targetDay: number): Date {
  const today = new Date();
  const currentDay = today.getDay();
  const daysUntilTarget = (targetDay - currentDay + 7) % 7;
  
  const nextDate = new Date(today);
  nextDate.setDate(today.getDate() + (daysUntilTarget === 0 ? 7 : daysUntilTarget));
  nextDate.setHours(10, 0, 0, 0); // Default to 10 AM
  
  return nextDate;
}

/**
 * Calculate scheduled dates based on schedule pattern
 */
function calculateScheduledDates(schedule: BatchSchedule, count: number): Date[] {
  const dates: Date[] = [];
  let currentDate = new Date(schedule.startDate);

  for (let i = 0; i < count; i++) {
    dates.push(new Date(currentDate));
    
    if (schedule.pattern === "weekly") {
      currentDate.setDate(currentDate.getDate() + 7);
    } else if (schedule.pattern === "daily") {
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  return dates;
}

export function useKAIBatchPlanning(): UseKAIBatchPlanningResult {
  const [isCreating, setIsCreating] = useState(false);

  const createBatch = useCallback(async ({
    items,
    clientId,
    workspaceId,
    schedule,
  }: {
    items: BatchPlanningItem[];
    clientId: string;
    workspaceId: string;
    schedule?: BatchSchedule;
  }) => {
    setIsCreating(true);

    try {
      // Get current user
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        return { success: false, createdCount: 0, error: "Usuário não autenticado" };
      }

      // Calculate scheduled dates if schedule is provided
      let scheduledDates: Date[] | undefined;
      if (schedule) {
        scheduledDates = calculateScheduledDates(schedule, items.length);
      }

      // Prepare planning items
      const planningItems = items.map((item, index) => ({
        title: item.title,
        description: item.description || null,
        content_type: item.format || "post",
        platform: item.platform || "instagram",
        status: item.status || "idea",
        client_id: clientId,
        workspace_id: workspaceId,
        created_by: userData.user.id,
        assigned_to: item.assigneeId || null,
        scheduled_at: scheduledDates?.[index]?.toISOString() || item.scheduledAt?.toISOString() || null,
        position: index,
      }));

      // Insert all items
      const { data, error } = await supabase
        .from("planning_items")
        .insert(planningItems)
        .select();

      if (error) {
        console.error("Error creating batch:", error);
        return { success: false, createdCount: 0, error: error.message };
      }

      return { success: true, createdCount: data?.length || 0 };
    } catch (error) {
      console.error("Batch creation error:", error);
      return {
        success: false,
        createdCount: 0,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      };
    } finally {
      setIsCreating(false);
    }
  }, []);

  return {
    createBatch,
    isCreating,
  };
}
