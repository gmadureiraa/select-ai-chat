import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTokenError } from "@/hooks/useTokenError";
import { callKaiContentAgent } from "@/lib/parseOpenAIStream";
import {
  extractAllReferences,
  buildEnrichedPrompt,
  parseStructuredContent,
  CONTENT_TYPE_LABELS,
  TweetItem,
  SlideItem,
  ExtractedReferences,
  StructuredContent,
} from "@/lib/contentGeneration";

// ============= Types =============

export interface GenerationInput {
  title: string;
  format: string; // content_type
  clientId: string;
  referenceInput?: string; // URLs, @mentions, plain text
  additionalContext?: string; // Extra instructions
  images?: string[]; // Pre-known images
}

export interface GenerationResult {
  content: string;
  images: string[];
  structuredContent?: StructuredContent;
}

export interface UseUnifiedContentGenerationReturn {
  generate: (input: GenerationInput) => Promise<GenerationResult | null>;
  isGenerating: boolean;
  isFetchingReferences: boolean;
}

// ============= Hook =============

export function useUnifiedContentGeneration(): UseUnifiedContentGenerationReturn {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isFetchingReferences, setIsFetchingReferences] = useState(false);
  const { toast } = useToast();
  const { handleTokenError } = useTokenError();

  /**
   * Main generation function - unified flow for all content generation
   */
  const generate = async (input: GenerationInput): Promise<GenerationResult | null> => {
    const { title, format, clientId, referenceInput, additionalContext, images: preKnownImages } = input;

    // Validate required inputs
    if (!title || !format || !clientId) {
      toast({
        title: "Dados incompletos",
        description: "Preencha título, formato e cliente para gerar conteúdo.",
        variant: "destructive"
      });
      return null;
    }

    setIsGenerating(true);
    setIsFetchingReferences(true);

    try {
      // 1. Extract all references (URLs, @mentions, etc.)
      console.log("[UnifiedGeneration] Extracting references from input...");
      let extractedRefs: ExtractedReferences = { content: "", images: [], sources: [] };
      
      if (referenceInput) {
        extractedRefs = await extractAllReferences(referenceInput);
        console.log(`[UnifiedGeneration] Extracted ${extractedRefs.sources.length} sources, ${extractedRefs.images.length} images`);
      }

      setIsFetchingReferences(false);

      // Combine pre-known images with extracted images
      const allImages = [
        ...(preKnownImages || []),
        ...extractedRefs.images
      ].slice(0, 5); // Limit to 5 images

      // 2. Build enriched prompt
      const prompt = buildEnrichedPrompt({
        title,
        format,
        referenceContent: extractedRefs.content || undefined,
        additionalContext,
        imageCount: allImages.length,
      });

      console.log("[UnifiedGeneration] Prompt built, calling kai-content-agent...");

      // 3. Get access token
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      
      if (!accessToken) {
        throw new Error("Usuário não autenticado");
      }

      // 4. Call kai-content-agent
      const generatedContent = await callKaiContentAgent({
        clientId,
        request: prompt,
        format,
        accessToken,
      });

      if (!generatedContent) {
        toast({
          title: "Sem conteúdo",
          description: "A IA não retornou conteúdo. Tente novamente.",
          variant: "destructive"
        });
        return null;
      }

      console.log("[UnifiedGeneration] Content generated, length:", generatedContent.length);

      // 5. Parse structured content if applicable
      const structuredContent = parseStructuredContent(generatedContent, format, allImages);

      // 6. Build result
      const result: GenerationResult = {
        content: generatedContent,
        images: allImages,
        structuredContent: Object.keys(structuredContent).length > 0 ? structuredContent : undefined,
      };

      // Success toast
      const sourceCount = extractedRefs.sources.length;
      const imageCount = allImages.length;
      
      toast({
        title: "Conteúdo gerado!",
        description: imageCount > 0 
          ? `Conteúdo criado com ${imageCount} imagem(s)${sourceCount > 0 ? ` e ${sourceCount} fonte(s)` : ''}.`
          : sourceCount > 0 
            ? `Conteúdo criado com base em ${sourceCount} fonte(s) e contexto do cliente.`
            : "Conteúdo criado com base no título e contexto do cliente."
      });

      return result;
    } catch (error: any) {
      console.error("[UnifiedGeneration] Generation failed:", error);
      
      // Check if it's a token error (402)
      const isTokenError = await handleTokenError(error, error?.status);
      if (!isTokenError) {
        toast({
          title: "Erro ao gerar conteúdo",
          description: error instanceof Error ? error.message : "Tente novamente em alguns instantes.",
          variant: "destructive"
        });
      }
      return null;
    } finally {
      setIsGenerating(false);
      setIsFetchingReferences(false);
    }
  };

  return {
    generate,
    isGenerating,
    isFetchingReferences,
  };
}

// Re-export types for convenience
export type { TweetItem, SlideItem, StructuredContent, ExtractedReferences };
