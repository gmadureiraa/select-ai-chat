import { useState } from "react";
import { 
  BookOpen, 
  FileText, 
  Bot, 
  Coins, 
  ChevronDown,
  ExternalLink,
  CheckCircle2,
  Palette,
  Lightbulb
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { LayoutGuideViewer, LayoutGuide } from "./LayoutGuideViewer";

export interface ProcessMetadata {
  knowledgeUsed: { id: string; title: string; category: string }[];
  structureExamples: { id: string; title: string; contentType: string }[];
  agentSteps: { agentId: string; agentName: string; inputTokens: number; outputTokens: number; durationMs: number }[];
  totalTokens: { input: number; output: number };
  totalCost: number;
  layoutGuide?: LayoutGuide;
  strategicInsights?: string[];
}

interface ProcessViewerProps {
  data: ProcessMetadata;
  onGenerateImage?: (prompt: string, slideNumber: number) => void;
  isGeneratingImage?: boolean;
}

export const ProcessViewer = ({ data, onGenerateImage, isGeneratingImage }: ProcessViewerProps) => {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const formatCost = (cost: number) => {
    return cost < 0.01 ? `$${cost.toFixed(4)}` : `$${cost.toFixed(2)}`;
  };

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}k`;
    }
    return tokens.toString();
  };

  return (
    <div className="mt-3 space-y-2 text-xs border border-border/50 rounded-lg p-3 bg-muted/20">
      {/* Knowledge Used */}
      {data.knowledgeUsed.length > 0 && (
        <Collapsible 
          open={openSections["knowledge"]} 
          onOpenChange={() => toggleSection("knowledge")}
        >
          <CollapsibleTrigger className="flex items-center gap-2 w-full text-left hover:bg-muted/50 rounded-md px-2 py-1.5 transition-colors">
            <BookOpen className="h-3.5 w-3.5 text-primary" />
            <span className="font-medium">Base de Conhecimento</span>
            <Badge variant="secondary" className="ml-auto mr-2 h-5 text-[10px]">
              {data.knowledgeUsed.length} docs
            </Badge>
            <ChevronDown className={cn(
              "h-3.5 w-3.5 text-muted-foreground transition-transform",
              openSections["knowledge"] && "rotate-180"
            )} />
          </CollapsibleTrigger>
          <CollapsibleContent className="pl-6 pt-1.5 space-y-1">
            {data.knowledgeUsed.map((k, i) => (
              <div 
                key={k.id || i}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <FileText className="h-3 w-3" />
                <span className="truncate flex-1">{k.title}</span>
                <Badge variant="outline" className="h-4 text-[9px] px-1.5">
                  {k.category}
                </Badge>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Structure Examples */}
      {data.structureExamples.length > 0 && (
        <Collapsible 
          open={openSections["examples"]} 
          onOpenChange={() => toggleSection("examples")}
        >
          <CollapsibleTrigger className="flex items-center gap-2 w-full text-left hover:bg-muted/50 rounded-md px-2 py-1.5 transition-colors">
            <FileText className="h-3.5 w-3.5 text-amber-500" />
            <span className="font-medium">Exemplos de Estrutura</span>
            <Badge variant="secondary" className="ml-auto mr-2 h-5 text-[10px]">
              {data.structureExamples.length} exemplos
            </Badge>
            <ChevronDown className={cn(
              "h-3.5 w-3.5 text-muted-foreground transition-transform",
              openSections["examples"] && "rotate-180"
            )} />
          </CollapsibleTrigger>
          <CollapsibleContent className="pl-6 pt-1.5 space-y-1">
            {data.structureExamples.map((e, i) => (
              <div 
                key={e.id || i}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                <span className="truncate flex-1">{e.title}</span>
                <Badge variant="outline" className="h-4 text-[9px] px-1.5">
                  {e.contentType}
                </Badge>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Agent Pipeline */}
      {data.agentSteps.length > 0 && (
        <Collapsible 
          open={openSections["pipeline"]} 
          onOpenChange={() => toggleSection("pipeline")}
        >
          <CollapsibleTrigger className="flex items-center gap-2 w-full text-left hover:bg-muted/50 rounded-md px-2 py-1.5 transition-colors">
            <Bot className="h-3.5 w-3.5 text-blue-500" />
            <span className="font-medium">Pipeline de Agentes</span>
            <Badge variant="secondary" className="ml-auto mr-2 h-5 text-[10px]">
              {data.agentSteps.length} etapas
            </Badge>
            <ChevronDown className={cn(
              "h-3.5 w-3.5 text-muted-foreground transition-transform",
              openSections["pipeline"] && "rotate-180"
            )} />
          </CollapsibleTrigger>
          <CollapsibleContent className="pl-6 pt-1.5 space-y-1.5">
            {data.agentSteps.map((step, i) => (
              <div 
                key={step.agentId || i}
                className="flex items-center gap-2 text-muted-foreground"
              >
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                <span className="font-medium text-foreground">{step.agentName}</span>
                <span className="text-[10px]">
                  {formatTokens(step.inputTokens)} in / {formatTokens(step.outputTokens)} out
                </span>
                <span className="text-[10px] text-muted-foreground/70 ml-auto">
                  {step.durationMs ? `${(step.durationMs / 1000).toFixed(1)}s` : ""}
                </span>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Layout Guide */}
      {data.layoutGuide && data.layoutGuide.slides && data.layoutGuide.slides.length > 0 && (
        <Collapsible 
          open={openSections["layout"]} 
          onOpenChange={() => toggleSection("layout")}
        >
          <CollapsibleTrigger className="flex items-center gap-2 w-full text-left hover:bg-muted/50 rounded-md px-2 py-1.5 transition-colors">
            <Palette className="h-3.5 w-3.5 text-purple-500" />
            <span className="font-medium">Guia de Layout</span>
            <Badge variant="secondary" className="ml-auto mr-2 h-5 text-[10px]">
              {data.layoutGuide.slides.length} slides
            </Badge>
            <ChevronDown className={cn(
              "h-3.5 w-3.5 text-muted-foreground transition-transform",
              openSections["layout"] && "rotate-180"
            )} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <LayoutGuideViewer 
              layoutGuide={data.layoutGuide} 
              onGenerateImage={onGenerateImage}
              isGeneratingImage={isGeneratingImage}
            />
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Strategic Insights */}
      {data.strategicInsights && data.strategicInsights.length > 0 && (
        <Collapsible 
          open={openSections["insights"]} 
          onOpenChange={() => toggleSection("insights")}
        >
          <CollapsibleTrigger className="flex items-center gap-2 w-full text-left hover:bg-muted/50 rounded-md px-2 py-1.5 transition-colors">
            <Lightbulb className="h-3.5 w-3.5 text-yellow-500" />
            <span className="font-medium">Insights Estratégicos</span>
            <Badge variant="secondary" className="ml-auto mr-2 h-5 text-[10px]">
              {data.strategicInsights.length}
            </Badge>
            <ChevronDown className={cn(
              "h-3.5 w-3.5 text-muted-foreground transition-transform",
              openSections["insights"] && "rotate-180"
            )} />
          </CollapsibleTrigger>
          <CollapsibleContent className="pl-6 pt-1.5 space-y-1">
            {data.strategicInsights.map((insight, i) => (
              <div 
                key={i}
                className="flex items-start gap-2 text-muted-foreground text-[11px]"
              >
                <span className="text-yellow-500">•</span>
                <span>{insight}</span>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Token Summary */}
      <div className="flex items-center gap-4 px-2 pt-2 border-t border-border/30">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Coins className="h-3.5 w-3.5" />
          <span>Total:</span>
          <span className="text-foreground font-medium">
            {formatTokens(data.totalTokens.input)} in / {formatTokens(data.totalTokens.output)} out
          </span>
        </div>
        <div className="text-muted-foreground ml-auto">
          Custo: <span className="text-foreground font-medium">{formatCost(data.totalCost)}</span>
        </div>
      </div>
    </div>
  );
};