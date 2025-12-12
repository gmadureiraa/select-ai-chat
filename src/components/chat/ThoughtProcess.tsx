import { useState } from "react";
import { 
  ChevronDown, 
  ChevronRight, 
  Brain, 
  Lightbulb,
  FileText,
  Target,
  Sparkles,
  Search
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface ThoughtStep {
  id: string;
  type: "analysis" | "decision" | "reference" | "strategy" | "generation";
  title: string;
  content: string;
  sources?: string[];
  timestamp?: Date;
}

interface ThoughtProcessProps {
  steps: ThoughtStep[];
  isStreaming?: boolean;
}

const stepIcons = {
  analysis: Search,
  decision: Target,
  reference: FileText,
  strategy: Lightbulb,
  generation: Sparkles,
};

const stepColors = {
  analysis: "text-blue-500 bg-blue-500/10 border-blue-500/30",
  decision: "text-amber-500 bg-amber-500/10 border-amber-500/30",
  reference: "text-purple-500 bg-purple-500/10 border-purple-500/30",
  strategy: "text-green-500 bg-green-500/10 border-green-500/30",
  generation: "text-primary bg-primary/10 border-primary/30",
};

export const ThoughtProcess = ({ steps, isStreaming = false }: ThoughtProcessProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  if (steps.length === 0) return null;

  const toggleStep = (stepId: string) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(stepId)) {
      newExpanded.delete(stepId);
    } else {
      newExpanded.add(stepId);
    }
    setExpandedSteps(newExpanded);
  };

  const getStepLabel = (type: ThoughtStep["type"]) => {
    const labels = {
      analysis: "Análise",
      decision: "Decisão",
      reference: "Referência",
      strategy: "Estratégia",
      generation: "Geração",
    };
    return labels[type];
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
      <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors">
        <Brain className={cn("h-4 w-4", isStreaming && "animate-pulse text-primary")} />
        <span className="text-sm font-medium flex-1 text-left">
          Processo de Pensamento
        </span>
        <Badge variant="secondary" className="text-[10px]">
          {steps.length} etapas
        </Badge>
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </CollapsibleTrigger>

      <CollapsibleContent className="pt-2">
        <ScrollArea className="max-h-64">
          <div className="space-y-2 pr-4">
            {steps.map((step, index) => {
              const Icon = stepIcons[step.type];
              const isExpanded = expandedSteps.has(step.id);
              const colorClasses = stepColors[step.type];
              const isLast = index === steps.length - 1;

              return (
                <div key={step.id} className="relative">
                  {/* Connection line */}
                  {!isLast && (
                    <div className="absolute left-5 top-10 bottom-0 w-px bg-border" />
                  )}

                  <Collapsible open={isExpanded} onOpenChange={() => toggleStep(step.id)}>
                    <CollapsibleTrigger className={cn(
                      "flex items-start gap-3 w-full p-2.5 rounded-lg border transition-all text-left",
                      colorClasses,
                      "hover:opacity-90"
                    )}>
                      <div className={cn(
                        "flex-shrink-0 p-1.5 rounded-md bg-background/80",
                        isLast && isStreaming && "animate-pulse"
                      )}>
                        <Icon className="h-4 w-4" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                            {getStepLabel(step.type)}
                          </Badge>
                          <span className="text-xs font-medium truncate">{step.title}</span>
                        </div>
                        {!isExpanded && (
                          <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">
                            {step.content}
                          </p>
                        )}
                      </div>

                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
                      )}
                    </CollapsibleTrigger>

                    <CollapsibleContent className="pl-12 pr-2 pt-2">
                      <div className="p-3 rounded-lg bg-background/50 border border-border/50 space-y-2">
                        <p className="text-xs text-foreground/80 whitespace-pre-wrap">
                          {step.content}
                        </p>

                        {step.sources && step.sources.length > 0 && (
                          <div className="pt-2 border-t border-border/30">
                            <p className="text-[10px] font-medium text-muted-foreground mb-1">
                              Fontes consultadas:
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {step.sources.map((source, i) => (
                                <Badge key={i} variant="secondary" className="text-[9px]">
                                  {source}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {step.timestamp && (
                          <p className="text-[9px] text-muted-foreground text-right">
                            {step.timestamp.toLocaleTimeString()}
                          </p>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CollapsibleContent>
    </Collapsible>
  );
};
