import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Wrench, Globe, Webhook, Code, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkflowNodeData } from "@/types/agentBuilder";

const toolIcons = {
  api: Globe,
  webhook: Webhook,
  function: Code,
  n8n: Workflow,
};

export const ToolNode = memo(({ data, selected }: NodeProps<WorkflowNodeData>) => {
  const toolType = data.config?.tool_config?.type || "api";
  const Icon = toolIcons[toolType as keyof typeof toolIcons] || Wrench;

  return (
    <div
      className={cn(
        "relative min-w-[180px] rounded-xl border-2 bg-gradient-to-br from-emerald-500/20 to-green-500/20 p-4 shadow-lg transition-all",
        selected ? "border-emerald-500 ring-2 ring-emerald-500/30" : "border-emerald-500/50"
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-background"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-background"
      />
      
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/20">
          <Icon className="h-5 w-5 text-emerald-500" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-medium text-emerald-500 uppercase tracking-wide">Tool</p>
          <p className="font-semibold text-foreground">
            {data.config?.tool_config?.name || data.label || "Ferramenta"}
          </p>
        </div>
      </div>
      
      {data.config?.tool_config?.description && (
        <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
          {data.config.tool_config.description}
        </p>
      )}
    </div>
  );
});

ToolNode.displayName = "ToolNode";
