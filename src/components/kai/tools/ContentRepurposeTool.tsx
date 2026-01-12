import { useState } from "react";
import { LayoutGrid, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BulkContentCreator } from "./BulkContentCreator";
import { ContentCanvas } from "../canvas/ContentCanvas";

interface ContentRepurposeToolProps {
  clientId: string;
}

type ViewMode = "list" | "canvas";

export function ContentRepurposeTool({ clientId }: ContentRepurposeToolProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  return (
    <div className="h-full flex flex-col">
      {/* View toggle */}
      <div className="flex items-center justify-end gap-1 px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-muted">
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("list")}
            className={cn(
              "h-7 gap-1.5 text-xs",
              viewMode === "list" && "shadow-sm"
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Lista
          </Button>
          <Button
            variant={viewMode === "canvas" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("canvas")}
            className={cn(
              "h-7 gap-1.5 text-xs",
              viewMode === "canvas" && "shadow-sm"
            )}
          >
            <GitBranch className="h-3.5 w-3.5" />
            Canvas
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {viewMode === "list" ? (
          <div className="h-full overflow-y-auto">
            <BulkContentCreator clientId={clientId} />
          </div>
        ) : (
          <ContentCanvas clientId={clientId} />
        )}
      </div>
    </div>
  );
}
