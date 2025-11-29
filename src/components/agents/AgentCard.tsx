import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";
import { useState } from "react";

export interface AgentCardProps {
  title: string;
  subtitle: string;
  description: string;
  features: string[];
  accentColor: "primary" | "secondary" | "accent";
  onOpen: () => void;
  onRun: () => void;
}

export default function AgentCard({
  title,
  subtitle,
  description,
  features,
  accentColor,
  onOpen,
  onRun,
}: AgentCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  const colorClasses = {
    primary: {
      glow: "shadow-[0_0_50px_hsl(var(--primary)/0.3)]",
      text: "text-primary",
      bg: "bg-primary/10",
      hover: "hover:bg-primary/20",
      border: "border-primary/20",
    },
    secondary: {
      glow: "shadow-[0_0_50px_hsl(var(--secondary)/0.3)]",
      text: "text-secondary",
      bg: "bg-secondary/10",
      hover: "hover:bg-secondary/20",
      border: "border-secondary/20",
    },
    accent: {
      glow: "shadow-[0_0_50px_hsl(var(--accent)/0.3)]",
      text: "text-accent",
      bg: "bg-accent/10",
      hover: "hover:bg-accent/20",
      border: "border-accent/20",
    },
  };

  const colors = colorClasses[accentColor];

  return (
    <div
      className="relative w-full max-w-[320px] h-[360px] group [perspective:2000px]"
      onMouseEnter={() => setIsFlipped(true)}
      onMouseLeave={() => setIsFlipped(false)}
    >
      <div
        className={cn(
          "relative w-full h-full",
          "[transform-style:preserve-3d]",
          "transition-all duration-700",
          isFlipped ? "[transform:rotateY(180deg)]" : "[transform:rotateY(0deg)]"
        )}
      >
        {/* Front of card */}
        <div
          className={cn(
            "absolute inset-0 w-full h-full",
            "[backface-visibility:hidden] [transform:rotateY(0deg)]",
            "overflow-hidden rounded-2xl",
            "bg-card border border-border",
            "transition-all duration-700",
            isFlipped ? "opacity-0" : "opacity-100"
          )}
        >
          <div className="relative h-full overflow-hidden">
            {/* Animated colored circle */}
            <div className="absolute inset-0 flex items-start justify-center pt-20">
              <div 
                className={cn(
                  "w-24 h-24 rounded-full transition-all duration-700",
                  "animate-float",
                  colors.bg,
                  colors.glow,
                  "group-hover:scale-125"
                )}
              />
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-6">
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-foreground leading-tight tracking-tight">
                {title}
              </h3>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {subtitle}
              </p>
            </div>
          </div>
        </div>

        {/* Back of card */}
        <div
          className={cn(
            "absolute inset-0 w-full h-full",
            "[backface-visibility:hidden] [transform:rotateY(180deg)]",
            "p-6 rounded-2xl",
            "bg-card border border-border",
            "flex flex-col",
            "transition-all duration-700",
            !isFlipped ? "opacity-0" : "opacity-100"
          )}
        >
          <div className="flex-1 space-y-6">
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-foreground leading-tight tracking-tight">
                {title}
              </h3>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {description}
              </p>
            </div>

            <div className="space-y-2">
              {features.map((feature, index) => (
                <div
                  key={feature}
                  className="flex items-center gap-2 text-sm text-foreground transition-all duration-500"
                  style={{
                    transform: isFlipped ? "translateX(0)" : "translateX(-10px)",
                    opacity: isFlipped ? 1 : 0,
                    transitionDelay: `${index * 100 + 200}ms`,
                  }}
                >
                  <ArrowRight className={cn("w-3 h-3", colors.text)} />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3 pt-6 mt-6 border-t border-border">
            <button
              onClick={onOpen}
              className={cn(
                "w-full flex items-center justify-between",
                "p-3 rounded-xl",
                "transition-all duration-300",
                colors.bg,
                colors.hover,
                colors.border,
                "border",
                "hover:scale-[1.02]"
              )}
            >
              <span className={cn("text-sm font-semibold", colors.text)}>
                Abrir
              </span>
              <ArrowRight className={cn("w-4 h-4", colors.text)} />
            </button>
            
            <button
              onClick={onRun}
              className={cn(
                "w-full flex items-center justify-between",
                "p-3 rounded-xl",
                "transition-all duration-300",
                "bg-foreground/5",
                "hover:bg-foreground/10",
                "border border-foreground/10",
                "hover:scale-[1.02]"
              )}
            >
              <span className="text-sm font-semibold text-foreground">
                Rodar
              </span>
              <ArrowRight className="w-4 h-4 text-foreground" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
