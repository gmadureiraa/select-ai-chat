import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
  TrendingUp, 
  Lightbulb, 
  BarChart3, 
  MessageSquare, 
  Sparkles 
} from "lucide-react";

interface QuickSuggestionsProps {
  onSelect: (suggestion: string) => void;
  clientName?: string;
  isContentTemplate?: boolean;
}

const freeChatSuggestions = [
  { text: "Métricas da semana", icon: TrendingUp },
  { text: "Análise de engajamento", icon: BarChart3 },
  { text: "Ideias de conteúdo", icon: Lightbulb },
  { text: "Resumo do cliente", icon: MessageSquare },
];

const contentSuggestions = [
  { text: "Crie um conteúdo sobre tendências", icon: TrendingUp },
  { text: "Gere ideias criativas", icon: Lightbulb },
  { text: "Analise a concorrência", icon: BarChart3 },
  { text: "Sugira melhorias de copy", icon: Sparkles },
];

export const QuickSuggestions = ({ 
  onSelect, 
  clientName,
  isContentTemplate = false 
}: QuickSuggestionsProps) => {
  const suggestions = isContentTemplate ? contentSuggestions : freeChatSuggestions;

  return (
    <div className="flex flex-wrap gap-2 justify-center max-w-lg">
      {suggestions.map((suggestion) => (
        <Button
          key={suggestion.text}
          variant="outline"
          size="sm"
          className={cn(
            "rounded-full border-border/60 hover:border-primary/40 hover:bg-primary/5",
            "text-xs font-medium transition-all gap-1.5"
          )}
          onClick={() => onSelect(suggestion.text)}
        >
          <suggestion.icon className="h-3 w-3 opacity-60" />
          {suggestion.text}
        </Button>
      ))}
    </div>
  );
};
