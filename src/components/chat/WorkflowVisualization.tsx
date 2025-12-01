import { CheckCircle2, Circle, Loader2, FileText, Sparkles, Search, Lightbulb, ExternalLink } from "lucide-react";
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
}

const steps = [
  { 
    key: "analyzing", 
    label: "Análise Inicial", 
    description: "Entendendo a pergunta e identificando necessidades",
    icon: Search
  },
  { 
    key: "selecting", 
    label: "Seleção de Materiais", 
    description: "Escolhendo referências relevantes da biblioteca",
    icon: FileText
  },
  { 
    key: "analyzing_library", 
    label: "Análise de Padrões", 
    description: "Extraindo tom, estrutura e estilo dos materiais",
    icon: Lightbulb
  },
  { 
    key: "reviewing", 
    label: "Preparação de Contexto", 
    description: "Organizando informações para geração",
    icon: Sparkles
  },
  { 
    key: "creating", 
    label: "Criação de Conteúdo", 
    description: "Gerando resposta baseada nos padrões identificados",
    icon: Sparkles
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

export const WorkflowVisualization = ({ currentStep, workflowState }: WorkflowVisualizationProps) => {
  const getCurrentStepIndex = () => {
    if (!currentStep) return -1;
    return steps.findIndex(s => s.key === currentStep);
  };

  const currentIndex = getCurrentStepIndex();

  return (
    <div className="space-y-6 p-6 bg-card/30 backdrop-blur-sm border border-border/50 rounded-xl">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm font-medium text-primary">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Processando sua solicitação...</span>
      </div>

      {/* Workflow Steps */}
      <div className="space-y-3">
        {steps.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isPending = index > currentIndex;
          const Icon = step.icon;

          return (
            <Card
              key={step.key}
              className={cn(
                "p-4 transition-all duration-300 border",
                isCurrent && "border-primary/50 bg-primary/5",
                isCompleted && "border-border/30 bg-card/50",
                isPending && "border-border/20 bg-card/20 opacity-50"
              )}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  {isCompleted && (
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  )}
                  {isCurrent && (
                    <Loader2 className="h-5 w-5 text-primary animate-spin" />
                  )}
                  {isPending && (
                    <Circle className="h-5 w-5 text-muted-foreground/50" />
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2">
                    <Icon className={cn(
                      "h-4 w-4",
                      isCurrent ? "text-primary" : isCompleted ? "text-foreground" : "text-muted-foreground"
                    )} />
                    <p className={cn(
                      "text-sm font-medium transition-colors",
                      isCurrent ? "text-primary" : isCompleted ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {step.label}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {step.description}
                  </p>

                  {/* Show details for current or completed steps */}
                  {(isCurrent || isCompleted) && (
                    <>
                      {/* Selected Materials */}
                      {step.key === "selecting" && workflowState.selectedMaterials.length > 0 && (
                        <div className="mt-3 space-y-2">
                          <p className="text-xs font-medium text-foreground/80">
                            Materiais Selecionados ({workflowState.selectedMaterials.length}):
                          </p>
                          <ScrollArea className="max-h-40">
                            <div className="space-y-2 pr-3">
                              {workflowState.selectedMaterials.map((material) => (
                                <div
                                  key={material.id}
                                  className="flex items-start gap-2 p-2 bg-background/50 rounded border border-border/30"
                                >
                                  <FileText className="h-3 w-3 text-primary mt-0.5 flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className="text-xs font-medium text-foreground truncate">
                                        {material.title}
                                      </p>
                                      <Badge variant="outline" className="text-[10px] h-4">
                                        {material.type === 'reference_library' 
                                          ? REFERENCE_TYPE_LABELS[material.category] || material.category
                                          : REFERENCE_TYPE_LABELS[material.category] || material.category}
                                      </Badge>
                                    </div>
                                    {material.reason && (
                                      <p className="text-[10px] text-muted-foreground mt-1">
                                        {material.reason}
                                      </p>
                                    )}
                                    {material.source_url && (
                                      <a
                                        href={material.source_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline mt-1"
                                      >
                                        <ExternalLink className="h-2.5 w-2.5" />
                                        Ver fonte
                                      </a>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </div>
                      )}

                      {/* Reasoning and Strategy */}
                      {step.key === "selecting" && workflowState.reasoning && (
                        <div className="mt-3 space-y-2">
                          <div className="p-2 bg-background/50 rounded border border-border/30">
                            <p className="text-xs font-medium text-foreground/80 mb-1">Raciocínio:</p>
                            <p className="text-[10px] text-muted-foreground leading-relaxed">
                              {workflowState.reasoning}
                            </p>
                          </div>
                          {workflowState.strategy && (
                            <div className="p-2 bg-background/50 rounded border border-border/30">
                              <p className="text-xs font-medium text-foreground/80 mb-1">Estratégia:</p>
                              <p className="text-[10px] text-muted-foreground leading-relaxed">
                                {workflowState.strategy}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Pattern Analysis */}
                      {step.key === "analyzing_library" && workflowState.patternAnalysis && (
                        <div className="mt-3">
                          <div className="p-2 bg-background/50 rounded border border-border/30">
                            <p className="text-xs font-medium text-foreground/80 mb-1">Padrões Identificados:</p>
                            <ScrollArea className="max-h-32">
                              <p className="text-[10px] text-muted-foreground leading-relaxed whitespace-pre-wrap pr-3">
                                {workflowState.patternAnalysis.substring(0, 500)}
                                {workflowState.patternAnalysis.length > 500 && "..."}
                              </p>
                            </ScrollArea>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Footer hint */}
      <p className="text-xs text-muted-foreground text-center">
        Acompanhe em tempo real cada etapa do processo de geração
      </p>
    </div>
  );
};