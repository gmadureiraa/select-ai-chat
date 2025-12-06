import { Lightbulb, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export type ChatMode = "content" | "ideas";

interface ModeSelectorProps {
  mode: ChatMode;
  onChange: (mode: ChatMode) => void;
  disabled?: boolean;
}

export const ModeSelector = ({ mode, onChange, disabled }: ModeSelectorProps) => {
  return (
    <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg">
      <button
        onClick={() => onChange("content")}
        disabled={disabled}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
          mode === "content"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <FileText className="h-3 w-3" />
        Conteúdo
      </button>
      <button
        onClick={() => onChange("ideas")}
        disabled={disabled}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
          mode === "ideas"
            ? "bg-amber-500/10 text-amber-600 shadow-sm border border-amber-500/20"
            : "text-muted-foreground hover:text-foreground",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <Lightbulb className="h-3 w-3" />
        Ideias
      </button>
    </div>
  );
};
