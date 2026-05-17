import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { apiInvoke } from "@/lib/apiInvoke";
import { toast } from "sonner";

export interface TaskComment {
  id: string;
  task_id: string;
  author_id: string;
  content: string;
  mentions: string[];
  created_at: string;
  updated_at: string;
}

export function useTaskComments(taskId: string | null) {
  const qc = useQueryClient();
  const queryKey = ["task-comments", taskId];

  const { data: comments = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!taskId) return [] as TaskComment[];
      const { data, error } = await supabase
        .from("team_task_comments" as any)
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as TaskComment[];
    },
    enabled: !!taskId,
    // Substitui Supabase Realtime: poll a cada 5s para experiência
    // próxima de chat colaborativo (comentários novos aparecem rápido).
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  });

  // P0 fix audit 2026-05-17: mutations migradas pra /api/task-comments-* que
  // forçam author_id pelo auth e validam workspace membership.

  const addComment = useMutation({
    mutationFn: async ({ content, mentions }: { content: string; mentions: string[] }) => {
      if (!taskId) throw new Error("no task");
      const { error } = await apiInvoke("task-comments-create", {
        body: { task_id: taskId, content, mentions },
      });
      if (error) throw new Error(error.message || "Erro ao comentar");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
    onError: (e: Error) => toast.error("Erro ao comentar", { description: e.message }),
  });

  const removeComment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await apiInvoke("task-comments-delete", {
        body: { id },
      });
      if (error) throw new Error(error.message || "Erro ao remover");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  return { comments, isLoading, addComment, removeComment };
}
