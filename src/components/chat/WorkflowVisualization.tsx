import { CheckCircle2, Circle, Loader2, FileText, Sparkles, Search, Lightbulb, ExternalLink, ImageIcon } from "lucide-react";
import { ProcessStep } from "@/types/chat";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

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
  isFreeChatMode?: boolean;
}

const stepsForFreeChat = [
  { 
    key: "analyzing", 
    label: "Preparando Contexto", 
    description: "Carregando dados do cliente",
    icon: Search
  },
  { 
    key: "creating", 
    label: "Respondendo", 
    description: "Gerando resposta com dados reais",
    icon: Sparkles
  },
];

const stepsForIdeas = [
  { 
    key: "analyzing", 
    label: "Detectando Pedido", 
    description: "Identificando que você quer ideias",
    icon: Search
  },
  { 
    key: "selecting", 
    label: "Lendo Biblioteca", 
    description: "Buscando temas que o cliente trabalha",
    icon: FileText
  },
  { 
    key: "analyzing_library", 
    label: "Analisando Temas", 
    description: "Identificando assuntos principais",
    icon: Lightbulb
  },
  { 
    key: "creating", 
    label: "Gerando Ideias", 
    description: "Criando ideias novas sobre os temas",
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
    label: "Selecionando Referências", 
    description: "Buscando modelos de escrita",
    icon: FileText
  },
  { 
    key: "analyzing_library", 
    label: "Analisando Estilo", 
    description: "Extraindo tom e padrões",
    icon: Lightbulb
  },
  { 
    key: "reviewing", 
    label: "Preparando Contexto", 
    description: "Organizando regras",
    icon: Sparkles
  },
  { 
    key: "creating", 
    label: "Escrevendo", 
    description: "Gerando conteúdo final",
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
    description: "Criando imagem com IA",
    icon: ImageIcon
  },
];

export const WorkflowVisualization = ({ currentStep, workflowState, isIdeaMode = false, isFreeChatMode = false }: WorkflowVisualizationProps) => {
  // Selecionar steps baseado no modo
  const getActiveSteps = () => {
    if (currentStep === "generating_image") {
      return stepsForImage;
    }
    if (isFreeChatMode) {
      return stepsForFreeChat;
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

  // Cores baseadas no modo
  const getModeColor = () => {
    if (isFreeChatMode) return "emerald";
    if (isIdeaMode) return "amber";
    return "primary";
  };

  const modeColor = getModeColor();

  return (
    <div className={cn(
      "space-y-3 p-4 backdrop-blur-sm border rounded-xl",
      isFreeChatMode 
        ? "bg-emerald-500/10 border-emerald-500/30" 
        : isIdeaMode 
          ? "bg-amber-500/10 border-amber-500/30" 
          : "bg-card/50 border-border/50"
    )}>
      {/* Header com modo */}
      <div className="flex items-center gap-2">
        <div className={cn(
          "flex items-center gap-2 text-sm font-medium",
          isFreeChatMode ? "text-emerald-500" : isIdeaMode ? "text-amber-500" : "text-primary"
        )}>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>
            {currentStep === "generating_image" 
              ? "Gerando imagem..." 
              : isFreeChatMode
                ? "CHAT LIVRE"
                : isIdeaMode 
                  ? "MODO IDEIAS" 
                  : "MODO CONTEÚDO"}
          </span>
        </div>
        {isFreeChatMode && (
          <Badge variant="outline" className="text-[10px] bg-emerald-500/20 border-emerald-500/40 text-emerald-600">
            Dados Reais
          </Badge>
        )}
        {isIdeaMode && (
          <Badge variant="outline" className="text-[10px] bg-amber-500/20 border-amber-500/40 text-amber-600">
            Fluxo Simplificado
          </Badge>
        )}
      </div>

      {/* Current step description */}
      {currentStepData && (
        <p className="text-xs text-muted-foreground">
          {currentStepData.description}
        </p>
      )}

      {/* Workflow Steps - Compact */}
      <div className="space-y-1.5">
        {activeSteps.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isPending = index > currentIndex;
          const Icon = step.icon;

          return (
            <div
              key={step.key}
              className={cn(
                "flex items-center gap-3 p-2 rounded-lg transition-all duration-300",
                isCurrent && (isFreeChatMode ? "bg-emerald-500/20" : isIdeaMode ? "bg-amber-500/20" : "bg-primary/10"),
                isCompleted && "bg-muted/30",
                isPending && "opacity-40"
              )}
            >
              <div className="flex-shrink-0">
                {isCompleted && <CheckCircle2 className={cn("h-4 w-4", isFreeChatMode ? "text-emerald-500" : isIdeaMode ? "text-amber-500" : "text-primary")} />}
                {isCurrent && <Loader2 className={cn("h-4 w-4 animate-spin", isFreeChatMode ? "text-emerald-500" : isIdeaMode ? "text-amber-500" : "text-primary")} />}
                {isPending && <Circle className="h-4 w-4 text-muted-foreground/50" />}
              </div>

              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Icon className={cn(
                  "h-3.5 w-3.5",
                  isCurrent ? (isFreeChatMode ? "text-emerald-500" : isIdeaMode ? "text-amber-500" : "text-primary") : "text-muted-foreground"
                )} />
                <span className={cn(
                  "text-sm",
                  isCurrent 
                    ? (isFreeChatMode ? "text-emerald-600 font-medium" : isIdeaMode ? "text-amber-600 font-medium" : "text-primary font-medium") 
                    : "text-muted-foreground"
                )}>
                  {step.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Materials - Apenas para modo conteúdo */}
      {!isIdeaMode && !isFreeChatMode && workflowState.selectedMaterials.length > 0 && currentStep !== "generating_image" && (
        <div className="pt-2 border-t border-border/30">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            {workflowState.selectedMaterials.length} materiais selecionados
          </p>
          <div className="flex flex-wrap gap-1">
            {workflowState.selectedMaterials.slice(0, 4).map((material) => {
              const title = material.title || "Material";
              return (
                <Badge key={material.id} variant="secondary" className="text-[10px]">
                  {title.substring(0, 20)}{title.length > 20 ? "..." : ""}
                </Badge>
              );
            })}
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