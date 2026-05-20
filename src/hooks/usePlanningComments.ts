import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { apiInvoke } from "@/lib/apiInvoke";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { parseMentions } from "@/lib/mentionParser";

export interface PlanningComment {
  id: string;
  planning_item_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  profile?: {
    full_name: string | null;
    avatar_url: string | null;
    email: string | null;
  };
}

export function usePlanningComments(planningItemId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["planning-comments", planningItemId],
    queryFn: async () => {
      if (!planningItemId) return [];

      // 2026-05-20 fix: o embedded join PostgREST
      // `profiles!planning_item_comments_user_id_fkey` depende do nome EXATO da
      // FK no Neon Data API. Se a constraint tiver outro nome (ou não estiver
      // exposta), o PostgREST devolve erro e a lista some silenciosamente.
      // Desacopla: busca comentários, depois resolve os profiles num 2º query
      // e mescla no client. Sem dependência de nome de FK.
      const { data: rows, error } = await supabase
        .from("planning_item_comments")
        .select("*")
        .eq("planning_item_id", planningItemId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      const list = (rows ?? []) as unknown as PlanningComment[];
      if (list.length === 0) return list;

      const userIds = [...new Set(list.map((c) => c.user_id).filter(Boolean))];
      let profileMap: Record<string, PlanningComment["profile"]> = {};
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url, email")
          .in("id", userIds);
        profileMap = Object.fromEntries(
          (profs ?? []).map((p: any) => [
            p.id,
            { full_name: p.full_name, avatar_url: p.avatar_url, email: p.email },
          ]),
        );
      }
      return list.map((c) => ({ ...c, profile: profileMap[c.user_id] }));
    },
    enabled: !!planningItemId,
    staleTime: 15_000,
    placeholderData: keepPreviousData,
  });

  const addComment = useMutation({
    mutationFn: async (content: string) => {
      if (!planningItemId || !user?.id) throw new Error("Missing data");

      // P0 fix audit 2026-05-17: troca 2 inserts diretos (comment +
      // notifications) por /api/planning-comments-create que aplica em
      // transaction + valida workspace membership. Workspace_id e author
      // name são resolvidos no servidor (não confiamos no client).
      const userMentions = parseMentions(content).filter((m) => m.type === "user");
      const { data, error } = await apiInvoke("planning-comments-create", {
        body: {
          planning_item_id: planningItemId,
          content,
          user_mentions: userMentions.map((m) => m.id),
        },
      });

      if (error) throw new Error(error.message || "Erro ao adicionar comentário");
      return data?.comment ?? data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planning-comments", planningItemId] });
      toast({ title: "Comentário adicionado" });
    },
    onError: () => {
      toast({
        title: "Erro ao adicionar comentário",
        variant: "destructive"
      });
    }
  });

  const deleteComment = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await apiInvoke("planning-comments-delete", {
        body: { id: commentId },
      });
      if (error) throw new Error(error.message || "Erro ao remover comentário");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planning-comments", planningItemId] });
      toast({ title: "Comentário removido" });
    },
    onError: () => {
      toast({
        title: "Erro ao remover comentário",
        variant: "destructive"
      });
    }
  });

  return {
    comments,
    isLoading,
    addComment: addComment.mutate,
    deleteComment: deleteComment.mutate,
    isAdding: addComment.isPending
  };
}
