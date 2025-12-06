import { CheckCircle2, Circle, Loader2, FileText, Sparkles, Search, Lightbulb, ExternalLink, ImageIcon } from "lucide-react";
import { ProcessStep } from "@/types/chat";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface WorkflowVisualizationProps {
  currentStep: ProcessStep;
  workflowState: {
    selectedMaterials: Array<{
      id: string;
      type: 'content_library' | 'document' | 'reference_library';
      category: string;
      title: string;
      reason?: string;
      source_url?: string;
    }>;
    reasoning?: string;
    strategy?: string;
    patternAnalysis?: string;
  };
  isIdeaMode?: boolean;
}

const stepsForIdeas = [
  { 
    key: "analyzing", 
    label: "Analisando Pedido", 
    description: "Identificando que você quer ideias",
    icon: Search
  },
  { 
    key: "selecting", 
    label: "Buscando na Biblioteca", 
    description: "Identificando temas que o cliente trabalha",
    icon: FileText
  },
  { 
    key: "analyzing_library", 
    label: "Analisando Temas", 
    description: "Extraindo temas e assuntos do cliente",
    icon: Lightbulb
  },
  { 
    key: "reviewing", 
    label: "Preparando Contexto", 
    description: "Organizando temas para gerar ideias novas",
    icon: Sparkles
  },
  { 
    key: "creating", 
    label: "Gerando Ideias", 
    description: "Criando ideias novas sobre os temas do cliente",
    icon: Sparkles
  },
];

const stepsForContent = [
  { 
    key: "analyzing", 
    label: "Analisando Pedido", 
    description: "Identificando o tipo de conteúdo",
    icon: Search
  },
  { 
    key: "selecting", 
    label: "Buscando Referências", 
    description: "Selecionando modelos de escrita",
    icon: FileText
  },
  { 
    key: "analyzing_library", 
    label: "Analisando Estilo", 
    description: "Extraindo tom, estrutura e padrões",
    icon: Lightbulb
  },
  { 
    key: "reviewing", 
    label: "Preparando Contexto", 
    description: "Organizando regras de escrita",
    icon: Sparkles
  },
  { 
    key: "creating", 
    label: "Escrevendo Conteúdo", 
    description: "Gerando conteúdo no estilo do cliente",
    icon: Sparkles
  },
];

const stepsForImage = [
  { 
    key: "analyzing", 
    label: "Análise Inicial", 
    description: "Entendendo a solicitação",
    icon: Search
  },
  { 
    key: "generating_image", 
    label: "Gerando Imagem", 
    description: "Criando imagem com IA (Nano Banana)",
    icon: ImageIcon
  },
];

const REFERENCE_TYPE_LABELS: Record<string, string> = {
  tweet: "Tweet",
  thread: "Thread",
  carousel: "Carrossel",
  reel: "Reel",
  video: "Vídeo",
  article: "Artigo",
  other: "Outro",
  newsletter: "Newsletter",
  reel_script: "Script de Reel",
  video_script: "Script de Vídeo",
  blog_post: "Post de Blog",
  social_post: "Post Social"
};

export const WorkflowVisualization = ({ currentStep, workflowState, isIdeaMode = false }: WorkflowVisualizationProps) => {
  // Selecionar steps baseado no modo
  const getActiveSteps = () => {
    if (currentStep === "generating_image") {
      return stepsForImage;
    }
    return isIdeaMode ? stepsForIdeas : stepsForContent;
  };

  const activeSteps = getActiveSteps();

  const getCurrentStepIndex = () => {
    if (!currentStep) return -1;
    return activeSteps.findIndex(s => s.key === currentStep);
  };

  const currentIndex = getCurrentStepIndex();
  const currentStepData = activeSteps[currentIndex];

  return (
    <div className="space-y-4 p-4 bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm font-medium text-primary">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>
          {currentStep === "generating_image" 
            ? "Gerando imagem..." 
            : isIdeaMode 
              ? "Buscando ideias..." 
              : "Criando conteúdo..."}
        </span>
      </div>

      {/* Current step description */}
      {currentStepData && (
        <p className="text-xs text-muted-foreground">
          {currentStepData.description}
        </p>
      )}

      {/* Workflow Steps - Compact */}
      <div className="space-y-2">
        {activeSteps.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isPending = index > currentIndex;
          const Icon = step.icon;

          return (
            <div
              key={step.key}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg transition-all duration-300",
                isCurrent && "bg-primary/10 border border-primary/30",
                isCompleted && "bg-muted/30",
                isPending && "opacity-40"
              )}
            >
              <div className="flex-shrink-0">
                {isCompleted && <CheckCircle2 className="h-4 w-4 text-primary" />}
                {isCurrent && <Loader2 className="h-4 w-4 text-primary animate-spin" />}
                {isPending && <Circle className="h-4 w-4 text-muted-foreground/50" />}
              </div>

              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Icon className={cn(
                  "h-3.5 w-3.5",
                  isCurrent ? "text-primary" : "text-muted-foreground"
                )} />
                <span className={cn(
                  "text-sm",
                  isCurrent ? "text-primary font-medium" : "text-muted-foreground"
                )}>
                  {step.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Materials - Compact */}
      {workflowState.selectedMaterials.length > 0 && currentStep !== "generating_image" && (
        <div className="pt-2 border-t border-border/30">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            {workflowState.selectedMaterials.length} materiais selecionados
          </p>
          <div className="flex flex-wrap gap-1">
            {workflowState.selectedMaterials.slice(0, 4).map((material) => (
              <Badge key={material.id} variant="secondary" className="text-[10px]">
                {material.title.substring(0, 20)}{material.title.length > 20 ? "..." : ""}
              </Badge>
            ))}
            {workflowState.selectedMaterials.length > 4 && (
              <Badge variant="outline" className="text-[10px]">
                +{workflowState.selectedMaterials.length - 4}
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
