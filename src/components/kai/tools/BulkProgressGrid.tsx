import { Check, Loader2, Clock, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { BulkContentItem } from "@/hooks/useBulkContentCreator";

interface BulkProgressGridProps {
  items: BulkContentItem[];
  isGenerating: boolean;
}

export function BulkProgressGrid({ items, isGenerating }: BulkProgressGridProps) {
  const doneCount = items.filter(i => i.status === 'done').length;
  const errorCount = items.filter(i => i.status === 'error').length;
  const progress = items.length > 0 ? ((doneCount + errorCount) / items.length) * 100 : 0;

  if (items.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {isGenerating ? "Gerando conteúdos..." : "Concluído"}
          </span>
          <span className="font-medium">{doneCount + errorCount}/{items.length}</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Mini status grid */}
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              "h-8 w-8 rounded-lg flex items-center justify-center transition-all",
              item.status === 'done' && "bg-emerald-500/20 text-emerald-600",
              item.status === 'generating' && "bg-primary/20 text-primary animate-pulse",
              item.status === 'pending' && "bg-muted text-muted-foreground",
              item.status === 'error' && "bg-destructive/20 text-destructive"
            )}
            title={`${item.format} #${item.index + 1} - ${item.status}`}
          >
            {item.status === 'done' && <Check className="h-4 w-4" />}
            {item.status === 'generating' && <Loader2 className="h-4 w-4 animate-spin" />}
            {item.status === 'pending' && <Clock className="h-3 w-3" />}
            {item.status === 'error' && <AlertCircle className="h-4 w-4" />}
          </div>
        ))}
      </div>
    </div>
  );
}
