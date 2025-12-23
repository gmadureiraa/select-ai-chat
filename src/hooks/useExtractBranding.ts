import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ExtractedBranding {
  logos: {
    primary?: string | null;
    favicon?: string | null;
    ogImage?: string | null;
  };
  colors: {
    primary?: string | null;
    secondary?: string | null;
    accent?: string | null;
    background?: string | null;
    textPrimary?: string | null;
    textSecondary?: string | null;
  };
  typography: {
    fonts?: string[];
    primary?: string | null;
    secondary?: string | null;
  };
  buttons?: {
    primaryBg?: string | null;
    primaryText?: string | null;
    secondaryBg?: string | null;
    secondaryText?: string | null;
    borderRadius?: string | null;
  } | null;
  colorScheme?: 'light' | 'dark';
  importedFrom?: string;
  importedAt?: string;
}

export const useExtractBranding = () => {
  const { toast } = useToast();
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedBranding | null>(null);
  const [error, setError] = useState<string | null>(null);

  const extractBranding = async (url: string): Promise<ExtractedBranding | null> => {
    if (!url.trim()) {
      toast({
        title: "URL necessária",
        description: "Insira a URL do site para extrair o DNA visual.",
        variant: "destructive",
      });
      return null;
    }

    setIsExtracting(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('extract-branding', {
        body: { url },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'Falha ao extrair branding');
      }

      const extracted = data.data as ExtractedBranding;
      setExtractedData(extracted);

      // Count what was extracted
      const extractedItems: string[] = [];
      if (extracted.logos?.primary) extractedItems.push('logo');
      if (extracted.colors?.primary || extracted.colors?.secondary) extractedItems.push('cores');
      if (extracted.typography?.primary || extracted.typography?.fonts?.length) extractedItems.push('tipografia');
      if (extracted.buttons?.primaryBg) extractedItems.push('botões');

      toast({
        title: "DNA Visual extraído!",
        description: extractedItems.length > 0 
          ? `Extraído: ${extractedItems.join(', ')}`
          : "Nenhum elemento encontrado. Preencha manualmente.",
      });

      return extracted;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      toast({
        title: "Erro na extração",
        description: errorMessage,
        variant: "destructive",
      });
      return null;
    } finally {
      setIsExtracting(false);
    }
  };

  const resetExtraction = () => {
    setExtractedData(null);
    setError(null);
  };

  return {
    extractBranding,
    isExtracting,
    extractedData,
    error,
    resetExtraction,
  };
};
