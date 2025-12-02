import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ResearchItem {
  id: string;
  project_id: string;
  type: "youtube" | "image" | "audio" | "text" | "link" | "pdf" | "note" | "ai_chat" | "content_library" | "reference_library" | "grok_search" | "embed" | "spreadsheet" | "comparison";
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

export interface ResearchConnection {
  id: string;
  project_id: string;
  source_id: string;
  target_id: string;
  label: string | null;
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

  // Connections queries
  const { data: connections = [] } = useQuery({
    queryKey: ["research-connections", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      
      const { data, error } = await supabase
        .from("research_connections")
        .select("*")
        .eq("project_id", projectId);

      if (error) throw error;
      return data as ResearchConnection[];
    },
    enabled: !!projectId,
  });

  const createConnection = useMutation({
    mutationFn: async (connection: { source_id: string; target_id: string; label?: string }) => {
      const { data, error } = await supabase
        .from("research_connections")
        .insert([{ project_id: projectId, ...connection }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["research-connections", projectId] });
    },
  });

  const deleteConnection = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("research_connections")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["research-connections", projectId] });
    },
  });

  return {
    items,
    isLoading,
    createItem,
    updateItem,
    deleteItem,
    connections,
    createConnection,
    deleteConnection,
  };
};
