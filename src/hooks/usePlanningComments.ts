import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
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
  const { workspace } = useWorkspaceContext();

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["planning-comments", planningItemId],
    queryFn: async () => {
      if (!planningItemId) return [];

      const { data, error } = await supabase
        .from("planning_item_comments")
        .select(`
          *,
          profile:profiles!planning_item_comments_user_id_fkey(full_name, avatar_url, email)
        `)
        .eq("planning_item_id", planningItemId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as unknown as PlanningComment[];
    },
    enabled: !!planningItemId
  });

  const addComment = useMutation({
    mutationFn: async (content: string) => {
      if (!planningItemId || !user?.id) throw new Error("Missing data");

      const { data, error } = await supabase
        .from("planning_item_comments")
        .insert({
          planning_item_id: planningItemId,
          user_id: user.id,
          content
        })
        .select()
        .single();

      if (error) throw error;

      // Create notifications for mentioned users
      if (workspace?.id) {
        const mentions = parseMentions(content);
        const userMentions = mentions.filter(m => m.type === 'user');

        if (userMentions.length > 0) {
          const notifications = userMentions
            .filter(m => m.id !== user.id) // Don't notify self
            .map(m => ({
              user_id: m.id,
              workspace_id: workspace.id,
              type: 'mention' as const,
              title: 'Você foi mencionado em um comentário',
              message: `${user.user_metadata?.full_name || user.email?.split('@')[0] || 'Alguém'} mencionou você em um comentário`,
              entity_type: 'planning_item',
              entity_id: planningItemId,
              metadata: {
                comment_id: data.id,
                planning_item_id: planningItemId
              }
            }));

          if (notifications.length > 0) {
            await supabase.from("notifications").insert(notifications);
          }
        }
      }

      return data;
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
      const { error } = await supabase
        .from("planning_item_comments")
        .delete()
        .eq("id", commentId);

      if (error) throw error;
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
