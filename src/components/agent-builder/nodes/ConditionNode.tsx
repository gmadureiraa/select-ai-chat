import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkflowNodeData } from "@/types/agentBuilder";

export const ConditionNode = memo(({ data, selected }: NodeProps<WorkflowNodeData>) => {
  return (
    <div
      className={cn(
        "relative min-w-[180px] rounded-xl border-2 bg-gradient-to-br from-purple-500/20 to-violet-500/20 p-4 shadow-lg transition-all",
        selected ? "border-purple-500 ring-2 ring-purple-500/30" : "border-purple-500/50"
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-purple-500 !border-2 !border-background"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="true"
        style={{ left: "30%" }}
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-background"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="false"
        style={{ left: "70%" }}
        className="!w-3 !h-3 !bg-red-500 !border-2 !border-background"
      />
      
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/20">
          <GitBranch className="h-5 w-5 text-purple-500" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-medium text-purple-500 uppercase tracking-wide">Condição</p>
          <p className="font-semibold text-foreground">{data.label || "Condição"}</p>
        </div>
      </div>
      
      {data.config?.condition && (
        <div className="mt-2 rounded-md bg-muted/50 p-2">
          <code className="text-xs text-muted-foreground">{data.config.condition}</code>
        </div>
      )}
      
      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
        <span className="text-green-500">✓ True</span>
        <span className="text-red-500">✗ False</span>
      </div>
    </div>
  );
});

ConditionNode.displayName = "ConditionNode";
