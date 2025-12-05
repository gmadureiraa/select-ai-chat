import { memo } from "react";
import { NodeProps } from "reactflow";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { WorkflowNodeData } from "@/types/agentBuilder";

export const NoteNode = memo(({ data, selected }: NodeProps<WorkflowNodeData>) => {
  return (
    <div
      className={cn(
        "relative min-w-[180px] max-w-[280px] rounded-2xl bg-card border shadow-md transition-all hover:shadow-lg",
        selected ? "border-yellow-500 ring-2 ring-yellow-500/20" : "border-border"
      )}
    >
      {/* Folded corner effect */}
      <div className="absolute top-0 right-0 w-6 h-6 overflow-hidden">
        <div className="absolute top-0 right-0 w-8 h-8 bg-yellow-500/20 transform rotate-45 translate-x-4 -translate-y-4" />
      </div>
      
      <div className="p-4">
        {/* Badge */}
        <Badge 
          variant="secondary" 
          className="mb-3 bg-yellow-500/10 text-yellow-600 border-0 font-medium text-xs"
        >
          <FileText className="h-3 w-3 mr-1" />
          Note
        </Badge>
        
        {/* Content */}
        {data.label && (
          <p className="font-semibold text-foreground text-sm mb-2">{data.label}</p>
        )}
        <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-4">
          {data.config?.note_content || "Adicione uma nota..."}
        </p>
      </div>
    </div>
  );
});

NoteNode.displayName = "NoteNode";
