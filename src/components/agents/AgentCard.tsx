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
}

export default function AgentCard({
  title,
  subtitle,
  description,
  features,
  accentColor,
  onOpen,
}: AgentCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  const colorClasses = {
    primary: {
      text: "text-primary",
      bg: "bg-primary/10",
      hover: "hover:bg-primary/20",
      border: "border-primary/30",
      accent: "bg-primary",
    },
    secondary: {
      text: "text-secondary",
      bg: "bg-secondary/10",
      hover: "hover:bg-secondary/20",
      border: "border-secondary/30",
      accent: "bg-secondary",
    },
    accent: {
      text: "text-accent",
      bg: "bg-accent/10",
      hover: "hover:bg-accent/20",
      border: "border-accent/30",
      accent: "bg-accent",
    },
  } as const;

  const colors = colorClasses[accentColor];

  return (
    <div
      className="relative w-full h-[280px] md:h-[320px] group [perspective:2000px] cursor-pointer"
      onMouseEnter={() => setIsFlipped(true)}
      onMouseLeave={() => setIsFlipped(false)}
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <div
        className={cn(
          "relative w-full h-full",
          "[transform-style:preserve-3d]",
          "transition-transform duration-700 ease-out",
          isFlipped ? "[transform:rotateY(180deg)]" : "[transform:rotateY(0deg)]"
        )}
      >
        {/* Front of card */}
        <div
          className={cn(
            "absolute inset-0 w-full h-full",
            "[backface-visibility:hidden]",
            "rounded-2xl overflow-hidden",
            "bg-card border border-border",
            "hover:border-muted-foreground/20",
            "transition-all duration-300"
          )}
        >
          <div className="relative h-full flex flex-col">
            {/* Accent bar */}
            <div className={cn("w-full h-1", colors.accent)} />
            
            {/* Content */}
            <div className="flex-1 flex flex-col justify-between p-4 md:p-6">
              <div className="space-y-8 md:space-y-12">
                <div className={cn(
                  "w-10 h-10 md:w-12 md:h-12 rounded-lg flex items-center justify-center",
                  colors.bg
                )}>
                  <div className={cn("w-5 h-5 md:w-6 md:h-6 rounded-full", colors.accent)} />
                </div>
              </div>

              <div className="space-y-1.5 md:space-y-2">
                <h3 className="text-base md:text-lg font-semibold text-foreground leading-tight tracking-tight">
                  {title}
                </h3>
                <p className="text-xs md:text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                  {subtitle}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Back of card */}
        <div
          className={cn(
            "absolute inset-0 w-full h-full",
            "[backface-visibility:hidden] [transform:rotateY(180deg)]",
            "p-4 md:p-6 rounded-2xl",
            "bg-card border border-border",
            "hover:border-muted-foreground/20",
            "flex flex-col",
            "transition-all duration-300"
          )}
        >
          {/* Accent bar */}
          <div className={cn("absolute top-0 left-0 right-0 h-1", colors.accent)} />

          <div className="flex-1 space-y-4 md:space-y-6 mt-2">
            <div className="space-y-1.5 md:space-y-2">
              <h3 className="text-base md:text-lg font-semibold text-foreground leading-tight tracking-tight">
                {title}
              </h3>
              <p className="text-xs md:text-sm text-muted-foreground leading-relaxed line-clamp-2">
                {description}
              </p>
            </div>

            <div className="space-y-1.5 md:space-y-2">
              {features.map((feature, index) => (
                <div
                  key={feature}
                  className="flex items-center gap-2 text-xs md:text-sm text-foreground transition-all duration-500"
                  style={{
                    transform: isFlipped ? "translateX(0)" : "translateX(-10px)",
                    opacity: isFlipped ? 1 : 0,
                    transitionDelay: `${index * 100 + 200}ms`,
                  }}
                >
                  <ArrowRight className={cn("w-3 h-3 flex-shrink-0", colors.text)} />
                  <span className="leading-tight">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 md:pt-6 mt-4 md:mt-6 border-t border-border">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpen();
              }}
              className={cn(
                "w-full flex items-center justify-between",
                "p-2.5 md:p-3 rounded-xl",
                "transition-all duration-300",
                colors.bg,
                colors.hover,
                colors.border,
                "border",
                "hover:scale-[1.02]"
              )}
            >
              <span className={cn("text-xs md:text-sm font-semibold", colors.text)}>
                Abrir
              </span>
              <ArrowRight className={cn("w-3.5 h-3.5 md:w-4 md:h-4", colors.text)} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}