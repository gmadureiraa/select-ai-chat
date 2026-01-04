import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Sparkles, ImagePlus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageGenerationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: string;
  platform: string;
  contentType: string;
  onGenerate: (options: ImageGenerationOptions) => Promise<string | null>;
  isGenerating: boolean;
}

export interface ImageGenerationOptions {
  additionalPrompt: string;
  noText: boolean;
  isCover: boolean;
  style: 'photographic' | 'illustration' | 'minimalist' | 'vibrant' | '';
}

const styleOptions = [
  { value: '', label: 'Automático', description: 'Baseado nas referências do cliente' },
  { value: 'photographic', label: 'Fotográfico', description: 'Imagem realista e profissional' },
  { value: 'illustration', label: 'Ilustração', description: 'Estilo artístico e criativo' },
  { value: 'minimalist', label: 'Minimalista', description: 'Clean e com poucos elementos' },
  { value: 'vibrant', label: 'Vibrante', description: 'Cores intensas e alto contraste' },
];

export function ImageGenerationModal({
  open,
  onOpenChange,
  content,
  platform,
  contentType,
  onGenerate,
  isGenerating
}: ImageGenerationModalProps) {
  const [options, setOptions] = useState<ImageGenerationOptions>({
    additionalPrompt: '',
    noText: false,
    isCover: false,
    style: ''
  });

  const handleGenerate = async () => {
    const imageUrl = await onGenerate(options);
    if (imageUrl) {
      onOpenChange(false);
      setOptions({ additionalPrompt: '', noText: false, isCover: false, style: '' });
    }
  };

  const getFormatLabel = () => {
    const formats: Record<string, string> = {
      instagram: 'Instagram Post (1:1)',
      twitter: 'Twitter/X (16:9)',
      linkedin: 'LinkedIn (1.91:1)',
      youtube: 'YouTube Thumbnail (16:9)',
      newsletter: 'Newsletter Header',
      blog: 'Blog Cover',
      tiktok: 'TikTok (9:16)',
    };
    return formats[platform] || 'Imagem';
  };

  const contentPreview = content.length > 200 ? content.substring(0, 200) + '...' : content;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Gerar Imagem com IA
          </DialogTitle>
          <DialogDescription>
            Gere uma imagem baseada no conteúdo para {getFormatLabel()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Content preview */}
          {content && (
            <div className="p-3 bg-muted rounded-lg">
              <Label className="text-xs text-muted-foreground">Conteúdo base:</Label>
              <p className="text-sm mt-1 line-clamp-3">{contentPreview}</p>
            </div>
          )}

          {/* Style selection */}
          <div className="space-y-2">
            <Label>Estilo Visual</Label>
            <div className="grid grid-cols-2 gap-2">
              {styleOptions.map((style) => (
                <button
                  key={style.value}
                  type="button"
                  onClick={() => setOptions(prev => ({ ...prev, style: style.value as any }))}
                  className={cn(
                    "p-3 rounded-lg border text-left transition-all",
                    options.style === style.value 
                      ? "border-primary bg-primary/5" 
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <div className="font-medium text-sm">{style.label}</div>
                  <div className="text-xs text-muted-foreground">{style.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Quick options */}
          <div className="space-y-3">
            <Label>Opções Rápidas</Label>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox 
                  checked={options.noText} 
                  onCheckedChange={(checked) => setOptions(prev => ({ ...prev, noText: !!checked }))}
                />
                <span className="text-sm">Sem texto na imagem</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox 
                  checked={options.isCover} 
                  onCheckedChange={(checked) => setOptions(prev => ({ ...prev, isCover: !!checked }))}
                />
                <span className="text-sm">Imagem de capa</span>
              </label>
            </div>
          </div>

          {/* Additional prompt */}
          <div className="space-y-2">
            <Label htmlFor="additional-prompt">Instruções Adicionais (opcional)</Label>
            <Textarea
              id="additional-prompt"
              value={options.additionalPrompt}
              onChange={(e) => setOptions(prev => ({ ...prev, additionalPrompt: e.target.value }))}
              placeholder="Ex: incluir elementos de tecnologia, usar cores frias, foco em produto..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isGenerating}>
            Cancelar
          </Button>
          <Button onClick={handleGenerate} disabled={isGenerating || !content.trim()}>
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <ImagePlus className="h-4 w-4 mr-2" />
                Gerar Imagem
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
