import { memo, useState } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Lightbulb, X, ChevronDown, Maximize2, Minimize2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { PromptNodeData } from "../hooks/useCanvasState";

interface PromptNodeProps extends NodeProps<PromptNodeData> {
  onUpdateData?: (nodeId: string, data: Partial<PromptNodeData>) => void;
  onDelete?: (nodeId: string) => void;
}

const PROMPT_TEMPLATES = [
  {
    label: "Educativo",
    value: "Crie conteúdo educativo explicando de forma simples e didática. Use exemplos práticos e linguagem acessível."
  },
  {
    label: "Persuasivo",
    value: "Crie conteúdo persuasivo focado em conversão. Use gatilhos mentais, prova social e call-to-action claro."
  },
  {
    label: "Storytelling",
    value: "Crie conteúdo usando storytelling. Comece com um gancho emocional, desenvolva uma narrativa e termine com uma lição."
  },
  {
    label: "Tendência",
    value: "Adapte este conteúdo para uma trend atual. Mantenha a mensagem mas use formato viral e linguagem da geração Z."
  },
  {
    label: "Polêmico",
    value: "Crie conteúdo com tom provocativo que gere debate. Use afirmações ousadas mas fundamentadas."
  },
  {
    label: "Tutorial",
    value: "Crie um tutorial passo a passo. Seja específico, use números e verbos de ação em cada etapa."
  }
];

function PromptNodeComponent({ 
  id, 
  data, 
  selected,
  onUpdateData,
  onDelete 
}: PromptNodeProps) {
  const [briefing, setBriefing] = useState(data.briefing || "");
  const [isExpanded, setIsExpanded] = useState(false);

  const handleBriefingChange = (value: string) => {
    setBriefing(value);
    onUpdateData?.(id, { briefing: value });
  };

  const handleTemplateSelect = (template: string) => {
    const newValue = briefing ? `${briefing}\n\n${template}` : template;
    setBriefing(newValue);
    onUpdateData?.(id, { briefing: newValue });
  };

  const cardWidth = isExpanded ? "w-[450px]" : "w-[300px]";
  const textareaHeight = isExpanded ? "min-h-[200px]" : "min-h-[100px]";

  return (
    <Card className={cn(
      cardWidth,
      "shadow-lg transition-all border-2",
      selected ? "border-primary ring-2 ring-primary/20" : "border-yellow-500/50",
      "bg-gradient-to-br from-yellow-50 to-white dark:from-yellow-950/30 dark:to-background"
    )}>
      <CardHeader className="pb-2 pt-3 px-3 flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-yellow-500 flex items-center justify-center">
            <Lightbulb className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="font-medium text-sm">Instruções</span>
        </div>
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1">
                Templates
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {PROMPT_TEMPLATES.map((template) => (
                <DropdownMenuItem
                  key={template.label}
                  onClick={() => handleTemplateSelect(template.value)}
                  className="text-xs"
                >
                  {template.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? "Minimizar" : "Expandir"}
          >
            {isExpanded ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:bg-destructive/10 hover:text-destructive"
            onClick={() => onDelete?.(id)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="px-3 pb-3">
        <Textarea
          placeholder="Descreva as instruções para a geração...

Ex: Tom descontraído, foco em dicas práticas, usar emojis com moderação, incluir CTA no final."
          value={briefing}
          onChange={(e) => handleBriefingChange(e.target.value)}
          className={cn(textareaHeight, "text-xs resize-none")}
          rows={isExpanded ? 10 : 5}
        />
      </CardContent>

      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className="!w-3 !h-3 !bg-yellow-500 !border-2 !border-white"
      />
    </Card>
  );
}

export const PromptNode = memo(PromptNodeComponent);
