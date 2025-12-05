import { Bot, Zap, GitBranch, Wrench, StickyNote, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { NodeType } from "@/types/agentBuilder";

interface AgentBuilderToolbarProps {
  onAddNode: (type: NodeType, config?: Record<string, any>) => void;
  activeTool: NodeType | null;
}

const tools = [
  { 
    id: "trigger" as NodeType, 
    icon: Zap, 
    label: "Trigger", 
    description: "Inicia o workflow",
    color: "text-amber-500",
    bgHover: "hover:bg-amber-500/10"
  },
  { 
    id: "agent" as NodeType, 
    icon: Bot, 
    label: "Agente", 
    description: "Agente de IA",
    color: "text-primary",
    bgHover: "hover:bg-primary/10"
  },
  { 
    id: "condition" as NodeType, 
    icon: GitBranch, 
    label: "Condição", 
    description: "Roteamento condicional",
    color: "text-purple-500",
    bgHover: "hover:bg-purple-500/10"
  },
  { 
    id: "tool" as NodeType, 
    icon: Wrench, 
    label: "Ferramenta", 
    description: "API ou ação externa",
    color: "text-emerald-500",
    bgHover: "hover:bg-emerald-500/10"
  },
  { 
    id: "tool" as NodeType, 
    subtype: "n8n",
    icon: Workflow, 
    label: "n8n", 
    description: "Workflow n8n",
    color: "text-orange-500",
    bgHover: "hover:bg-orange-500/10"
  },
  { 
    id: "note" as NodeType, 
    icon: StickyNote, 
    label: "Nota", 
    description: "Documentação",
    color: "text-yellow-500",
    bgHover: "hover:bg-yellow-500/10"
  },
];

export const AgentBuilderToolbar = ({ onAddNode, activeTool }: AgentBuilderToolbarProps) => {
  return (
    <TooltipProvider delayDuration={0}>
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50">
        <div className="flex items-center gap-1 px-3 py-2 bg-card/95 backdrop-blur-sm border border-border rounded-xl shadow-lg">
          {tools.map((tool, idx) => (
            <Tooltip key={`${tool.id}-${idx}`}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-10 w-10 rounded-lg transition-all",
                    activeTool === tool.id 
                      ? "bg-accent ring-2 ring-primary/30" 
                      : tool.bgHover,
                    tool.color
                  )}
                  onClick={() => onAddNode(tool.id, tool.subtype ? { toolType: tool.subtype } : undefined)}
                >
                  <tool.icon className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                <p className="font-medium">{tool.label}</p>
                <p className="text-muted-foreground">{tool.description}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
};
