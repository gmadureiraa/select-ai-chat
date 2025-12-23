import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface BrandAssets {
  // Legacy fields for backwards compatibility
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
  
  // New expanded fields
  logos?: {
    primary?: string;
    negative?: string;
    alternative?: string;
    favicon?: string;
    ogImage?: string;
  };
  colors?: {
    primary?: { color?: string; text?: string };
    secondary?: { color?: string; text?: string };
    accent?: { color?: string; text?: string };
    surfaces?: {
      background?: string;
      card?: string;
      muted?: string;
      border?: string;
    };
    textBase?: string;
    buttons?: {
      primary?: { bg?: string; text?: string };
      secondary?: { bg?: string; text?: string };
    };
  };
  fonts?: {
    sans?: string;
    serif?: string;
    mono?: string;
  };
  photography?: {
    description?: string;
    referenceImages?: string[];
  };
  emailAssets?: {
    headerImage?: string;
    footerImage?: string;
  };
  
  // Import metadata
  importedFrom?: string;
  importedAt?: string;
  colorScheme?: 'light' | 'dark';
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
    
    // Handle new colors structure
    if (brandAssets.colors) {
      const colorParts: string[] = [];
      if (brandAssets.colors.primary?.color) colorParts.push(`primária: ${brandAssets.colors.primary.color}`);
      if (brandAssets.colors.secondary?.color) colorParts.push(`secundária: ${brandAssets.colors.secondary.color}`);
      if (brandAssets.colors.accent?.color) colorParts.push(`destaque: ${brandAssets.colors.accent.color}`);
      if (brandAssets.colors.surfaces?.background) colorParts.push(`fundo: ${brandAssets.colors.surfaces.background}`);
      if (colorParts.length > 0) parts.push(`PALETA DE CORES: ${colorParts.join(", ")}`);
    } else if (brandAssets.color_palette) {
      // Legacy fallback
      const colors = Object.entries(brandAssets.color_palette)
        .filter(([_, value]) => value)
        .map(([key, value]) => `${key}: ${value}`)
        .join(", ");
      if (colors) parts.push(`PALETA DE CORES: ${colors}`);
    }
    
    // Handle new fonts structure
    if (brandAssets.fonts) {
      const fontParts: string[] = [];
      if (brandAssets.fonts.sans) fontParts.push(`Sans: ${brandAssets.fonts.sans}`);
      if (brandAssets.fonts.serif) fontParts.push(`Serif: ${brandAssets.fonts.serif}`);
      if (brandAssets.fonts.mono) fontParts.push(`Mono: ${brandAssets.fonts.mono}`);
      if (fontParts.length > 0) parts.push(`TIPOGRAFIA: ${fontParts.join(", ")}`);
    } else if (brandAssets.typography) {
      // Legacy fallback
      const typo = [];
      if (brandAssets.typography.primary_font) typo.push(`Fonte principal: ${brandAssets.typography.primary_font}`);
      if (brandAssets.typography.secondary_font) typo.push(`Fonte secundária: ${brandAssets.typography.secondary_font}`);
      if (brandAssets.typography.style) typo.push(`Estilo: ${brandAssets.typography.style}`);
      if (typo.length > 0) parts.push(`TIPOGRAFIA: ${typo.join(", ")}`);
    }
    
    // Handle photography
    if (brandAssets.photography?.description) {
      parts.push(`ESTILO FOTOGRÁFICO: ${brandAssets.photography.description}`);
    } else if (brandAssets.visual_style) {
      // Legacy fallback
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
    // Legacy accessors
    logoUrl: brandAssets?.logo_url || brandAssets?.logos?.primary,
    colorPalette: brandAssets?.color_palette,
    typography: brandAssets?.typography,
    visualStyle: brandAssets?.visual_style,
    // New accessors
    logos: brandAssets?.logos,
    colors: brandAssets?.colors,
    fonts: brandAssets?.fonts,
    photography: brandAssets?.photography,
    emailAssets: brandAssets?.emailAssets,
  };
};
