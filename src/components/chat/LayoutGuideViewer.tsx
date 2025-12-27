import { useState } from "react";
import { 
  Palette, 
  Image as ImageIcon, 
  ChevronDown,
  Copy,
  Check,
  Wand2
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export interface LayoutSlide {
  slideNumber: number;
  mainText: string;
  mainTextStyle?: { font?: string; size?: string; color?: string };
  secondaryText?: string;
  secondaryTextStyle?: { font?: string; size?: string; color?: string };
  background?: string;
  imagePrompt?: string;
}

export interface LayoutGuide {
  slides: LayoutSlide[];
  generalNotes?: string;
}

interface LayoutGuideViewerProps {
  layoutGuide: LayoutGuide;
  onGenerateImage?: (prompt: string, slideNumber: number) => void;
  isGeneratingImage?: boolean;
}

export const LayoutGuideViewer = ({ 
  layoutGuide, 
  onGenerateImage,
  isGeneratingImage 
}: LayoutGuideViewerProps) => {
  const [openSlides, setOpenSlides] = useState<Record<number, boolean>>({});
  const [copiedPrompt, setCopiedPrompt] = useState<number | null>(null);
  const { toast } = useToast();

  const toggleSlide = (slideNumber: number) => {
    setOpenSlides(prev => ({ ...prev, [slideNumber]: !prev[slideNumber] }));
  };

  const copyPrompt = async (prompt: string, slideNumber: number) => {
    await navigator.clipboard.writeText(prompt);
    setCopiedPrompt(slideNumber);
    setTimeout(() => setCopiedPrompt(null), 2000);
    toast({ description: "Prompt copiado!" });
  };

  if (!layoutGuide.slides || layoutGuide.slides.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 space-y-2 text-xs border border-border/50 rounded-lg p-3 bg-muted/20">
      <div className="flex items-center gap-2 text-sm font-medium mb-2">
        <Palette className="h-4 w-4 text-primary" />
        Guia de Layout
        <Badge variant="secondary" className="h-5 text-[10px]">
          {layoutGuide.slides.length} slides
        </Badge>
      </div>

      <div className="space-y-2">
        {layoutGuide.slides.map((slide) => (
          <Collapsible 
            key={slide.slideNumber}
            open={openSlides[slide.slideNumber]} 
            onOpenChange={() => toggleSlide(slide.slideNumber)}
          >
            <CollapsibleTrigger className="flex items-center gap-2 w-full text-left hover:bg-muted/50 rounded-md px-2 py-1.5 transition-colors">
              <Badge variant="outline" className="h-5 text-[10px] px-1.5 min-w-[50px]">
                Slide {slide.slideNumber}
              </Badge>
              <span className="flex-1 truncate text-muted-foreground text-[11px]">
                {slide.mainText.substring(0, 40)}...
              </span>
              {slide.imagePrompt && (
                <ImageIcon className="h-3.5 w-3.5 text-amber-500" />
              )}
              <ChevronDown className={cn(
                "h-3.5 w-3.5 text-muted-foreground transition-transform",
                openSlides[slide.slideNumber] && "rotate-180"
              )} />
            </CollapsibleTrigger>
            
            <CollapsibleContent className="pl-4 pt-2 space-y-2">
              {/* Main text */}
              <div className="p-2 rounded bg-background/50 border border-border/30">
                <div className="text-[10px] text-muted-foreground mb-1">Texto Principal</div>
                <div className="font-medium text-foreground">{slide.mainText}</div>
                {slide.mainTextStyle && (
                  <div className="flex gap-2 mt-1 text-[10px] text-muted-foreground">
                    {slide.mainTextStyle.font && <span>Fonte: {slide.mainTextStyle.font}</span>}
                    {slide.mainTextStyle.size && <span>Tamanho: {slide.mainTextStyle.size}</span>}
                    {slide.mainTextStyle.color && (
                      <span className="flex items-center gap-1">
                        Cor: 
                        <span 
                          className="inline-block w-3 h-3 rounded-full border border-border"
                          style={{ backgroundColor: slide.mainTextStyle.color }}
                        />
                        {slide.mainTextStyle.color}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Secondary text */}
              {slide.secondaryText && (
                <div className="p-2 rounded bg-background/50 border border-border/30">
                  <div className="text-[10px] text-muted-foreground mb-1">Texto Secundário</div>
                  <div className="text-foreground/80">{slide.secondaryText}</div>
                  {slide.secondaryTextStyle && (
                    <div className="flex gap-2 mt-1 text-[10px] text-muted-foreground">
                      {slide.secondaryTextStyle.font && <span>Fonte: {slide.secondaryTextStyle.font}</span>}
                      {slide.secondaryTextStyle.size && <span>Tamanho: {slide.secondaryTextStyle.size}</span>}
                      {slide.secondaryTextStyle.color && (
                        <span className="flex items-center gap-1">
                          Cor:
                          <span 
                            className="inline-block w-3 h-3 rounded-full border border-border"
                            style={{ backgroundColor: slide.secondaryTextStyle.color }}
                          />
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Background */}
              {slide.background && (
                <div className="text-[10px] text-muted-foreground">
                  <span className="font-medium">Fundo:</span> {slide.background}
                </div>
              )}

              {/* Image Prompt */}
              {slide.imagePrompt && (
                <div className="p-2 rounded bg-amber-500/10 border border-amber-500/30">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                      <ImageIcon className="h-3 w-3" />
                      Prompt de Imagem
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1.5 text-[9px]"
                        onClick={() => copyPrompt(slide.imagePrompt!, slide.slideNumber)}
                      >
                        {copiedPrompt === slide.slideNumber ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                      {onGenerateImage && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 px-1.5 text-[9px] text-primary"
                          onClick={() => onGenerateImage(slide.imagePrompt!, slide.slideNumber)}
                          disabled={isGeneratingImage}
                        >
                          <Wand2 className="h-3 w-3 mr-0.5" />
                          Gerar
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="text-[11px] text-foreground/80 italic">
                    {slide.imagePrompt}
                  </div>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>

      {layoutGuide.generalNotes && (
        <div className="pt-2 border-t border-border/30 text-[10px] text-muted-foreground">
          <span className="font-medium">Notas:</span> {layoutGuide.generalNotes}
        </div>
      )}
    </div>
  );
};
