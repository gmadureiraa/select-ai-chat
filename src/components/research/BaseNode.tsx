import { memo, ReactNode } from "react";
import { Handle, Position } from "reactflow";
import { Trash2, LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BaseNodeProps {
  id: string;
  onDelete: (id: string) => void;
  icon: LucideIcon;
  iconColor: string;
  bgColor: string;
  borderColor: string;
  label: string;
  title?: string;
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
  isConnected?: boolean;
  isProcessing?: boolean;
}

export const BaseNode = memo(({
  id,
  onDelete,
  icon: Icon,
  iconColor,
  bgColor,
  borderColor,
  label,
  title,
  badge,
  children,
  className,
  isConnected,
  isProcessing,
}: BaseNodeProps) => {
  return (
    <div
      className={cn(
        "bg-card border-2 rounded-xl shadow-md hover:shadow-lg transition-all",
        "group relative focus:outline-none focus:ring-2 focus:ring-primary/50",
        borderColor,
        isConnected && "ring-2 ring-primary/30",
        isProcessing && "ring-2 ring-primary animate-pulse",
        className
      )}
    >
      {/* Handles - All 4 positions */}
      <Handle 
        type="target" 
        position={Position.Top} 
        className="!w-3 !h-3 !bg-muted-foreground/50 hover:!bg-primary transition-colors !border-2 !border-background" 
      />
      <Handle 
        type="source" 
        position={Position.Bottom} 
        className="!w-3 !h-3 !bg-muted-foreground/50 hover:!bg-primary transition-colors !border-2 !border-background" 
      />
      <Handle 
        type="target" 
        position={Position.Left} 
        className="!w-3 !h-3 !bg-muted-foreground/50 hover:!bg-primary transition-colors !border-2 !border-background" 
        id="left"
      />
      <Handle 
        type="source" 
        position={Position.Right} 
        className="!w-3 !h-3 !bg-muted-foreground/50 hover:!bg-primary transition-colors !border-2 !border-background" 
        id="right"
      />

      {/* Delete Button - Always visible, consistent position */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-7 w-7 rounded-full bg-destructive/10 hover:bg-destructive/20 text-destructive z-10"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(id);
        }}
        title="Excluir (Delete)"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>

      {/* Header */}
      <div className="flex items-start gap-3 p-3 pb-2">
        <div className={cn("p-2 rounded-lg border", bgColor)}>
          <Icon className={cn("h-4 w-4", iconColor)} />
        </div>
        <div className="flex-1 min-w-0 pr-8">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn(
              "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium",
              bgColor, iconColor.replace("text-", "text-").replace("-500", "-700")
            )}>
              {label}
            </span>
            {badge}
          </div>
          {title && (
            <h3 className="font-semibold text-sm text-foreground mt-1 truncate">
              {title}
            </h3>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-3 pb-3">
        {children}
      </div>
    </div>
  );
});

BaseNode.displayName = "BaseNode";
