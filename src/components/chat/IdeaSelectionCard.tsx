import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Lightbulb, 
  Sparkles, 
  ChevronRight, 
  RefreshCw,
  Image as ImageIcon,
  CalendarPlus,
  Copy,
  Check
} from "lucide-react";
import { GeneratedIdea } from "@/hooks/useIdeaGenerationPipeline";
import { cn } from "@/lib/utils";

interface IdeaSelectionCardProps {
  ideas: GeneratedIdea[];
  isLoading?: boolean;
  onSelectIdea: (idea: GeneratedIdea) => void;
  onRegenerateIdeas?: () => void;
  onAddToPlanning?: (idea: GeneratedIdea) => void;
}

export const IdeaSelectionCard = ({
  ideas,
  isLoading,
  onSelectIdea,
  onRegenerateIdeas,
  onAddToPlanning,
}: IdeaSelectionCardProps) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedIdeaId, setSelectedIdeaId] = useState<string | null>(null);

  const handleCopy = async (idea: GeneratedIdea) => {
    const text = `${idea.title}\n\n${idea.description}`;
    await navigator.clipboard.writeText(text);
    setCopiedId(idea.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSelect = (idea: GeneratedIdea) => {
    setSelectedIdeaId(idea.id);
    onSelectIdea(idea);
  };

  if (ideas.length === 0 && !isLoading) return null;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Lightbulb className="h-4 w-4 text-primary" />
            </div>
            <span>Ideias Geradas</span>
            <Badge variant="secondary" className="ml-2">
              {ideas.length} {ideas.length === 1 ? "ideia" : "ideias"}
            </Badge>
          </CardTitle>
          {onRegenerateIdeas && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRegenerateIdeas}
              disabled={isLoading}
              className="text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={cn("h-4 w-4 mr-1", isLoading && "animate-spin")} />
              Regenerar
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Escolha uma ideia para desenvolver o conteúdo completo
        </p>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {ideas.map((idea, index) => (
          <div
            key={idea.id}
            className={cn(
              "group relative p-4 rounded-lg border transition-all duration-200",
              "hover:border-primary/50 hover:bg-primary/5",
              selectedIdeaId === idea.id && "border-primary bg-primary/10"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                    {index + 1}
                  </span>
                  <h4 className="font-semibold text-sm truncate">{idea.title}</h4>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2 ml-8">
                  {idea.description}
                </p>
                {idea.inspiration && (
                  <p className="text-xs text-muted-foreground/70 mt-1 ml-8 italic">
                    Inspirado em: {idea.inspiration}
                  </p>
                )}
              </div>
              
              <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  size="sm"
                  variant={selectedIdeaId === idea.id ? "default" : "secondary"}
                  onClick={() => handleSelect(idea)}
                  disabled={isLoading}
                  className="whitespace-nowrap"
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  Desenvolver
                </Button>
                
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => handleCopy(idea)}
                  >
                    {copiedId === idea.id ? (
                      <Check className="h-3 w-3 text-green-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                  
                  {onAddToPlanning && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => onAddToPlanning(idea)}
                    >
                      <CalendarPlus className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-2 text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span className="text-sm">Gerando ideias criativas...</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

interface ContentActionButtonsProps {
  content: string;
  imageUrl?: string | null;
  onGenerateImage?: () => void;
  onAddToPlanning?: () => void;
  onRevise?: () => void;
  isGeneratingImage?: boolean;
}

export const ContentActionButtons = ({
  content,
  imageUrl,
  onGenerateImage,
  onAddToPlanning,
  onRevise,
  isGeneratingImage,
}: ContentActionButtonsProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
      <Button
        size="sm"
        variant="outline"
        onClick={handleCopy}
      >
        {copied ? (
          <>
            <Check className="h-3 w-3 mr-1 text-green-500" />
            Copiado
          </>
        ) : (
          <>
            <Copy className="h-3 w-3 mr-1" />
            Copiar
          </>
        )}
      </Button>

      {onGenerateImage && !imageUrl && (
        <Button
          size="sm"
          variant="outline"
          onClick={onGenerateImage}
          disabled={isGeneratingImage}
        >
          {isGeneratingImage ? (
            <>
              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
              Gerando...
            </>
          ) : (
            <>
              <ImageIcon className="h-3 w-3 mr-1" />
              Gerar Imagem
            </>
          )}
        </Button>
      )}

      {onAddToPlanning && (
        <Button
          size="sm"
          variant="default"
          onClick={onAddToPlanning}
        >
          <CalendarPlus className="h-3 w-3 mr-1" />
          Adicionar ao Planejamento
        </Button>
      )}

      {onRevise && (
        <Button
          size="sm"
          variant="ghost"
          onClick={onRevise}
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Revisar
        </Button>
      )}
    </div>
  );
};
