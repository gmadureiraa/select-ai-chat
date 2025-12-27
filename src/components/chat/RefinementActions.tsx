import { useState } from "react";
import { 
  MessageCircle, 
  Scissors, 
  Target, 
  Code, 
  Heart,
  Zap,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RefinementOption {
  id: string;
  label: string;
  icon: React.ElementType;
  instruction: string;
}

const refinementOptions: RefinementOption[] = [
  { 
    id: "informal", 
    label: "Mais informal", 
    icon: MessageCircle, 
    instruction: "Reescreva de forma mais descontraída e casual, mantendo a informação" 
  },
  { 
    id: "concise", 
    label: "Mais conciso", 
    icon: Scissors, 
    instruction: "Encurte significativamente, mantendo apenas o essencial" 
  },
  { 
    id: "cta", 
    label: "CTA forte", 
    icon: Target, 
    instruction: "Fortaleça o Call-to-Action para gerar mais conversão e urgência" 
  },
  { 
    id: "technical", 
    label: "Mais técnico", 
    icon: Code, 
    instruction: "Use linguagem mais técnica e especializada" 
  },
  { 
    id: "emotional", 
    label: "Mais emocional", 
    icon: Heart, 
    instruction: "Adicione mais apelo emocional e storytelling" 
  },
];

interface RefinementActionsProps {
  onRefine: (instruction: string) => void;
  isRefining?: boolean;
  className?: string;
}

export const RefinementActions = ({ 
  onRefine, 
  isRefining = false,
  className 
}: RefinementActionsProps) => {
  const [activeRefinement, setActiveRefinement] = useState<string | null>(null);

  const handleRefine = (option: RefinementOption) => {
    setActiveRefinement(option.id);
    onRefine(option.instruction);
  };

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      <span className="text-[10px] text-muted-foreground mr-1 flex items-center">
        <Zap className="h-3 w-3 mr-0.5" />
        Ajustar:
      </span>
      {refinementOptions.map((option) => {
        const Icon = option.icon;
        const isActive = activeRefinement === option.id && isRefining;
        
        return (
          <Button
            key={option.id}
            variant="outline"
            size="sm"
            onClick={() => handleRefine(option)}
            disabled={isRefining}
            className={cn(
              "h-6 px-2 text-[10px] rounded-full border-border/50 bg-background/50 hover:bg-muted transition-colors",
              isActive && "bg-primary/10 border-primary/30"
            )}
          >
            {isActive ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Icon className="h-3 w-3 mr-1" />
            )}
            {option.label}
          </Button>
        );
      })}
    </div>
  );
};
