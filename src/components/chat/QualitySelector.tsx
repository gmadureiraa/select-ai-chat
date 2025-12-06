import { Zap, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface QualitySelectorProps {
  quality: "fast" | "high";
  onChange: (quality: "fast" | "high") => void;
  disabled?: boolean;
}

export const QualitySelector = ({ quality, onChange, disabled }: QualitySelectorProps) => {
  return (
    <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg">
      <button
        onClick={() => onChange("fast")}
        disabled={disabled}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
          quality === "fast"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <Zap className="h-3 w-3" />
        Rápido
      </button>
      <button
        onClick={() => onChange("high")}
        disabled={disabled}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
          quality === "high"
            ? "bg-primary/10 text-primary shadow-sm border border-primary/20"
            : "text-muted-foreground hover:text-foreground",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <Sparkles className="h-3 w-3" />
        Alta Qualidade
      </button>
    </div>
  );
};
