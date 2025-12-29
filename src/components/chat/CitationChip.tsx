import { X, FileText, BookOpen, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Citation {
  id: string;
  title: string;
  type: "content_library" | "reference_library" | "format";
  category: string;
}

interface CitationChipProps {
  citation: Citation;
  onRemove: (id: string) => void;
  className?: string;
}

export const CitationChip = ({ citation, onRemove, className }: CitationChipProps) => {
  const Icon = citation.type === "format" 
    ? Wand2 
    : citation.type === "reference_library" 
      ? BookOpen 
      : FileText;
  
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium",
        "bg-primary/10 text-primary border border-primary/20",
        "max-w-[200px] group",
        className
      )}
    >
      <Icon className="h-3 w-3 shrink-0" />
      <span className="truncate">{citation.title}</span>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRemove(citation.id);
        }}
        className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity shrink-0"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
};
