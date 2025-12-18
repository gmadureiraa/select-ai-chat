import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ClientVisualReference {
  id: string;
  client_id: string;
  image_url: string;
  title?: string;
  description?: string;
  reference_type: "logo" | "product" | "lifestyle" | "style_example" | "color_palette";
  is_primary: boolean;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface CreateVisualReferenceData {
  image_url: string;
  title?: string;
  description?: string;
  reference_type: ClientVisualReference["reference_type"];
  is_primary?: boolean;
}

export const useClientVisualReferences = (clientId: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: references = [], isLoading } = useQuery({
    queryKey: ["client-visual-references", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_visual_references")
        .select("*")
        .eq("client_id", clientId)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ClientVisualReference[];
    },
    enabled: !!clientId,
  });

  const createReference = useMutation({
    mutationFn: async (refData: CreateVisualReferenceData) => {
      const { data, error } = await supabase
        .from("client_visual_references")
        .insert({
          client_id: clientId,
          ...refData,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-visual-references", clientId] });
      toast({
        title: "Referência adicionada",
        description: "A referência visual foi salva com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível adicionar a referência.",
        variant: "destructive",
      });
    },
  });

  const updateReference = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ClientVisualReference> & { id: string }) => {
      const { data, error } = await supabase
        .from("client_visual_references")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-visual-references", clientId] });
      toast({
        title: "Referência atualizada",
        description: "A referência visual foi atualizada.",
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
      const { error } = await supabase
        .from("client_visual_references")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-visual-references", clientId] });
      toast({
        title: "Referência removida",
        description: "A referência visual foi excluída.",
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

  const setPrimaryReference = useMutation({
    mutationFn: async ({ id, isPrimary }: { id: string; isPrimary: boolean }) => {
      const { data, error } = await supabase
        .from("client_visual_references")
        .update({ is_primary: isPrimary })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-visual-references", clientId] });
    },
  });

  // Get primary references for image generation
  const primaryReferences = references.filter(r => r.is_primary);
  
  // Get logo references
  const logoReferences = references.filter(r => r.reference_type === "logo");
  
  // Format for AI prompt
  const formatForImageGeneration = () => {
    const refs = primaryReferences.length > 0 ? primaryReferences : references.slice(0, 4);
    return refs.map(r => ({
      url: r.image_url,
      description: r.description || r.title || `Referência ${r.reference_type}`,
    }));
  };

  return {
    references,
    isLoading,
    createReference,
    updateReference,
    deleteReference,
    setPrimaryReference,
    primaryReferences,
    logoReferences,
    formatForImageGeneration,
  };
};
