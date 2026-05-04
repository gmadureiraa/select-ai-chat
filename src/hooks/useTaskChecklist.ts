import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
  const { user } = useAuth();
  const queryKey = ["task-checklist", taskId];

  const { data: items = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!taskId) return [] as ChecklistItem[];
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
  });

  useEffect(() => {
    if (!taskId) return;
    const ch = supabase
      .channel(`checklist:${taskId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "team_task_checklist_items", filter: `task_id=eq.${taskId}` },
        () => qc.invalidateQueries({ queryKey })
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [taskId, qc]);

  const addItem = useMutation({
    mutationFn: async (content: string) => {
      if (!taskId) throw new Error("no task");
      const { error } = await supabase.from("team_task_checklist_items" as any).insert({
        task_id: taskId,
        content,
        position: items.length,
        created_by: user?.id ?? null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
    onError: (e: Error) => toast.error("Erro ao adicionar item", { description: e.message }),
  });

  const toggleItem = useMutation({
    mutationFn: async ({ id, is_done }: { id: string; is_done: boolean }) => {
      const { error } = await supabase
        .from("team_task_checklist_items" as any)
        .update({ is_done } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const { error } = await supabase
        .from("team_task_checklist_items" as any)
        .update({ content } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("team_task_checklist_items" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const done = items.filter((i) => i.is_done).length;
  return { items, isLoading, addItem, toggleItem, updateItem, removeItem, done, total: items.length };
}
