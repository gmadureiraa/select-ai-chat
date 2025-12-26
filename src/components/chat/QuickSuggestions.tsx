import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useSmartSuggestions } from "@/hooks/useSmartSuggestions";
import { 
  TrendingUp, 
  Lightbulb, 
  BarChart3, 
  MessageSquare, 
  Sparkles 
} from "lucide-react";

interface QuickSuggestionsProps {
  onSelect: (suggestion: string) => void;
  clientId?: string;
  clientName?: string;
  isContentTemplate?: boolean;
}

// Fallback suggestions when no client is selected
const fallbackFreeChatSuggestions = [
  { text: "Métricas da semana", icon: TrendingUp },
  { text: "Análise de engajamento", icon: BarChart3 },
  { text: "Ideias de conteúdo", icon: Lightbulb },
  { text: "Resumo do cliente", icon: MessageSquare },
];

const fallbackContentSuggestions = [
  { text: "Crie um conteúdo sobre tendências", icon: TrendingUp },
  { text: "Gere ideias criativas", icon: Lightbulb },
  { text: "Analise a concorrência", icon: BarChart3 },
  { text: "Sugira melhorias de copy", icon: Sparkles },
];

export const QuickSuggestions = ({ 
  onSelect, 
  clientId,
  clientName,
  isContentTemplate = false 
}: QuickSuggestionsProps) => {
  // Use smart suggestions hook
  const { suggestions: smartSuggestions, isLoading } = useSmartSuggestions(
    clientId, 
    isContentTemplate
  );

  // Show loading skeleton
  if (isLoading && clientId) {
    return (
      <div className="flex flex-wrap gap-2 justify-center max-w-lg">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-8 w-32 rounded-full" />
        ))}
      </div>
    );
  }

  // Use smart suggestions if available, otherwise fall back to static ones
  const suggestions = clientId && smartSuggestions.length > 0
    ? smartSuggestions.map(s => ({ text: s.text, icon: s.icon }))
    : isContentTemplate 
      ? fallbackContentSuggestions 
      : fallbackFreeChatSuggestions;

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
