import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Bot, Wrench, Brain, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { WorkflowNodeData } from "@/types/agentBuilder";

const modelIcons: Record<string, { src: string; alt: string }> = {
  "google/gemini-2.5-flash": { src: "https://www.google.com/favicon.ico", alt: "Google" },
  "google/gemini-2.5-pro": { src: "https://www.google.com/favicon.ico", alt: "Google" },
  "openai/gpt-5": { src: "https://openai.com/favicon.ico", alt: "OpenAI" },
  "openai/gpt-5-mini": { src: "https://openai.com/favicon.ico", alt: "OpenAI" },
};

export const AgentNode = memo(({ data, selected }: NodeProps<WorkflowNodeData>) => {
  const agent = data.agent;
  const model = agent?.model || "google/gemini-2.5-flash";
  const modelIcon = modelIcons[model];
  const hasTools = agent?.tools && agent.tools.length > 0;
  const hasKnowledge = agent?.knowledge && agent.knowledge.length > 0;

  return (
    <div
      className={cn(
        "group relative min-w-[220px] rounded-2xl bg-card border shadow-md transition-all hover:shadow-lg",
        selected ? "border-primary ring-2 ring-primary/20" : "border-border"
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2.5 !h-2.5 !bg-muted-foreground !border-2 !border-card !-top-1"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2.5 !h-2.5 !bg-muted-foreground !border-2 !border-card !-bottom-1"
      />
      
      {/* Settings button on hover */}
      <button className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-muted">
        <Settings className="h-4 w-4 text-muted-foreground" />
      </button>
      
      <div className="p-4">
        {/* Badge */}
        <Badge 
          variant="secondary" 
          className="mb-3 bg-emerald-500/10 text-emerald-600 border-0 font-medium text-xs"
        >
          <Bot className="h-3 w-3 mr-1" />
          Agent
        </Badge>
        
        {/* Content */}
        <div className="flex items-center gap-3">
          {/* Pixel art style avatar */}
          <Avatar className="h-12 w-12 rounded-lg border-2 border-muted">
            {agent?.avatar_url ? (
              <AvatarImage src={agent.avatar_url} alt={agent.name} className="object-cover" />
            ) : null}
            <AvatarFallback className="bg-gradient-to-br from-primary/20 to-purple-500/20 rounded-lg">
              <Bot className="h-6 w-6 text-primary" />
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground text-sm truncate">
              {agent?.name || data.label || "Novo Agente"}
            </p>
          </div>
        </div>
        
        {/* Bottom indicators */}
        <div className="mt-3 flex items-center gap-2">
          {/* Model icon */}
          {modelIcon && (
            <img 
              src={modelIcon.src} 
              alt={modelIcon.alt} 
              className="h-4 w-4 opacity-60"
            />
          )}
          
          {/* Tools indicator */}
          {hasTools && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Wrench className="h-3.5 w-3.5" />
            </div>
          )}
          
          {/* Knowledge indicator */}
          {hasKnowledge && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Brain className="h-3.5 w-3.5" />
            </div>
          )}
        </div>
      </div>
      
      {/* Connection dot at bottom center */}
      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-primary" />
    </div>
  );
});

AgentNode.displayName = "AgentNode";
