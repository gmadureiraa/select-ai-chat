import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

import { ContentTypeKey, normalizeContentType } from "@/types/contentTypes";

export type ContentType = ContentTypeKey;

export interface ContentItem {
  id: string;
  client_id: string;
  title: string;
  content_type: ContentType;
  content: string;
  content_url?: string | null;
  thumbnail_url?: string | null;
  metadata?: Record<string, any> | null;
  created_at: string;
  updated_at?: string | null;
}

export interface CreateContentData {
  title: string;
  content_type: ContentType;
  content: string;
  content_url?: string;
  thumbnail_url?: string;
  metadata?: Record<string, any>;
}

export const useContentLibrary = (clientId: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: contents = [], isLoading } = useQuery({
    queryKey: ["client-content-library", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_content_library")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ContentItem[];
    },
    enabled: !!clientId,
  });

  const createContent = useMutation({
    mutationFn: async (contentData: CreateContentData) => {
      const { data, error } = await supabase
        .from("client_content_library")
        .insert({
          client_id: clientId,
          ...contentData,
        })
        .select()
        .single();

      if (error) throw error;

      // Log activity
      await supabase.rpc("log_user_activity", {
        p_activity_type: "content_library_added",
        p_entity_type: "content_library",
        p_entity_id: data.id,
        p_entity_name: contentData.title,
        p_description: `Adicionou conteúdo "${contentData.title}" à biblioteca`,
        p_metadata: { content_type: contentData.content_type },
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-content-library", clientId] });
      toast({
        title: "Conteúdo adicionado",
        description: "O conteúdo foi adicionado à biblioteca.",
      });
    },
    onError: (error) => {
      console.error("Error creating content:", error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar o conteúdo.",
        variant: "destructive",
      });
    },
  });

  const updateContent = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateContentData> }) => {
      const { error } = await supabase
        .from("client_content_library")
        .update(data)
        .eq("id", id);

      if (error) throw error;

      // Log activity
      if (data.title) {
        await supabase.rpc("log_user_activity", {
          p_activity_type: "content_library_updated",
          p_entity_type: "content_library",
          p_entity_id: id,
          p_entity_name: data.title,
          p_description: `Atualizou conteúdo "${data.title}"`,
          p_metadata: { content_type: data.content_type },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-content-library", clientId] });
      toast({
        title: "Conteúdo atualizado",
        description: "As alterações foram salvas.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o conteúdo.",
        variant: "destructive",
      });
    },
  });

  const deleteContent = useMutation({
    mutationFn: async (id: string) => {
      // Get content info before deleting
      const { data: content } = await supabase
        .from("client_content_library")
        .select("title")
        .eq("id", id)
        .single();

      const { error } = await supabase
        .from("client_content_library")
        .delete()
        .eq("id", id);

      if (error) throw error;

      // Log activity
      if (content) {
        await supabase.rpc("log_user_activity", {
          p_activity_type: "content_library_deleted",
          p_entity_type: "content_library",
          p_entity_id: id,
          p_entity_name: content.title,
          p_description: `Removeu conteúdo "${content.title}" da biblioteca`,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-content-library", clientId] });
      toast({
        title: "Conteúdo removido",
        description: "O conteúdo foi removido da biblioteca.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível remover o conteúdo.",
        variant: "destructive",
      });
    },
  });

  return {
    contents,
    isLoading,
    createContent,
    updateContent,
    deleteContent,
  };
};
