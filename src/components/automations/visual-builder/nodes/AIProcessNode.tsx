import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Brain } from "lucide-react";

interface AIProcessNodeData {
  label: string;
  config?: {
    ai_prompt?: string;
    ai_model?: string;
  };
}

export const AIProcessNode = memo(({ data, selected }: NodeProps<AIProcessNodeData>) => {
  return (
    <div
      className={`
        relative px-4 py-3 min-w-[180px] rounded-xl border-2 bg-card shadow-sm
        ${selected ? "border-emerald-500 shadow-emerald-500/20 shadow-lg" : "border-emerald-200"}
      `}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-white"
      />

      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-lg bg-emerald-500">
          <Brain className="h-4 w-4 text-white" />
        </div>
        <span className="font-medium text-sm">{data.label || "Processar com IA"}</span>
      </div>
      
      {data.config?.ai_model && (
        <div className="text-xs text-muted-foreground">
          Modelo: {data.config.ai_model}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-white"
      />
    </div>
  );
});

AIProcessNode.displayName = "AIProcessNode";
