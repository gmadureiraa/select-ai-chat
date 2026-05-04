import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
  const { user } = useAuth();
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
  });

  useEffect(() => {
    if (!taskId) return;
    const ch = supabase
      .channel(`comments:${taskId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "team_task_comments", filter: `task_id=eq.${taskId}` },
        () => qc.invalidateQueries({ queryKey })
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [taskId, qc]);

  const addComment = useMutation({
    mutationFn: async ({ content, mentions }: { content: string; mentions: string[] }) => {
      if (!taskId || !user?.id) throw new Error("no task/user");
      const { error } = await supabase.from("team_task_comments" as any).insert({
        task_id: taskId,
        author_id: user.id,
        content,
        mentions,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
    onError: (e: Error) => toast.error("Erro ao comentar", { description: e.message }),
  });

  const removeComment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("team_task_comments" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  return { comments, isLoading, addComment, removeComment };
}
