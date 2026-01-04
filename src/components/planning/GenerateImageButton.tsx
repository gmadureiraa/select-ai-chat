import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sparkles, Loader2, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface GenerateImageButtonProps {
  content: string;
  contentType: string;
  platform?: string;
  clientId?: string;
  onImageGenerated: (imageUrl: string) => void;
  className?: string;
}

export function GenerateImageButton({
  content,
  contentType,
  platform,
  clientId,
  onImageGenerated,
  className
}: GenerateImageButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [instructions, setInstructions] = useState('');

  const buildPromptFromContent = (): string => {
    let basePrompt = '';
    
    // Extract key content based on type
    if (contentType === 'thread') {
      // Use first tweet as main context
      const firstTweet = content.split(/\n---\n|\n\n/)[0] || content;
      basePrompt = `Imagem para thread: ${firstTweet.substring(0, 200)}`;
    } else if (contentType === 'carousel') {
      // Use first slide hook
      const firstSlide = content.split(/\n---\n/)[0] || content;
      basePrompt = `Imagem de capa para carrossel: ${firstSlide.substring(0, 200)}`;
    } else if (contentType === 'article' || platform === 'newsletter' || platform === 'blog') {
      // Extract title or first paragraph
      const lines = content.split('\n').filter(l => l.trim());
      const title = lines[0]?.replace(/^#+\s*/, '') || content.substring(0, 100);
      basePrompt = `Imagem de destaque para artigo: ${title}`;
    } else {
      // Generic post
      basePrompt = `Imagem para post: ${content.substring(0, 200)}`;
    }
    
    // Add platform context
    if (platform) {
      const platformFormats: Record<string, string> = {
        instagram: 'formato quadrado para Instagram',
        twitter: 'formato 16:9 para Twitter',
        linkedin: 'formato profissional para LinkedIn',
        youtube: 'thumbnail para YouTube',
        tiktok: 'formato vertical para TikTok',
        blog: 'imagem de destaque para blog',
        newsletter: 'imagem de header para newsletter',
      };
      if (platformFormats[platform]) {
        basePrompt += `. ${platformFormats[platform]}`;
      }
    }
    
    // Add user instructions
    if (instructions.trim()) {
      basePrompt += `. ${instructions}`;
    }
    
    return basePrompt;
  };

  const handleGenerate = async () => {
    if (!content.trim()) {
      toast.error('Adicione conteúdo antes de gerar uma imagem');
      return;
    }
    
    setIsGenerating(true);
    
    try {
      const prompt = buildPromptFromContent();
      
      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: {
          prompt,
          clientId,
          aspectRatio: platform === 'instagram' ? '1:1' : 
                       platform === 'tiktok' ? '9:16' : 
                       platform === 'youtube' ? '16:9' : '1:1',
        }
      });
      
      if (error) throw error;
      
      if (data?.imageUrl) {
        onImageGenerated(data.imageUrl);
        toast.success('Imagem gerada com sucesso!');
        setIsOpen(false);
        setInstructions('');
      } else {
        throw new Error('Nenhuma imagem retornada');
      }
    } catch (error: any) {
      console.error('Error generating image:', error);
      toast.error(error.message || 'Erro ao gerar imagem');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("gap-1.5", className)}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          Gerar Imagem
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-primary" />
            <h4 className="font-medium text-sm">Gerar Imagem com IA</h4>
          </div>
          
          <p className="text-xs text-muted-foreground">
            A imagem será gerada baseada no conteúdo do card. Adicione instruções extras se desejar.
          </p>
          
          <div className="space-y-1.5">
            <Label htmlFor="instructions" className="text-xs">
              Instruções (opcional)
            </Label>
            <Input
              id="instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Ex: Sem texto na imagem, estilo minimalista..."
              className="text-sm"
            />
          </div>
          
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsOpen(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleGenerate}
              disabled={isGenerating || !content.trim()}
              className="flex-1 gap-1"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Sparkles className="h-3 w-3" />
                  Gerar
                </>
              )}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
