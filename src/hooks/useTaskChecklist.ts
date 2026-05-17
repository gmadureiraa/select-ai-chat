import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { apiInvoke } from "@/lib/apiInvoke";
import { toast } from "sonner";

export interface ChecklistItem {
  id: string;
  task_id: string;
  content: string;
  is_done: boolean;
  position: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useTaskChecklist(taskId: string | null) {
  const qc = useQueryClient();
  const queryKey = ["task-checklist", taskId];

  const { data: items = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!taskId) return [] as ChecklistItem[];
      // SELECT continua direto via PostgREST/Data API — RLS via
      // is_workspace_member(team_task_workspace(task_id)) já restringe.
      const { data, error } = await supabase
        .from("team_task_checklist_items" as any)
        .select("*")
        .eq("task_id", taskId)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as ChecklistItem[];
    },
    enabled: !!taskId,
    // Substitui Supabase Realtime: poll a cada 10s para refletir
    // mudanças de outros usuários colaborando na mesma task.
    refetchInterval: 10000,
    refetchIntervalInBackground: false,
  });

  // P0 fix audit 2026-05-17: mutations migradas pra handlers /api/task-checklist-*
  // que validam acesso via team_tasks → workspace_members. Antes ficavam refém
  // de RLS no pool serverless (neondb_owner BYPASSRLS).

  const addItem = useMutation({
    mutationFn: async (content: string) => {
      if (!taskId) throw new Error("no task");
      const { error } = await apiInvoke("task-checklist-create", {
        body: { task_id: taskId, content, position: items.length },
      });
      if (error) throw new Error(error.message || "Erro ao adicionar item");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
    onError: (e: Error) => toast.error("Erro ao adicionar item", { description: e.message }),
  });

  const toggleItem = useMutation({
    mutationFn: async ({ id, is_done }: { id: string; is_done: boolean }) => {
      const { error } = await apiInvoke("task-checklist-update", {
        body: { id, is_done },
      });
      if (error) throw new Error(error.message || "Erro ao atualizar item");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const { error } = await apiInvoke("task-checklist-update", {
        body: { id, content },
      });
      if (error) throw new Error(error.message || "Erro ao atualizar item");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await apiInvoke("task-checklist-delete", {
        body: { id },
      });
      if (error) throw new Error(error.message || "Erro ao remover item");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const done = items.filter((i) => i.is_done).length;
  return { items, isLoading, addItem, toggleItem, updateItem, removeItem, done, total: items.length };
}
