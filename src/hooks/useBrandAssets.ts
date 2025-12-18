import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface BrandAssets {
  logo_url?: string;
  logo_variations?: string[];
  color_palette?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    text?: string;
  };
  typography?: {
    primary_font?: string;
    secondary_font?: string;
    style?: string;
  };
  visual_style?: {
    photography_style?: string;
    mood?: string;
    recurring_elements?: string[];
  };
}

export const useBrandAssets = (clientId: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: brandAssets, isLoading } = useQuery({
    queryKey: ["brand-assets", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("brand_assets")
        .eq("id", clientId)
        .single();

      if (error) throw error;
      return (data?.brand_assets as BrandAssets) || {};
    },
    enabled: !!clientId,
  });

  const updateBrandAssets = useMutation({
    mutationFn: async (assets: BrandAssets) => {
      // Cast to any to avoid type issues with JSONB column
      const { data, error } = await supabase
        .from("clients")
        .update({ brand_assets: assets as any })
        .eq("id", clientId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brand-assets", clientId] });
      toast({
        title: "Brand Assets atualizados",
        description: "As configurações de marca foram salvas.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível salvar as configurações de marca.",
        variant: "destructive",
      });
    },
  });

  // Format brand assets for AI prompt
  const formatForPrompt = (): string => {
    if (!brandAssets) return "";
    
    const parts: string[] = [];
    
    if (brandAssets.color_palette) {
      const colors = Object.entries(brandAssets.color_palette)
        .filter(([_, value]) => value)
        .map(([key, value]) => `${key}: ${value}`)
        .join(", ");
      if (colors) parts.push(`PALETA DE CORES: ${colors}`);
    }
    
    if (brandAssets.typography) {
      const typo = [];
      if (brandAssets.typography.primary_font) typo.push(`Fonte principal: ${brandAssets.typography.primary_font}`);
      if (brandAssets.typography.secondary_font) typo.push(`Fonte secundária: ${brandAssets.typography.secondary_font}`);
      if (brandAssets.typography.style) typo.push(`Estilo: ${brandAssets.typography.style}`);
      if (typo.length > 0) parts.push(`TIPOGRAFIA: ${typo.join(", ")}`);
    }
    
    if (brandAssets.visual_style) {
      const style = [];
      if (brandAssets.visual_style.photography_style) style.push(`Estilo fotográfico: ${brandAssets.visual_style.photography_style}`);
      if (brandAssets.visual_style.mood) style.push(`Mood: ${brandAssets.visual_style.mood}`);
      if (brandAssets.visual_style.recurring_elements?.length) {
        style.push(`Elementos recorrentes: ${brandAssets.visual_style.recurring_elements.join(", ")}`);
      }
      if (style.length > 0) parts.push(`ESTILO VISUAL: ${style.join(". ")}`);
    }
    
    return parts.join("\n");
  };

  return {
    brandAssets: brandAssets || {},
    isLoading,
    updateBrandAssets,
    formatForPrompt,
    logoUrl: brandAssets?.logo_url,
    colorPalette: brandAssets?.color_palette,
    typography: brandAssets?.typography,
    visualStyle: brandAssets?.visual_style,
  };
};
