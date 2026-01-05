import { X, FileText, BookOpen, Wand2, Lightbulb, User, Building2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Citation {
  id: string;
  title: string;
  type: "content_library" | "reference_library" | "format" | "assignee" | "client" | "action";
  category: string;
}

interface CitationChipProps {
  citation: Citation;
  onRemove: (id: string) => void;
  className?: string;
}

export const CitationChip = ({ citation, onRemove, className }: CitationChipProps) => {
  // Ícone baseado no tipo e categoria
  const getIcon = () => {
    if (citation.type === "action") return Zap;
    if (citation.type === "assignee") return User;
    if (citation.type === "client") return Building2;
    if (citation.category === "ideias") return Lightbulb;
    if (citation.type === "format") return Wand2;
    if (citation.type === "reference_library") return BookOpen;
    return FileText;
  };
  
  // Cor baseada no tipo e categoria
  const getColorClass = () => {
    if (citation.type === "action") return "bg-violet-500/10 text-violet-600 border-violet-500/20";
    if (citation.type === "assignee") return "bg-indigo-500/10 text-indigo-600 border-indigo-500/20";
    if (citation.type === "client") return "bg-teal-500/10 text-teal-600 border-teal-500/20";
    if (citation.category === "ideias") return "bg-amber-500/10 text-amber-600 border-amber-500/20";
    if (citation.type === "format") return "bg-primary/10 text-primary border-primary/20";
    if (citation.type === "reference_library") return "bg-slate-500/10 text-slate-600 border-slate-500/20";
    return "bg-blue-500/10 text-blue-600 border-blue-500/20";
  };
  
  const Icon = getIcon();
  
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium",
        getColorClass(),
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
