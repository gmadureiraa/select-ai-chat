import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Clock } from "lucide-react";

interface ScheduleNodeData {
  label: string;
  config?: {
    schedule_cron?: string;
  };
}

export const ScheduleNode = memo(({ data, selected }: NodeProps<ScheduleNodeData>) => {
  return (
    <div
      className={`
        relative px-4 py-3 min-w-[180px] rounded-xl border-2 bg-card shadow-sm
        ${selected ? "border-purple-500 shadow-purple-500/20 shadow-lg" : "border-purple-200"}
      `}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-lg bg-purple-500">
          <Clock className="h-4 w-4 text-white" />
        </div>
        <span className="font-medium text-sm">{data.label || "Agendamento"}</span>
      </div>
      
      {data.config?.schedule_cron && (
        <div className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
          {data.config.schedule_cron}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-purple-500 !border-2 !border-white"
      />
    </div>
  );
});

ScheduleNode.displayName = "ScheduleNode";
