import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Wrench, Globe, Webhook, Code, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { WorkflowNodeData } from "@/types/agentBuilder";

const toolIcons = {
  api: Globe,
  webhook: Webhook,
  function: Code,
  n8n: Workflow,
};

const toolColors = {
  api: { bg: "from-blue-500/20 to-cyan-500/20", border: "border-blue-500", text: "text-blue-500", icon: "bg-blue-500/20" },
  webhook: { bg: "from-orange-500/20 to-amber-500/20", border: "border-orange-500", text: "text-orange-500", icon: "bg-orange-500/20" },
  function: { bg: "from-purple-500/20 to-violet-500/20", border: "border-purple-500", text: "text-purple-500", icon: "bg-purple-500/20" },
  n8n: { bg: "from-emerald-500/20 to-green-500/20", border: "border-emerald-500", text: "text-emerald-500", icon: "bg-emerald-500/20" },
};

export const ToolNode = memo(({ data, selected }: NodeProps<WorkflowNodeData>) => {
  const toolType = (data.config?.tool_config?.type || data.config?.toolType || "api") as keyof typeof toolIcons;
  const Icon = toolIcons[toolType] || Wrench;
  const colors = toolColors[toolType] || toolColors.api;

  const toolName = data.config?.tool_config?.name || data.config?.n8nWorkflowName || data.label || "Ferramenta";
  const isN8n = toolType === "n8n";

  return (
    <div
      className={cn(
        "relative min-w-[200px] rounded-xl border-2 bg-gradient-to-br p-4 shadow-lg transition-all",
        colors.bg,
        selected ? `${colors.border} ring-2 ring-emerald-500/30` : `${colors.border}/50`
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className={cn("!w-3 !h-3 !border-2 !border-background", `!bg-emerald-500`)}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className={cn("!w-3 !h-3 !border-2 !border-background", `!bg-emerald-500`)}
      />
      
      <div className="flex items-center gap-3">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", colors.icon)}>
          <Icon className={cn("h-5 w-5", colors.text)} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className={cn("text-xs font-medium uppercase tracking-wide", colors.text)}>
              {isN8n ? "n8n" : "Tool"}
            </p>
            {isN8n && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1">
                MCP
              </Badge>
            )}
          </div>
          <p className="font-semibold text-foreground text-sm">
            {toolName}
          </p>
        </div>
      </div>
      
      {(data.config?.tool_config?.description || data.config?.n8nWorkflowId) && (
        <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
          {data.config?.tool_config?.description || `Workflow ID: ${data.config?.n8nWorkflowId}`}
        </p>
      )}

      {data.config?.webhookUrl && (
        <div className="mt-2 flex items-center gap-1">
          <Webhook className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground truncate max-w-[160px]">
            {data.config.webhookUrl}
          </span>
        </div>
      )}
    </div>
  );
});

ToolNode.displayName = "ToolNode";
