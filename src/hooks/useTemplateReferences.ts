import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TemplateRule } from "@/types/template";

export interface ProcessedReferences {
  textRules: string[];
  imageReferences: Array<{ url: string; description: string }>;
  contentReferences: Array<{ content: string; description: string }>;
}

/**
 * Hook to fetch and process template references
 * Handles image references, content references, and text rules
 */
export const useTemplateReferences = (templateId?: string) => {
  const { data: template, isLoading } = useQuery({
    queryKey: ["template-references", templateId],
    queryFn: async () => {
      if (!templateId) return null;

      const { data, error } = await supabase
        .from("client_templates")
        .select("*")
        .eq("id", templateId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!templateId,
  });

  const { data: processedReferences, isLoading: isProcessing } = useQuery({
    queryKey: ["processed-references", templateId],
    queryFn: async (): Promise<ProcessedReferences> => {
      if (!template || !template.rules) {
        return { textRules: [], imageReferences: [], contentReferences: [] };
      }

      const rules = Array.isArray(template.rules) ? template.rules : [];
      const textRules: string[] = [];
      const imageReferences: Array<{ url: string; description: string }> = [];
      const contentReferences: Array<{ content: string; description: string }> = [];

      for (const rule of rules) {
        const ruleData = rule as any; // Use any for JSON data

        if (ruleData.type === 'image_reference' && ruleData.file_url) {
          imageReferences.push({
            url: ruleData.file_url,
            description: ruleData.content,
          });
        } else if (ruleData.type === 'content_reference' && ruleData.file_url) {
          try {
            // Fetch content from the file
            const response = await fetch(ruleData.file_url);
            const text = await response.text();
            
            contentReferences.push({
              content: text.substring(0, 5000), // Limit to 5000 chars
              description: ruleData.content,
            });
          } catch (error) {
            console.error('Error fetching content reference:', error);
            contentReferences.push({
              content: `[Erro ao carregar: ${ruleData.content}]`,
              description: ruleData.content,
            });
          }
        } else {
          // Regular text rule
          textRules.push(ruleData.content);
        }
      }

      return { textRules, imageReferences, contentReferences };
    },
    enabled: !!template,
  });

  return {
    template,
    references: processedReferences || { textRules: [], imageReferences: [], contentReferences: [] },
    isLoading: isLoading || isProcessing,
  };
};
