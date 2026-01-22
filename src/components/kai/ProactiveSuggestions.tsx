import { memo } from "react";
import { Lightbulb, TrendingUp, Calendar, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useProactiveSuggestions } from "@/hooks/useProactiveSuggestions";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface ProactiveSuggestionsProps {
  clientId: string;
  onUseSuggestion: (suggestion: string) => void;
}

const ICON_MAP: Record<string, typeof Lightbulb> = {
  content_idea: Lightbulb,
  trend_alert: TrendingUp,
  calendar_gap: Calendar,
  best_time: Sparkles,
};

const COLOR_MAP: Record<string, string> = {
  content_idea: "text-amber-500 bg-amber-500/10",
  trend_alert: "text-green-500 bg-green-500/10",
  calendar_gap: "text-blue-500 bg-blue-500/10",
  best_time: "text-purple-500 bg-purple-500/10",
};

export const ProactiveSuggestions = memo(function ProactiveSuggestions({
  clientId,
  onUseSuggestion,
}: ProactiveSuggestionsProps) {
  const { suggestions, isLoading, dismissSuggestion, useSuggestion: markSuggestionUsed } =
    useProactiveSuggestions(clientId);

  if (isLoading || suggestions.length === 0) {
    return null;
  }

  const handleUseSuggestion = (suggestion: (typeof suggestions)[0]) => {
    markSuggestionUsed(suggestion.id);
    onUseSuggestion(suggestion.title);
  };

  return (
    <div className="space-y-2 mb-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
        <Sparkles className="h-3 w-3" />
        <span>Sugestões baseadas nas suas métricas</span>
      </div>

      <AnimatePresence mode="popLayout">
        {suggestions.slice(0, 3).map((suggestion) => {
          const Icon = ICON_MAP[suggestion.suggestion_type] || Lightbulb;
          const colorClass = COLOR_MAP[suggestion.suggestion_type] || "text-primary bg-primary/10";

          return (
            <motion.div
              key={suggestion.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <Card
                className={cn(
                  "p-3 cursor-pointer transition-all hover:shadow-md",
                  "border-l-2 border-l-primary/50"
                )}
                onClick={() => handleUseSuggestion(suggestion)}
              >
                <div className="flex items-start gap-3">
                  <div className={cn("p-1.5 rounded-md", colorClass)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-clamp-1">
                      {suggestion.title}
                    </p>
                    {suggestion.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {suggestion.description}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      dismissSuggestion(suggestion.id);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
});
