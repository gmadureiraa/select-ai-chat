import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Zap, MessageSquare, Webhook, Calendar, Play, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { WorkflowNodeData } from "@/types/agentBuilder";

const triggerIcons = {
  user_message: MessageSquare,
  webhook: Webhook,
  schedule: Calendar,
  manual: Play,
  event: Bell,
};

const triggerLabels = {
  user_message: "User message received",
  webhook: "Webhook recebido",
  schedule: "Agendamento",
  manual: "Trigger manual",
  event: "Evento disparado",
};

export const TriggerNode = memo(({ data, selected }: NodeProps<WorkflowNodeData>) => {
  const triggerType = data.config?.trigger_type || "manual";
  const Icon = triggerIcons[triggerType as keyof typeof triggerIcons] || Zap;
  const label = data.label || triggerLabels[triggerType as keyof typeof triggerLabels] || "Trigger";

  return (
    <div className="flex flex-col items-center">
      {/* Trigger badge above */}
      <Badge 
        variant="secondary" 
        className="mb-2 bg-amber-500/10 text-amber-600 border-0 font-medium text-xs"
      >
        <Zap className="h-3 w-3 mr-1" />
        Trigger
      </Badge>
      
      {/* Main trigger card */}
      <div
        className={cn(
          "relative min-w-[200px] rounded-2xl bg-card border shadow-md transition-all hover:shadow-lg",
          selected ? "border-amber-500 ring-2 ring-amber-500/20" : "border-border"
        )}
      >
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-2.5 !h-2.5 !bg-muted-foreground !border-2 !border-card !-bottom-1"
        />
        
        <div className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="font-medium text-foreground text-sm">{label}</p>
          </div>
        </div>
        
        {/* Connection dot at bottom center */}
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-muted-foreground" />
      </div>
    </div>
  );
});

TriggerNode.displayName = "TriggerNode";
