import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Zap, MessageSquare, Webhook, Calendar, Play, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkflowNodeData } from "@/types/agentBuilder";

const triggerIcons = {
  user_message: MessageSquare,
  webhook: Webhook,
  schedule: Calendar,
  manual: Play,
  event: Bell,
};

const triggerLabels = {
  user_message: "Mensagem do Usuário",
  webhook: "Webhook",
  schedule: "Agendamento",
  manual: "Manual",
  event: "Evento",
};

export const TriggerNode = memo(({ data, selected }: NodeProps<WorkflowNodeData>) => {
  const triggerType = data.config?.trigger_type || "manual";
  const Icon = triggerIcons[triggerType as keyof typeof triggerIcons] || Zap;
  const label = data.label || triggerLabels[triggerType as keyof typeof triggerLabels] || "Trigger";

  return (
    <div
      className={cn(
        "relative min-w-[200px] rounded-xl border-2 bg-gradient-to-br from-amber-500/20 to-orange-500/20 p-4 shadow-lg transition-all",
        selected ? "border-amber-500 ring-2 ring-amber-500/30" : "border-amber-500/50"
      )}
    >
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-amber-500 !border-2 !border-background"
      />
      
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/20">
          <Icon className="h-5 w-5 text-amber-500" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-medium text-amber-500 uppercase tracking-wide">Trigger</p>
          <p className="font-semibold text-foreground">{label}</p>
        </div>
      </div>
      
      {data.config?.description && (
        <p className="mt-2 text-xs text-muted-foreground">{data.config.description}</p>
      )}
    </div>
  );
});

TriggerNode.displayName = "TriggerNode";
