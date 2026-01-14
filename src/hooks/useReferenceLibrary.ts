import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type ReferenceType = 
  | "tweet"
  | "thread"
  | "carousel"
  | "reel"
  | "video"
  | "article"
  | "video_script"
  | "podcast"
  | "newsletter"
  | "other";

export interface ReferenceItem {
  id: string;
  client_id: string;
  title: string;
  reference_type: ReferenceType;
  content: string;
  source_url?: string | null;
  thumbnail_url?: string | null;
  metadata?: Record<string, any> | null;
  created_at: string;
  updated_at?: string | null;
}

export interface CreateReferenceData {
  title: string;
  reference_type: ReferenceType;
  content: string;
  source_url?: string;
  thumbnail_url?: string;
  metadata?: Record<string, any>;
}

export const useReferenceLibrary = (clientId: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: references = [], isLoading } = useQuery({
    queryKey: ["client-reference-library", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_reference_library")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ReferenceItem[];
    },
    enabled: !!clientId,
  });

  const createReference = useMutation({
    mutationFn: async (referenceData: CreateReferenceData) => {
      const { data, error } = await supabase
        .from("client_reference_library")
        .insert({
          client_id: clientId,
          ...referenceData,
        })
        .select()
        .single();

      if (error) throw error;

      // Log activity
      await supabase.rpc("log_user_activity", {
        p_activity_type: "content_library_added",
        p_entity_type: "reference_library",
        p_entity_id: data.id,
        p_entity_name: referenceData.title,
        p_description: `Adicionou referência "${referenceData.title}" à biblioteca`,
        p_metadata: { reference_type: referenceData.reference_type },
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-reference-library", clientId] });
      toast({
        title: "Referência adicionada",
        description: "A referência foi adicionada à biblioteca.",
      });
    },
    onError: (error) => {
      console.error("Error creating reference:", error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar a referência.",
        variant: "destructive",
      });
    },
  });

  const updateReference = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateReferenceData> }) => {
      const { error } = await supabase
        .from("client_reference_library")
        .update(data)
        .eq("id", id);

      if (error) throw error;

      // Log activity
      if (data.title) {
        await supabase.rpc("log_user_activity", {
          p_activity_type: "content_library_updated",
          p_entity_type: "reference_library",
          p_entity_id: id,
          p_entity_name: data.title,
          p_description: `Atualizou referência "${data.title}"`,
          p_metadata: { reference_type: data.reference_type },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-reference-library", clientId] });
      toast({
        title: "Referência atualizada",
        description: "As alterações foram salvas.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a referência.",
        variant: "destructive",
      });
    },
  });

  const deleteReference = useMutation({
    mutationFn: async (id: string) => {
      // Get reference info before deleting
      const { data: reference } = await supabase
        .from("client_reference_library")
        .select("title")
        .eq("id", id)
        .single();

      const { error } = await supabase
        .from("client_reference_library")
        .delete()
        .eq("id", id);

      if (error) throw error;

      // Log activity
      if (reference) {
        await supabase.rpc("log_user_activity", {
          p_activity_type: "content_library_deleted",
          p_entity_type: "reference_library",
          p_entity_id: id,
          p_entity_name: reference.title,
          p_description: `Removeu referência "${reference.title}" da biblioteca`,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-reference-library", clientId] });
      toast({
        title: "Referência removida",
        description: "A referência foi removida da biblioteca.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível remover a referência.",
        variant: "destructive",
      });
    },
  });

  return {
    references,
    isLoading,
    createReference,
    updateReference,
    deleteReference,
  };
};
