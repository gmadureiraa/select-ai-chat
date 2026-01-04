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

const platformToFormat: Record<string, string> = {
  instagram: 'post-instagram',
  twitter: 'post-twitter',
  linkedin: 'post-linkedin',
  youtube: 'thumbnail-youtube',
  newsletter: 'header-newsletter',
  blog: 'cover-blog',
  tiktok: 'story-tiktok',
  other: 'post-instagram',
};

const platformToAspectRatio: Record<string, string> = {
  instagram: '1:1',
  twitter: '16:9',
  linkedin: '1.91:1',
  youtube: '16:9',
  newsletter: '3:1',
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
          photographic: 'Crie uma imagem fotográfica realista e profissional',
          illustration: 'Crie uma ilustração artística e criativa',
          minimalist: 'Crie uma imagem minimalista, clean e com poucos elementos',
          vibrant: 'Crie uma imagem vibrante com cores intensas e alto contraste',
        };
        prompt = styleDescriptions[options.style] + '. ';
      } else {
        prompt = 'Crie uma imagem para redes sociais. ';
      }

      // Add cover/thumbnail context
      if (options.isCover) {
        prompt += `Esta será uma imagem de capa/thumbnail para ${platform}. `;
      }

      // Add no-text constraint
      if (options.noText) {
        prompt += 'IMPORTANTE: NÃO inclua nenhum texto, letras ou números na imagem. ';
      }

      // Add content context
      const contentSummary = content.length > 300 ? content.substring(0, 300) + '...' : content;
      prompt += `O tema do conteúdo é: "${contentSummary}". `;

      // Add additional user instructions
      if (options.additionalPrompt.trim()) {
        prompt += `Instruções adicionais: ${options.additionalPrompt}`;
      }

      const imageFormat = platformToFormat[platform] || 'post-instagram';
      const aspectRatio = platformToAspectRatio[platform] || '1:1';

      console.log('[usePlanningImageGeneration] Generating image:', { 
        format: imageFormat, 
        aspectRatio, 
        promptLength: prompt.length 
      });

      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: {
          prompt,
          clientId,
          imageFormat,
          aspectRatio,
          templateName: contentType === 'carousel' ? 'carousel-slide' : undefined,
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
      
      if (message.includes('tokens')) {
        toast({
          title: 'Sem tokens suficientes',
          description: 'Seu workspace não possui tokens suficientes para gerar imagens.',
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
