import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useActivities } from "@/hooks/useActivities";

export interface ImageGeneration {
  id: string;
  client_id: string;
  template_id: string | null;
  prompt: string;
  image_url: string;
  created_at: string;
}

export const useImageGenerations = (clientId: string, templateId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { logActivity } = useActivities();

  const { data: generations = [], isLoading } = useQuery({
    queryKey: ["image-generations", clientId, templateId],
    queryFn: async () => {
      let query = supabase
        .from("image_generations")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: true });

      if (templateId) {
        query = query.eq("template_id", templateId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as ImageGeneration[];
    },
    enabled: !!clientId,
  });

  const createGeneration = useMutation({
    mutationFn: async ({
      prompt,
      imageUrl,
      templateId: tId,
    }: {
      prompt: string;
      imageUrl: string;
      templateId?: string;
    }) => {
      const { data, error } = await supabase
        .from("image_generations")
        .insert({
          client_id: clientId,
          template_id: tId || null,
          prompt,
          image_url: imageUrl,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["image-generations", clientId, templateId] });
      
      // Log activity
      logActivity.mutate({
        activityType: "image_generated",
        entityType: "image",
        entityId: data.id,
        description: `Imagem gerada: "${data.prompt.substring(0, 60)}..."`,
        metadata: { clientId, templateId: templateId || null },
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao salvar imagem",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteGeneration = useMutation({
    mutationFn: async (id: string) => {
      // Get image info before deleting
      const { data: imageData } = await supabase
        .from("image_generations")
        .select("prompt")
        .eq("id", id)
        .single();
      
      const { error } = await supabase
        .from("image_generations")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return imageData?.prompt;
    },
    onSuccess: (prompt) => {
      queryClient.invalidateQueries({ queryKey: ["image-generations", clientId, templateId] });
      
      // Log activity
      if (prompt) {
        logActivity.mutate({
          activityType: "image_deleted",
          entityType: "image",
          description: `Imagem excluída: "${prompt.substring(0, 60)}..."`,
        });
      }
      
      toast({
        title: "Imagem excluída",
        description: "A imagem foi removida do histórico.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    generations,
    isLoading,
    createGeneration,
    deleteGeneration,
  };
};
