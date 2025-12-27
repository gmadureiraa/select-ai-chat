import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { GitBranch } from "lucide-react";

interface ConditionNodeData {
  label: string;
  config?: {
    condition_expression?: string;
  };
}

export const ConditionNode = memo(({ data, selected }: NodeProps<ConditionNodeData>) => {
  return (
    <div
      className={`
        relative px-4 py-3 min-w-[180px] rounded-xl border-2 bg-card shadow-sm
        ${selected ? "border-amber-500 shadow-amber-500/20 shadow-lg" : "border-amber-200"}
      `}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-amber-500 !border-2 !border-white"
      />

      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-lg bg-amber-500">
          <GitBranch className="h-4 w-4 text-white" />
        </div>
        <span className="font-medium text-sm">{data.label || "Condição"}</span>
      </div>
      
      {data.config?.condition_expression && (
        <div className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
          {data.config.condition_expression}
        </div>
      )}

      {/* True handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="true"
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-white"
        style={{ top: '30%' }}
      />
      
      {/* False handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="false"
        className="!w-3 !h-3 !bg-red-500 !border-2 !border-white"
        style={{ top: '70%' }}
      />

      {/* Labels for handles */}
      <div className="absolute right-[-24px] top-[22%] text-[10px] font-medium text-green-600">✓</div>
      <div className="absolute right-[-24px] top-[62%] text-[10px] font-medium text-red-600">✗</div>
    </div>
  );
});

ConditionNode.displayName = "ConditionNode";
