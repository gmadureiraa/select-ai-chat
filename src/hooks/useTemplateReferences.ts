import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TemplateRule, StyleAnalysis } from "@/types/template";

export interface ProcessedReferences {
  textRules: string[];
  imageReferences: Array<{ url: string; description: string }>;
  contentReferences: Array<{ content: string; description: string }>;
  styleAnalysis?: StyleAnalysis;
}

/**
 * Hook to fetch and process template references
 * Handles image references, content references, text rules, and style analysis
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
      let styleAnalysis: StyleAnalysis | undefined;

      for (const rule of rules) {
        const ruleData = rule as any; // Use any for JSON data

        // Check for style analysis rule first
        if (ruleData.styleAnalysis) {
          styleAnalysis = ruleData.styleAnalysis;
          continue;
        }

        if (ruleData.type === 'image_reference' && ruleData.file_url) {
          // Try public URL first, fallback to signed URL
          let imageUrl = ruleData.file_url;
          
          // Check if it's a storage path (not a full URL)
          if (!imageUrl.startsWith('http')) {
            const { data: signedData } = await supabase.storage
              .from('client-files')
              .createSignedUrl(imageUrl, 3600);
            
            if (signedData?.signedUrl) {
              imageUrl = signedData.signedUrl;
            }
          }
          
          imageReferences.push({
            url: imageUrl,
            description: ruleData.content,
          });
        } else if (ruleData.type === 'content_reference' && ruleData.file_url) {
          try {
            let contentUrl = ruleData.file_url;
            
            // If it's a storage path, get signed URL
            if (!contentUrl.startsWith('http')) {
              const { data: signedData } = await supabase.storage
                .from('client-files')
                .createSignedUrl(contentUrl, 3600);
              
              if (signedData?.signedUrl) {
                contentUrl = signedData.signedUrl;
              }
            }
            
            // Fetch content from the file
            const response = await fetch(contentUrl);
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

      return { textRules, imageReferences, contentReferences, styleAnalysis };
    },
    enabled: !!template,
  });

  return {
    template,
    references: processedReferences || { textRules: [], imageReferences: [], contentReferences: [] },
    isLoading: isLoading || isProcessing,
  };
};
