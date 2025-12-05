import { memo } from "react";
import { NodeProps } from "reactflow";
import { StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkflowNodeData } from "@/types/agentBuilder";

export const NoteNode = memo(({ data, selected }: NodeProps<WorkflowNodeData>) => {
  return (
    <div
      className={cn(
        "relative min-w-[200px] max-w-[300px] rounded-xl border-2 bg-gradient-to-br from-yellow-500/10 to-amber-500/10 p-4 shadow-lg transition-all",
        selected ? "border-yellow-500/70 ring-2 ring-yellow-500/30" : "border-yellow-500/30"
      )}
    >
      <div className="flex items-start gap-2">
        <StickyNote className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          {data.label && (
            <p className="font-medium text-foreground text-sm mb-1">{data.label}</p>
          )}
          <p className="text-xs text-muted-foreground whitespace-pre-wrap">
            {data.config?.note_content || "Adicione uma nota..."}
          </p>
        </div>
      </div>
    </div>
  );
});

NoteNode.displayName = "NoteNode";
