import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { ImageGenerationOptions } from '@/components/planning/ImageGenerationModal';

interface GenerateImageParams {
  content: string;
  platform: string;
  contentType: string;
  clientId: string;
  options: ImageGenerationOptions;
}

const platformToAspectRatio: Record<string, string> = {
  instagram: '1:1',
  twitter: '16:9',
  linkedin: '16:9',
  youtube: '16:9',
  newsletter: '16:9',
  blog: '16:9',
  tiktok: '9:16',
  other: '1:1',
};

export function usePlanningImageGeneration(clientId: string) {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const generateImage = async ({
    content,
    platform,
    contentType,
    options
  }: Omit<GenerateImageParams, 'clientId'>): Promise<string | null> => {
    if (!content.trim()) {
      toast({
        title: 'Conteúdo necessário',
        description: 'Escreva o conteúdo do post antes de gerar a imagem.',
        variant: 'destructive'
      });
      return null;
    }

    setIsGenerating(true);

    try {
      // Build the prompt based on content and options
      let prompt = '';
      
      // Start with style preference
      if (options.style) {
        const styleDescriptions: Record<string, string> = {
          photographic: 'Create a realistic professional photograph',
          illustration: 'Create an artistic and creative illustration',
          minimalist: 'Create a minimalist, clean image with few elements',
          vibrant: 'Create a vibrant image with intense colors and high contrast',
        };
        prompt = styleDescriptions[options.style] + '. ';
      } else {
        prompt = 'Create a professional social media image. ';
      }

      // Add cover/thumbnail context
      if (options.isCover) {
        prompt += `This will be a cover/thumbnail image for ${platform}. `;
      }

      // Add no-text constraint
      if (options.noText) {
        prompt += 'CRITICAL: DO NOT include ANY text, words, letters, or numbers in the image. ';
      }

      // Add content context
      const contentSummary = content.length > 300 ? content.substring(0, 300) + '...' : content;
      prompt += `The content theme is: "${contentSummary}". `;

      // Add additional user instructions
      if (options.additionalPrompt.trim()) {
        prompt += `Additional instructions: ${options.additionalPrompt}`;
      }

      const aspectRatio = platformToAspectRatio[platform] || '1:1';

      console.log('[usePlanningImageGeneration] Generating image via generate-content-v2:', { 
        aspectRatio, 
        promptLength: prompt.length,
        noText: options.noText,
      });

      // Use generate-content-v2 which automatically fetches client_visual_references
      // and uses multimodal input with the pro model for style consistency
      const { data, error } = await supabase.functions.invoke('generate-content-v2', {
        body: {
          type: 'image',
          inputs: [{ type: 'text', content: prompt }],
          config: {
            format: contentType === 'carousel' ? 'carousel' : 'post',
            platform,
            aspectRatio,
            noText: options.noText !== false, // default true
          },
          clientId,
        }
      });

      if (error) {
        console.error('[usePlanningImageGeneration] Error:', error);
        throw new Error(error.message || 'Erro ao gerar imagem');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const imageUrl = data?.imageUrl || data?.image_url;
      
      if (!imageUrl) {
        throw new Error('Nenhuma imagem foi gerada');
      }

      toast({
        title: 'Imagem gerada!',
        description: 'A imagem foi adicionada às mídias do post.',
      });

      return imageUrl;
    } catch (error) {
      console.error('[usePlanningImageGeneration] Error:', error);
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      
      if (message.includes('tokens') || message.includes('402')) {
        toast({
          title: 'Sem tokens suficientes',
          description: 'Seu workspace não possui tokens suficientes para gerar imagens.',
          variant: 'destructive'
        });
      } else if (message.includes('429') || message.includes('Rate limit')) {
        toast({
          title: 'Limite de requisições',
          description: 'Aguarde um momento e tente novamente.',
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Erro ao gerar imagem',
          description: message,
          variant: 'destructive'
        });
      }
      
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    generateImage,
    isGenerating,
  };
}
