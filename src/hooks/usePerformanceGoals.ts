import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PerformanceGoal {
  id: string;
  client_id: string;
  platform: string;
  metric_name: string;
  target_value: number;
  current_value: number;
  period: string;
  start_date: string;
  end_date: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CreateGoalData {
  client_id: string;
  platform: string;
  metric_name: string;
  target_value: number;
  period?: string;
  end_date?: string;
}

export const usePerformanceGoals = (clientId: string) => {
  const queryClient = useQueryClient();

  const goalsQuery = useQuery({
    queryKey: ["performance-goals", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("performance_goals")
        .select("*")
        .eq("client_id", clientId)
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as PerformanceGoal[];
    },
    enabled: !!clientId,
  });

  const createGoal = useMutation({
    mutationFn: async (goalData: CreateGoalData) => {
      const { data, error } = await supabase
        .from("performance_goals")
        .insert(goalData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["performance-goals", clientId] });
      toast.success("Meta criada com sucesso!");
    },
    onError: () => {
      toast.error("Erro ao criar meta");
    },
  });

  const updateGoal = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PerformanceGoal> & { id: string }) => {
      const { error } = await supabase
        .from("performance_goals")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["performance-goals", clientId] });
      toast.success("Meta atualizada!");
    },
  });

  const deleteGoal = useMutation({
    mutationFn: async (goalId: string) => {
      const { error } = await supabase
        .from("performance_goals")
        .delete()
        .eq("id", goalId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["performance-goals", clientId] });
      toast.success("Meta removida");
    },
  });

  return {
    goals: goalsQuery.data || [],
    isLoading: goalsQuery.isLoading,
    createGoal,
    updateGoal,
    deleteGoal,
  };
};
