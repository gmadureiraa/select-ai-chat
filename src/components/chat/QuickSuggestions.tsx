import { Button } from "@/components/ui/button";
import {
  Sparkles,
  BarChart3,
  Lightbulb,
  Calendar,
  Instagram,
  Twitter,
  Linkedin,
  Flame,
} from "lucide-react";

interface QuickSuggestionsProps {
  onSelect: (suggestion: string) => void;
  clientId?: string;
  clientName?: string;
  isContentTemplate?: boolean;
}

interface SuggestionGroup {
  title: string;
  items: {
    icon: typeof Sparkles;
    label: string;
    prompt: (clientName?: string) => string;
  }[];
}

const groups: SuggestionGroup[] = [
  {
    title: "Criar conteúdo",
    items: [
      {
        icon: Instagram,
        label: "Post Instagram",
        prompt: (c) => `Crie um post para Instagram${c ? ` do ${c}` : ""} com visual e legenda prontos para publicar.`,
      },
      {
        icon: Twitter,
        label: "Thread no X",
        prompt: (c) => `Monte uma thread de 5-7 tweets${c ? ` no tom do ${c}` : ""} sobre um tema relevante da semana.`,
      },
      {
        icon: Linkedin,
        label: "Artigo LinkedIn",
        prompt: (c) => `Escreva um post para LinkedIn${c ? ` do ${c}` : ""} com análise e opinião, 800-1200 caracteres.`,
      },
    ],
  },
  {
    title: "Estratégia",
    items: [
      {
        icon: Lightbulb,
        label: "5 ideias",
        prompt: (c) => `Me dê 5 ideias de conteúdo acionáveis${c ? ` para o ${c}` : ""} baseadas no que funcionou recentemente.`,
      },
      {
        icon: Calendar,
        label: "Planejar semana",
        prompt: (c) => `Crie um planejamento de conteúdo${c ? ` para o ${c}` : ""} pra semana que vem — 3 posts distribuídos, já com platform e tema.`,
      },
      {
        icon: Flame,
        label: "Tema viral",
        prompt: (c) => `Com base nos posts que mais bombaram${c ? ` do ${c}` : ""}, proponha um ângulo novo pra explorar essa semana.`,
      },
    ],
  },
  {
    title: "Analisar",
    items: [
      {
        icon: BarChart3,
        label: "Performance do mês",
        prompt: (c) => `Como está a performance${c ? ` do ${c}` : ""} nos últimos 30 dias? Me dê os 3 aprendizados mais úteis.`,
      },
      {
        icon: Sparkles,
        label: "Melhor post",
        prompt: (c) => `Qual foi o melhor post${c ? ` do ${c}` : ""} recente e por que funcionou?`,
      },
    ],
  },
];

export function QuickSuggestions({ onSelect, clientName }: QuickSuggestionsProps) {
  return (
    <div className="space-y-4 w-full max-w-2xl mx-auto">
      {groups.map((group) => (
        <div key={group.title} className="space-y-1.5">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/60 px-1">
            {group.title}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {group.items.map((s, i) => (
              <Button
                key={i}
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-8 bg-background/60 hover:bg-background hover:border-primary/40 transition-colors"
                onClick={() => onSelect(s.prompt(clientName))}
              >
                <s.icon className="h-3.5 w-3.5 text-muted-foreground" />
                {s.label}
              </Button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
