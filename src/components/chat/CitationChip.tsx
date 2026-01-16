import { X, FileText, Lightbulb, BookOpen, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Citation } from "@/types/citation";

// Re-export Citation type for backward compatibility
export type { Citation } from "@/types/citation";

interface CitationChipProps {
  citation: Citation;
  onRemove?: (id: string) => void;
  className?: string;
}

const getCitationIcon = (citation: Citation) => {
  if (citation.category === "ideias") return Lightbulb;
  if (citation.type === "format") return Wand2;
  if (citation.type === "reference_library") return BookOpen;
  return FileText;
};

const getCitationColorClass = (citation: Citation) => {
  if (citation.category === "ideias") return "bg-amber-500/10 text-amber-600 border-amber-500/20";
  if (citation.type === "format") return "bg-primary/10 text-primary border-primary/20";
  if (citation.type === "reference_library") return "bg-slate-500/10 text-slate-600 border-slate-500/20";
  return "bg-blue-500/10 text-blue-600 border-blue-500/20";
};

export function CitationChip({ citation, onRemove, className }: CitationChipProps) {
  const Icon = getCitationIcon(citation);
  const colorClass = getCitationColorClass(citation);

  return (
    <Badge
      variant="secondary"
      className={cn(
        "gap-1.5 pr-1 text-xs font-medium border transition-colors",
        colorClass,
        className
      )}
    >
      <Icon className="h-3 w-3" />
      <span className="max-w-[120px] truncate">{citation.title}</span>
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(citation.id);
          }}
          className="ml-0.5 p-0.5 rounded-full hover:bg-foreground/10 transition-colors"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </Badge>
  );
}
