import { cn } from "@/lib/utils";
import { ArrowRight, Clock } from "lucide-react";
import { useState } from "react";

export interface AgentCardProps {
  title: string;
  subtitle: string;
  description: string;
  features: string[];
  accentColor: "primary" | "secondary" | "accent" | "white" | "purple" | "yellow";
  onOpen: () => void;
  comingSoon?: boolean;
}

export default function AgentCard({
  title,
  subtitle,
  description,
  features,
  accentColor,
  onOpen,
  comingSoon = false,
}: AgentCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  const colorClasses = {
    primary: {
      glow: "shadow-[0_0_50px_hsl(var(--primary)/0.35)]",
      glowFlipped: "shadow-[0_0_50px_hsl(var(--primary)/0.35)]",
      text: "text-primary",
      bg: "bg-primary/10",
      hover: "hover:bg-primary/20",
      border: "border-primary/20",
    },
    secondary: {
      glow: "shadow-[0_0_50px_hsl(var(--secondary)/0.35)]",
      glowFlipped: "shadow-[0_0_50px_hsl(var(--secondary)/0.35)]",
      text: "text-secondary",
      bg: "bg-secondary/10",
      hover: "hover:bg-secondary/20",
      border: "border-secondary/20",
    },
    accent: {
      glow: "shadow-[0_0_50px_hsl(var(--accent)/0.35)]",
      glowFlipped: "shadow-[0_0_50px_hsl(var(--accent)/0.35)]",
      text: "text-accent",
      bg: "bg-accent/10",
      hover: "hover:bg-accent/20",
      border: "border-accent/20",
    },
    white: {
      glow: "shadow-[0_0_50px_hsl(0_0%_100%/0.5)]",
      glowFlipped: "shadow-[0_0_50px_hsl(0_0%_0%/0.35)]",
      text: "text-foreground",
      bg: "bg-foreground/10",
      hover: "hover:bg-foreground/20",
      border: "border-foreground/20",
    },
    purple: {
      glow: "shadow-[0_0_50px_hsl(280_100%_60%/0.45)]",
      glowFlipped: "shadow-[0_0_50px_hsl(280_100%_60%/0.45)]",
      text: "text-[hsl(280_100%_70%)]",
      bg: "bg-[hsl(280_100%_60%/0.1)]",
      hover: "hover:bg-[hsl(280_100%_60%/0.2)]",
      border: "border-[hsl(280_100%_60%/0.2)]",
    },
    yellow: {
      glow: "shadow-[0_0_50px_hsl(45_100%_50%/0.45)]",
      glowFlipped: "shadow-[0_0_50px_hsl(45_100%_50%/0.45)]",
      text: "text-[hsl(45_100%_50%)]",
      bg: "bg-[hsl(45_100%_50%/0.1)]",
      hover: "hover:bg-[hsl(45_100%_50%/0.2)]",
      border: "border-[hsl(45_100%_50%/0.2)]",
    },
  } as const;

  const colors = colorClasses[accentColor];

  return (
    <div
      className={cn(
        "relative w-full max-w-[280px] h-[320px] group [perspective:2000px]",
        comingSoon ? "cursor-default" : "cursor-pointer"
      )}
      onMouseEnter={() => setIsFlipped(true)}
      onMouseLeave={() => setIsFlipped(false)}
      onClick={comingSoon ? undefined : onOpen}
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
            "shadow-sm",
            "transition-all duration-700",
            "group-hover:shadow-md",
            isFlipped ? "opacity-0" : "opacity-100"
          )}
        >
          <div className="relative h-full overflow-hidden">
            {/* Círculo colorido animado (copiado da ref) */}
            <div className="absolute inset-0 flex items-start justify-center pt-24">
              <div className="relative w-[200px] h-[100px] flex items-center justify-center">
                {[...Array(10)].map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "absolute w-[50px] h-[50px] rounded-[140px]",
                      "animate-agent-circle opacity-0",
                      "group-hover:animate-[agent-circle_2s_linear_infinite]",
                      "transition-shadow duration-500",
                      isFlipped ? colors.glowFlipped : colors.glow
                    )}
                    style={{ animationDelay: `${i * 0.3}s` }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-5">
            <div className="space-y-1.5">
              <h3 className="text-lg font-semibold text-foreground leading-snug tracking-tight">
                {title}
              </h3>
              <p className="text-sm text-muted-foreground line-clamp-2 tracking-tight">
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
            "shadow-sm",
            "flex flex-col",
            "transition-all duration-700",
            "group-hover:shadow-md",
            !isFlipped ? "opacity-0" : "opacity-100"
          )}
        >
          {comingSoon ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <Clock className="w-12 h-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Em breve
              </h3>
              <p className="text-sm text-muted-foreground">
                Este agente está em desenvolvimento
              </p>
            </div>
          ) : (
            <>
              <div className="flex-1 space-y-6">
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-foreground leading-snug tracking-tight">
                    {title}
                  </h3>
                  <p className="text-sm text-muted-foreground tracking-tight line-clamp-2">
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

              <div className="pt-6 mt-6 border-t border-border">
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
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
