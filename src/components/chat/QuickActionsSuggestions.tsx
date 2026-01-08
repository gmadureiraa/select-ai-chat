import { Button } from "@/components/ui/button";
import { 
  ImageIcon, 
  FileText, 
  Lightbulb, 
  LayoutGrid, 
  RefreshCw,
  Rocket,
  CalendarPlus,
  Wand2
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ContentType = "idea" | "content" | "analysis" | "list" | "general";

interface QuickAction {
  icon: React.ElementType;
  label: string;
  prompt: string;
  variant?: "default" | "primary";
}

interface QuickActionsSuggestionsProps {
  contentType: ContentType;
  content: string;
  onAction: (prompt: string) => void;
  className?: string;
}

function getActionsForContentType(contentType: ContentType, content: string): QuickAction[] {
  const contentPreview = content.substring(0, 500);
  
  switch (contentType) {
    case "idea":
      return [
        {
          icon: Rocket,
          label: "Desenvolver",
          prompt: `Desenvolva esta ideia em um conteúdo completo e pronto para publicar:\n\n${contentPreview}`,
          variant: "primary"
        },
        {
          icon: ImageIcon,
          label: "Gerar imagem",
          prompt: `@imagem Crie uma imagem visual impactante para esta ideia:\n\n${contentPreview}`
        },
        {
          icon: LayoutGrid,
          label: "Carrossel",
          prompt: `Transforme esta ideia em um carrossel de Instagram com 5-7 slides:\n\n${contentPreview}`
        },
        {
          icon: Lightbulb,
          label: "Mais ideias",
          prompt: `Me dê mais 5 ideias relacionadas a este tema:\n\n${contentPreview}`
        }
      ];
      
    case "content":
      return [
        {
          icon: ImageIcon,
          label: "Gerar imagem",
          prompt: `@imagem Crie uma imagem visual impactante para este conteúdo:\n\n${contentPreview}`,
          variant: "primary"
        },
        {
          icon: CalendarPlus,
          label: "Agendar",
          prompt: `Adicione este conteúdo ao planejamento para a próxima semana`
        },
        {
          icon: RefreshCw,
          label: "Revisar",
          prompt: `Revise e melhore este conteúdo, mantendo a essência:\n\n${contentPreview}`
        },
        {
          icon: Wand2,
          label: "Adaptar formato",
          prompt: `Adapte este conteúdo para Stories de Instagram:\n\n${contentPreview}`
        }
      ];
      
    case "list":
      return [
        {
          icon: Rocket,
          label: "Desenvolver 1ª",
          prompt: `Desenvolva a primeira ideia da lista em um conteúdo completo:\n\n${contentPreview}`,
          variant: "primary"
        },
        {
          icon: FileText,
          label: "Todas em posts",
          prompt: `Transforme cada item da lista em um post curto e engajante:\n\n${contentPreview}`
        },
        {
          icon: Lightbulb,
          label: "Expandir lista",
          prompt: `Adicione mais 5 ideias a esta lista:\n\n${contentPreview}`
        }
      ];
      
    case "analysis":
      return [
        {
          icon: Lightbulb,
          label: "Sugestões",
          prompt: `Com base nesta análise, me dê sugestões práticas de melhoria:\n\n${contentPreview}`,
          variant: "primary"
        },
        {
          icon: FileText,
          label: "Relatório",
          prompt: `Transforme esta análise em um relatório executivo formatado`
        },
        {
          icon: Rocket,
          label: "Plano de ação",
          prompt: `Crie um plano de ação baseado nesta análise:\n\n${contentPreview}`
        }
      ];
      
    default:
      return [
        {
          icon: Lightbulb,
          label: "Continuar",
          prompt: `Continue desenvolvendo este tema:\n\n${contentPreview}`
        },
        {
          icon: ImageIcon,
          label: "Gerar imagem",
          prompt: `@imagem Crie uma imagem visual para:\n\n${contentPreview}`
        }
      ];
  }
}

export function detectContentType(content: string): ContentType {
  const lowerContent = content.toLowerCase();
  
  // Detect numbered or bulleted lists (likely ideas)
  const hasNumberedList = /^\s*(\d+[\.\)]|\-|\•|\*)\s+/m.test(content);
  const listItemCount = (content.match(/^\s*(\d+[\.\)]|\-|\•|\*)\s+/gm) || []).length;
  
  // Detect analysis patterns
  const analysisPatterns = [
    /análise|analis[ae]/i,
    /métricas|metrics/i,
    /engajamento|engagement/i,
    /crescimento|growth/i,
    /desempenho|performance/i,
    /comparando|comparing/i,
    /tendência|trend/i,
    /aumento de|queda de/i,
    /\d+%/,
    /alcance|reach/i,
  ];
  const isAnalysis = analysisPatterns.some(p => p.test(content));
  
  // Detect idea patterns
  const ideaPatterns = [
    /ideia[s]?:|sugestão|sugestões/i,
    /aqui estão.*ideias/i,
    /considere.*seguintes/i,
    /pode.*explorar/i,
    /algumas ideias/i,
    /opções para/i,
  ];
  const isIdea = ideaPatterns.some(p => p.test(content)) || (hasNumberedList && listItemCount >= 3);
  
  // Detect full content patterns
  const contentPatterns = [
    /post.*instagram|instagram.*post/i,
    /carrossel|carousel/i,
    /stories/i,
    /thread/i,
    /newsletter/i,
    /legendas?:/i,
    /título:/i,
    /slide \d+/i,
    /^\*\*.*\*\*$/m,
    /caption|legenda/i,
  ];
  const isContent = contentPatterns.some(p => p.test(content));
  
  // Priority: analysis > content > ideas > list > general
  if (isAnalysis && content.length > 200) return "analysis";
  if (isContent) return "content";
  if (isIdea) return "idea";
  if (hasNumberedList && listItemCount >= 2) return "list";
  
  return "general";
}

export function QuickActionsSuggestions({
  contentType,
  content,
  onAction,
  className
}: QuickActionsSuggestionsProps) {
  const actions = getActionsForContentType(contentType, content);
  
  if (actions.length === 0) return null;
  
  return (
    <div className={cn(
      "flex items-center gap-1.5 flex-wrap pt-1",
      className
    )}>
      {actions.map((action, index) => (
        <Button
          key={index}
          variant={action.variant === "primary" ? "default" : "outline"}
          size="sm"
          onClick={() => onAction(action.prompt)}
          className={cn(
            "h-7 text-xs gap-1.5 transition-all",
            action.variant === "primary" 
              ? "bg-primary/90 hover:bg-primary text-primary-foreground shadow-sm" 
              : "bg-muted/50 border-border/50 hover:bg-muted hover:border-border"
          )}
        >
          <action.icon className="h-3 w-3" />
          {action.label}
        </Button>
      ))}
    </div>
  );
}
