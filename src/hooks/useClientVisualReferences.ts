import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface StyleAnalysis {
  style_summary: string;
  visual_elements?: {
    photography_style?: string;
    lighting?: string;
    color_palette?: string[];
    dominant_mood?: string;
    composition?: string;
  };
  recurring_elements?: string[];
  brand_elements?: {
    logo_style?: string;
    typography?: string;
    product_presentation?: string;
  };
  technical_specs?: {
    aspect_ratio?: string;
    resolution_feel?: string;
    post_processing?: string;
  };
  generation_prompt_template?: string;
}

export interface ClientVisualReference {
  id: string;
  client_id: string;
  image_url: string;
  title?: string;
  description?: string;
  reference_type: "logo" | "product" | "lifestyle" | "style_example" | "color_palette";
  is_primary: boolean;
  metadata?: {
    styleAnalysis?: StyleAnalysis;
    analyzedAt?: string;
    [key: string]: any;
  };
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

  // Analyze a visual reference and save the style analysis to metadata
  const analyzeReference = useMutation({
    mutationFn: async (ref: ClientVisualReference) => {
      // Get a public URL for the image
      let imageUrl = ref.image_url;
      
      // If it's a storage path, get the public URL
      if (!imageUrl.startsWith('http') && !imageUrl.startsWith('data:')) {
        const { data: urlData } = supabase.storage
          .from("client-files")
          .getPublicUrl(imageUrl);
        imageUrl = urlData.publicUrl;
      }

      // Call analyze-style edge function
      const { data, error } = await supabase.functions.invoke("analyze-style", {
        body: {
          imageUrls: [imageUrl],
          clientId: clientId,
        },
      });

      if (error) throw error;

      // Update the reference with the style analysis
      const { data: updatedRef, error: updateError } = await supabase
        .from("client_visual_references")
        .update({
          metadata: {
            ...ref.metadata,
            styleAnalysis: data.styleAnalysis,
            analyzedAt: new Date().toISOString(),
          },
        })
        .eq("id", ref.id)
        .select()
        .single();

      if (updateError) throw updateError;
      return updatedRef;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-visual-references", clientId] });
    },
    onError: (error) => {
      console.error("Failed to analyze reference:", error);
    },
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
      return data as ClientVisualReference;
    },
    onSuccess: (newRef) => {
      queryClient.invalidateQueries({ queryKey: ["client-visual-references", clientId] });
      toast({
        title: "Referência adicionada",
        description: "A referência visual foi salva. Analisando estilo...",
      });
      
      // Automatically analyze the new reference
      analyzeReference.mutate(newRef);
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
  
  // Get references with style analysis
  const analyzedReferences = references.filter(r => r.metadata?.styleAnalysis);
  
  // Format for AI prompt
  const formatForImageGeneration = () => {
    const refs = primaryReferences.length > 0 ? primaryReferences : references.slice(0, 4);
    return refs.map(r => ({
      url: r.image_url,
      description: r.description || r.title || `Referência ${r.reference_type}`,
    }));
  };
  
  // Format style analyses for image generation
  const getStyleContext = () => {
    const analyzed = analyzedReferences.slice(0, 4);
    if (analyzed.length === 0) return null;
    
    return analyzed.map(r => ({
      type: r.reference_type,
      analysis: r.metadata?.styleAnalysis,
    }));
  };

  return {
    references,
    isLoading,
    createReference,
    updateReference,
    deleteReference,
    setPrimaryReference,
    analyzeReference,
    primaryReferences,
    logoReferences,
    analyzedReferences,
    formatForImageGeneration,
    getStyleContext,
  };
};
