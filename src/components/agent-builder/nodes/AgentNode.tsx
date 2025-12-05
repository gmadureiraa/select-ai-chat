import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Bot, Sparkles, Brain, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { WorkflowNodeData } from "@/types/agentBuilder";

const modelBadges: Record<string, { label: string; color: string }> = {
  "google/gemini-2.5-flash": { label: "G", color: "bg-blue-500" },
  "google/gemini-2.5-pro": { label: "G+", color: "bg-blue-600" },
  "openai/gpt-5": { label: "GPT", color: "bg-emerald-500" },
  "openai/gpt-5-mini": { label: "GPT", color: "bg-emerald-400" },
};

export const AgentNode = memo(({ data, selected }: NodeProps<WorkflowNodeData>) => {
  const agent = data.agent;
  const model = agent?.model || "google/gemini-2.5-flash";
  const modelBadge = modelBadges[model] || { label: "AI", color: "bg-primary" };
  const hasTools = agent?.tools && agent.tools.length > 0;
  const hasKnowledge = agent?.knowledge && agent.knowledge.length > 0;

  return (
    <div
      className={cn(
        "relative min-w-[240px] rounded-xl border-2 bg-gradient-to-br from-primary/10 to-primary/5 p-4 shadow-lg transition-all",
        selected ? "border-primary ring-2 ring-primary/30" : "border-primary/50"
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-primary !border-2 !border-background"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-primary !border-2 !border-background"
      />
      
      {/* Model badge */}
      <div className={cn("absolute -top-2 -right-2 px-2 py-0.5 rounded-full text-xs font-bold text-white", modelBadge.color)}>
        {modelBadge.label}
      </div>
      
      <div className="flex items-center gap-3">
        <Avatar className="h-12 w-12 border-2 border-primary/30">
          {agent?.avatar_url ? (
            <AvatarImage src={agent.avatar_url} alt={agent.name} />
          ) : null}
          <AvatarFallback className="bg-primary/20">
            <Bot className="h-6 w-6 text-primary" />
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-primary uppercase tracking-wide">Agente</p>
          <p className="font-semibold text-foreground truncate">
            {agent?.name || data.label || "Novo Agente"}
          </p>
        </div>
      </div>
      
      {agent?.description && (
        <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{agent.description}</p>
      )}
      
      {/* Indicators */}
      <div className="mt-3 flex items-center gap-2">
        {hasTools && (
          <div className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
            <Wrench className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{agent.tools.length}</span>
          </div>
        )}
        {hasKnowledge && (
          <div className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
            <Brain className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{agent.knowledge.length}</span>
          </div>
        )}
        {agent?.memory_enabled && (
          <div className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
            <Sparkles className="h-3 w-3 text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
});

AgentNode.displayName = "AgentNode";
