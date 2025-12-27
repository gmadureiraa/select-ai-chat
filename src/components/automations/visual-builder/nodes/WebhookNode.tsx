import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Webhook } from "lucide-react";

interface WebhookNodeData {
  label: string;
  isTrigger?: boolean;
  config?: {
    webhook_url?: string;
  };
}

export const WebhookNode = memo(({ data, selected }: NodeProps<WebhookNodeData>) => {
  const isTrigger = data.isTrigger;
  const borderColor = isTrigger ? "blue" : "indigo";

  return (
    <div
      className={`
        relative px-4 py-3 min-w-[180px] rounded-xl border-2 bg-card shadow-sm
        ${selected 
          ? `border-${borderColor}-500 shadow-${borderColor}-500/20 shadow-lg` 
          : `border-${borderColor}-200`
        }
      `}
      style={{
        borderColor: selected ? (isTrigger ? '#3b82f6' : '#6366f1') : (isTrigger ? '#bfdbfe' : '#c7d2fe')
      }}
    >
      {!isTrigger && (
        <Handle
          type="target"
          position={Position.Left}
          className="!w-3 !h-3 !border-2 !border-white"
          style={{ background: isTrigger ? '#3b82f6' : '#6366f1' }}
        />
      )}

      <div className="flex items-center gap-2 mb-2">
        <div 
          className="p-1.5 rounded-lg"
          style={{ background: isTrigger ? '#3b82f6' : '#6366f1' }}
        >
          <Webhook className="h-4 w-4 text-white" />
        </div>
        <span className="font-medium text-sm">
          {data.label || (isTrigger ? "Webhook Trigger" : "Chamar Webhook")}
        </span>
      </div>
      
      {data.config?.webhook_url && (
        <div className="text-xs text-muted-foreground truncate max-w-[160px]">
          {data.config.webhook_url}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !border-2 !border-white"
        style={{ background: isTrigger ? '#3b82f6' : '#6366f1' }}
      />
    </div>
  );
});

WebhookNode.displayName = "WebhookNode";
