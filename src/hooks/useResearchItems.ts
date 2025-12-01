import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ResearchItem {
  id: string;
  project_id: string;
  type: "youtube" | "image" | "audio" | "text" | "link" | "pdf";
  title: string | null;
  content: string | null;
  source_url: string | null;
  file_path: string | null;
  thumbnail_url: string | null;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  metadata: any;
  processed: boolean;
  created_at: string;
}

export const useResearchItems = (projectId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["research-items", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      
      const { data, error } = await supabase
        .from("research_items")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as ResearchItem[];
    },
    enabled: !!projectId,
  });

  const createItem = useMutation({
    mutationFn: async (item: Omit<Partial<ResearchItem>, 'id' | 'created_at'> & { project_id: string; type: ResearchItem['type'] }) => {
      const { data, error } = await supabase
        .from("research_items")
        .insert([item as any])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["research-items", projectId] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao adicionar item",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ResearchItem> & { id: string }) => {
      const { data, error } = await supabase
        .from("research_items")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["research-items", projectId] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar item",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("research_items")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["research-items", projectId] });
      toast({
        title: "Item removido",
        description: "Item excluído do projeto.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao remover item",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    items,
    isLoading,
    createItem,
    updateItem,
    deleteItem,
  };
};
