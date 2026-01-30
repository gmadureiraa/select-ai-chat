import { useUnifiedContentGeneration } from "@/hooks/useUnifiedContentGeneration";

/**
 * Planning-specific wrapper around unified content generation
 * Maintains backward compatibility with existing planning dialog code
 */

interface GenerateContentParams {
  title: string;
  contentType: string;
  clientId: string;
  referenceInput?: string; // Can be URL, @mentions, or plain text
}

interface GenerateContentResult {
  content: string;
  images: string[];
}

export function usePlanningContentGeneration() {
  const unified = useUnifiedContentGeneration();

  const generateContent = async ({
    title,
    contentType,
    clientId,
    referenceInput
  }: GenerateContentParams): Promise<GenerateContentResult | null> => {
    const result = await unified.generate({
      title,
      format: contentType,
      clientId,
      referenceInput,
    });

    if (!result) return null;

    return {
      content: result.content,
      images: result.images,
    };
  };

  return {
    generateContent,
    isGenerating: unified.isGenerating,
    isFetchingReference: unified.isFetchingReferences,
  };
}
