import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Globe } from "lucide-react";

interface APINodeData {
  label: string;
  config?: {
    api_url?: string;
    api_method?: 'GET' | 'POST';
  };
}

export const APINode = memo(({ data, selected }: NodeProps<APINodeData>) => {
  return (
    <div
      className={`
        relative px-4 py-3 min-w-[180px] rounded-xl border-2 bg-card shadow-sm
        ${selected ? "border-cyan-500 shadow-cyan-500/20 shadow-lg" : "border-cyan-200"}
      `}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-lg bg-cyan-500">
          <Globe className="h-4 w-4 text-white" />
        </div>
        <span className="font-medium text-sm">{data.label || "API Request"}</span>
      </div>
      
      <div className="flex items-center gap-2">
        {data.config?.api_method && (
          <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-700">
            {data.config.api_method}
          </span>
        )}
        {data.config?.api_url && (
          <div className="text-xs text-muted-foreground truncate max-w-[120px]">
            {data.config.api_url}
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-cyan-500 !border-2 !border-white"
      />
    </div>
  );
});

APINode.displayName = "APINode";
