import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Wrench, Globe, Webhook, Code, Workflow, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { WorkflowNodeData } from "@/types/agentBuilder";

const toolIcons = {
  api: Globe,
  webhook: Webhook,
  function: Code,
  n8n: Workflow,
};

export const ToolNode = memo(({ data, selected }: NodeProps<WorkflowNodeData>) => {
  const toolType = (data.config?.tool_config?.type || data.config?.toolType || "api") as keyof typeof toolIcons;
  const Icon = toolIcons[toolType] || Wrench;
  const isN8n = toolType === "n8n";

  const toolName = data.config?.tool_config?.name || data.config?.n8nWorkflowName || data.label || "Ferramenta";

  return (
    <div
      className={cn(
        "group relative min-w-[200px] rounded-2xl bg-card border shadow-md transition-all hover:shadow-lg",
        selected ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-border"
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
          className={cn(
            "mb-3 border-0 font-medium text-xs",
            isN8n ? "bg-orange-500/10 text-orange-600" : "bg-emerald-500/10 text-emerald-600"
          )}
        >
          <Icon className="h-3 w-3 mr-1" />
          {isN8n ? "n8n" : "Tool"}
        </Badge>
        
        {/* Content */}
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg",
            isN8n ? "bg-orange-500/10" : "bg-emerald-500/10"
          )}>
            <Icon className={cn(
              "h-5 w-5",
              isN8n ? "text-orange-500" : "text-emerald-500"
            )} />
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground text-sm truncate">
              {toolName}
            </p>
            {isN8n && (
              <p className="text-xs text-muted-foreground">MCP Integration</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

ToolNode.displayName = "ToolNode";
