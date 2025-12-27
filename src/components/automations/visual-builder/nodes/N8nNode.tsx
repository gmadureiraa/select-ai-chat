import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Workflow } from "lucide-react";

interface N8nNodeData {
  label: string;
  config?: {
    n8n_workflow_id?: string;
    n8n_webhook_url?: string;
  };
}

export const N8nNode = memo(({ data, selected }: NodeProps<N8nNodeData>) => {
  return (
    <div
      className={`
        relative px-4 py-3 min-w-[180px] rounded-xl border-2 bg-card shadow-sm
        ${selected ? "border-red-500 shadow-red-500/20 shadow-lg" : "border-red-200"}
      `}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-red-500 !border-2 !border-white"
      />

      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-lg bg-red-500">
          <Workflow className="h-4 w-4 text-white" />
        </div>
        <span className="font-medium text-sm">{data.label || "n8n Workflow"}</span>
      </div>
      
      {data.config?.n8n_workflow_id && (
        <div className="text-xs text-muted-foreground">
          ID: {data.config.n8n_workflow_id}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-red-500 !border-2 !border-white"
      />
    </div>
  );
});

N8nNode.displayName = "N8nNode";
