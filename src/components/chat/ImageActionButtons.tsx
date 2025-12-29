import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Lightbulb, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageActionButtonsProps {
  postContent: string;
  onGenerateImage: (prompt: string) => void;
  onRequestIdeas: (prompt: string) => void;
  isLoading?: boolean;
  platform?: string;
  clientName?: string;
}

// Helper to get format dimensions based on platform
const getFormatForPlatform = (platform?: string): string => {
  switch (platform?.toLowerCase()) {
    case "instagram":
      return "formato quadrado 1:1 (1080x1080px) para feed do Instagram";
    case "linkedin":
      return "formato horizontal 1.91:1 (1200x628px) para LinkedIn";
    case "twitter":
      return "formato horizontal 16:9 (1200x675px) para Twitter/X";
    case "youtube":
      return "formato horizontal 16:9 (1280x720px) para thumbnail do YouTube";
    case "tiktok":
      return "formato vertical 9:16 (1080x1920px) para TikTok/Reels";
    case "newsletter":
    case "blog":
      return "formato horizontal 16:9 (1200x675px) para blog/newsletter";
    default:
      return "formato quadrado 1:1 otimizado para redes sociais";
  }
};

export const ImageActionButtons = ({
  postContent,
  onGenerateImage,
  onRequestIdeas,
  isLoading = false,
  platform,
  clientName,
}: ImageActionButtonsProps) => {
  const [mode, setMode] = useState<"idle" | "generating" | "ideas">("idle");

  const formatSpec = getFormatForPlatform(platform);
  const platformName = platform ? platform.charAt(0).toUpperCase() + platform.slice(1) : "rede social";

  const handleGenerateImage = () => {
    setMode("generating");
    const prompt = `Gere uma imagem complementar para este post de ${platformName}.

FORMATO OBRIGATÓRIO:
- ${formatSpec}

ESTILO E IDENTIDADE:
${clientName ? `- Siga a identidade visual da marca "${clientName}"` : "- Estilo moderno e profissional"}
- Cores e elementos visuais que combinem com a marca
- Visual clean, impactante e atual

IMPORTANTE:
- NÃO incluir texto, títulos ou palavras na imagem
- A imagem deve ser 100% visual, complementando o texto abaixo
- Represente o tema e a mensagem de forma criativa e visual

CONTEÚDO A SER COMPLEMENTADO:
${postContent.substring(0, 600)}`;
    
    onGenerateImage(prompt);
  };

  const handleRequestIdeas = () => {
    setMode("ideas");
    const prompt = `Me dê 4 ideias de imagens criativas para acompanhar este post de ${platformName}. 

FORMATO: ${formatSpec}
${clientName ? `MARCA: ${clientName}` : ""}

Cada ideia deve:
- Ser 100% visual (sem texto na imagem)
- Complementar o conteúdo abaixo
- Seguir tendências visuais modernas
- Ser adaptada para o formato especificado

CONTEÚDO DO POST:
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
