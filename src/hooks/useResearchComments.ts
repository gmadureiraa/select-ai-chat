import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ResearchComment {
  id: string;
  project_id: string;
  item_id: string | null;
  user_id: string;
  content: string;
  position_x: number | null;
  position_y: number | null;
  resolved: boolean;
  created_at: string;
  updated_at: string;
}

export const useResearchComments = (projectId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["research-comments", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      
      const { data, error } = await supabase
        .from("research_comments")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ResearchComment[];
    },
    enabled: !!projectId,
  });

  const createComment = useMutation({
    mutationFn: async ({ 
      content, 
      item_id, 
      position_x, 
      position_y 
    }: { 
      content: string; 
      item_id?: string; 
      position_x?: number; 
      position_y?: number; 
    }) => {
      const { data, error } = await supabase
        .from("research_comments")
        .insert([{ 
          project_id: projectId, 
          content, 
          item_id, 
          position_x, 
          position_y 
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["research-comments", projectId] });
      toast({ title: "Comentário adicionado" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao adicionar comentário",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateComment = useMutation({
    mutationFn: async ({ id, content, resolved }: { id: string; content?: string; resolved?: boolean }) => {
      const updates: any = {};
      if (content !== undefined) updates.content = content;
      if (resolved !== undefined) updates.resolved = resolved;

      const { data, error } = await supabase
        .from("research_comments")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["research-comments", projectId] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar comentário",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteComment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("research_comments")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["research-comments", projectId] });
      toast({ title: "Comentário excluído" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir comentário",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const unresolvedCount = comments.filter(c => !c.resolved).length;

  return {
    comments,
    isLoading,
    createComment,
    updateComment,
    deleteComment,
    unresolvedCount,
  };
};
