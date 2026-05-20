import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
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

  const { data: comments = [], isLoading, error: loadError } = useQuery({
    queryKey: ["planning-comments", planningItemId],
    queryFn: async () => {
      if (!planningItemId) return [];

      // 2026-05-20 fix: leitura também passa pelo backend. Antes o create era
      // server-side, mas o read dependia do Data API/RLS no browser; qualquer
      // divergência de policy/FK fazia o comentário existir no banco e sumir na UI.
      const { data, error } = await apiInvoke<{ comments?: PlanningComment[] }>(
        "planning-comments-list",
        { body: { planning_item_id: planningItemId } },
      );
      if (error) {
        throw new Error(error.message || "Erro ao carregar comentários");
      }
      return data?.comments ?? [];
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
      return (data?.comment ?? data) as PlanningComment;
    },
    onSuccess: (comment) => {
      if (comment?.id) {
        queryClient.setQueryData<PlanningComment[]>(
          ["planning-comments", planningItemId],
          (current = []) =>
            current.some((item) => item.id === comment.id)
              ? current
              : [...current, comment],
        );
      }
      queryClient.invalidateQueries({ queryKey: ["planning-comments", planningItemId] });
      toast({ title: "Comentário adicionado" });
    },
    onError: (error) => {
      toast({
        title: "Erro ao adicionar comentário",
        description: error instanceof Error ? error.message : undefined,
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
    loadError: loadError instanceof Error ? loadError.message : null,
    addComment: addComment.mutateAsync,
    deleteComment: deleteComment.mutate,
    isAdding: addComment.isPending
  };
}
