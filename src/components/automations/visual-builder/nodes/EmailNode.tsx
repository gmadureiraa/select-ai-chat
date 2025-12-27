import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Mail } from "lucide-react";

interface EmailNodeData {
  label: string;
  config?: {
    email_recipients?: string[];
    email_subject?: string;
  };
}

export const EmailNode = memo(({ data, selected }: NodeProps<EmailNodeData>) => {
  return (
    <div
      className={`
        relative px-4 py-3 min-w-[180px] rounded-xl border-2 bg-card shadow-sm
        ${selected ? "border-teal-500 shadow-teal-500/20 shadow-lg" : "border-teal-200"}
      `}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-teal-500 !border-2 !border-white"
      />

      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-lg bg-teal-500">
          <Mail className="h-4 w-4 text-white" />
        </div>
        <span className="font-medium text-sm">{data.label || "Enviar Email"}</span>
      </div>
      
      {data.config?.email_recipients && data.config.email_recipients.length > 0 && (
        <div className="text-xs text-muted-foreground">
          {data.config.email_recipients.length} destinatário(s)
        </div>
      )}
    </div>
  );
});

EmailNode.displayName = "EmailNode";
