import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Lightbulb, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageActionButtonsProps {
  postContent: string;
  onGenerateImage: (prompt: string) => void;
  onRequestIdeas: (prompt: string) => void;
  isLoading?: boolean;
}

export const ImageActionButtons = ({
  postContent,
  onGenerateImage,
  onRequestIdeas,
  isLoading = false,
}: ImageActionButtonsProps) => {
  const [mode, setMode] = useState<"idle" | "generating" | "ideas">("idle");

  const handleGenerateImage = () => {
    setMode("generating");
    const prompt = `Gere uma imagem complementar para este post de rede social. A imagem deve ser visual e criativa, SEM texto ou título na imagem, apenas elementos visuais que representem o conteúdo. Estilo moderno e profissional.

Conteúdo do post:
${postContent.substring(0, 500)}`;
    
    onGenerateImage(prompt);
  };

  const handleRequestIdeas = () => {
    setMode("ideas");
    const prompt = `Me dê 4 ideias de imagens criativas para acompanhar este post de rede social. Cada ideia deve:
- Ser visual e complementar ao texto (sem texto na imagem)
- Representar o conteúdo de forma criativa
- Seguir tendências visuais modernas

Conteúdo do post:
${postContent.substring(0, 500)}

Liste as 4 ideias de forma breve e objetiva, numeradas.`;
    
    onRequestIdeas(prompt);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleGenerateImage}
        disabled={isLoading}
        className={cn(
          "h-7 text-xs gap-1.5 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20",
          "hover:from-primary/10 hover:to-primary/20 hover:border-primary/40"
        )}
      >
        {isLoading && mode === "generating" ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Sparkles className="h-3 w-3" />
        )}
        Gerar imagem
      </Button>
      
      <Button
        variant="outline"
        size="sm"
        onClick={handleRequestIdeas}
        disabled={isLoading}
        className={cn(
          "h-7 text-xs gap-1.5 bg-gradient-to-r from-amber-500/5 to-amber-500/10 border-amber-500/20",
          "hover:from-amber-500/10 hover:to-amber-500/20 hover:border-amber-500/40"
        )}
      >
        {isLoading && mode === "ideas" ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Lightbulb className="h-3 w-3" />
        )}
        Ideias de imagem
      </Button>
    </>
  );
};
