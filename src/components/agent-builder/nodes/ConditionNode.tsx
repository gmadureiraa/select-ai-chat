import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { GitBranch, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { WorkflowNodeData } from "@/types/agentBuilder";

export const ConditionNode = memo(({ data, selected }: NodeProps<WorkflowNodeData>) => {
  return (
    <div
      className={cn(
        "group relative min-w-[180px] rounded-2xl bg-card border shadow-md transition-all hover:shadow-lg",
        selected ? "border-purple-500 ring-2 ring-purple-500/20" : "border-border"
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
        id="true"
        style={{ left: "30%" }}
        className="!w-2.5 !h-2.5 !bg-emerald-500 !border-2 !border-card !-bottom-1"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="false"
        style={{ left: "70%" }}
        className="!w-2.5 !h-2.5 !bg-red-500 !border-2 !border-card !-bottom-1"
      />
      
      {/* Settings button on hover */}
      <button className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-muted">
        <Settings className="h-4 w-4 text-muted-foreground" />
      </button>
      
      <div className="p-4">
        {/* Badge */}
        <Badge 
          variant="secondary" 
          className="mb-3 bg-purple-500/10 text-purple-600 border-0 font-medium text-xs"
        >
          <GitBranch className="h-3 w-3 mr-1" />
          Condition
        </Badge>
        
        {/* Content */}
        <p className="font-semibold text-foreground text-sm">
          {data.label || "Condição"}
        </p>
        
        {data.config?.condition && (
          <div className="mt-2 rounded-md bg-muted/50 p-2">
            <code className="text-xs text-muted-foreground">{data.config.condition}</code>
          </div>
        )}
        
        {/* True/False labels */}
        <div className="mt-3 flex justify-between text-xs">
          <span className="text-emerald-500 font-medium">✓ True</span>
          <span className="text-red-500 font-medium">✗ False</span>
        </div>
      </div>
    </div>
  );
});

ConditionNode.displayName = "ConditionNode";
