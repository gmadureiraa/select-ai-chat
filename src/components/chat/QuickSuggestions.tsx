import { Button } from "@/components/ui/button";
import { Sparkles, FileText, MessageCircle } from "lucide-react";

interface QuickSuggestionsProps {
  onSelect: (suggestion: string) => void;
  clientId?: string;
  clientName?: string;
  isContentTemplate?: boolean;
}

const suggestions = [
  { icon: Sparkles, label: "Gerar ideias", prompt: "Me dê 5 ideias de conteúdo para as próximas semanas" },
  { icon: FileText, label: "Analisar performance", prompt: "Analise a performance recente do meu conteúdo" },
  { icon: MessageCircle, label: "Brainstorm", prompt: "Vamos fazer um brainstorm de temas relevantes" },
];

export function QuickSuggestions({ onSelect, clientName }: QuickSuggestionsProps) {
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {suggestions.map((s, i) => (
        <Button
          key={i}
          variant="outline"
          size="sm"
          className="gap-2 text-xs"
          onClick={() => onSelect(clientName ? `${s.prompt} para ${clientName}` : s.prompt)}
        >
          <s.icon className="h-3.5 w-3.5" />
          {s.label}
        </Button>
      ))}
    </div>
  );
}
