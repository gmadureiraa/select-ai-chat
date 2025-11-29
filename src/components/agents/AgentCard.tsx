import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";

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
  const colorClasses = {
    primary: {
      glow: "shadow-[0_0_50px_hsl(var(--primary)/0.35)]",
      bg: "bg-primary/15",
      border: "border-primary/30",
      text: "text-primary",
    },
    secondary: {
      glow: "shadow-[0_0_50px_hsl(var(--secondary)/0.35)]",
      bg: "bg-secondary/15",
      border: "border-secondary/30",
      text: "text-secondary",
    },
    accent: {
      glow: "shadow-[0_0_50px_hsl(var(--accent)/0.35)]",
      bg: "bg-accent/15",
      border: "border-accent/30",
      text: "text-accent",
    },
  } as const;

  const colors = colorClasses[accentColor];

  return (
    <article
      className={cn(
        "relative w-full max-w-[320px] h-[360px]",
        "rounded-2xl bg-card border border-border/80",
        "flex flex-col overflow-hidden",
        "transition-transform transition-shadow duration-300",
        "hover:-translate-y-1 hover:shadow-xl",
        colors.glow
      )}
    >
      {/* Top visual with animated circle */}
      <div className="relative h-32 overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className={cn(
              "w-24 h-24 rounded-full",
              "animate-float transition-transform duration-500",
              "group-hover:scale-110",
              colors.bg,
              colors.border,
              "border"
            )}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 pb-6 pt-2 flex flex-col gap-4">
        <header className="space-y-1">
          <h3 className="text-lg font-semibold leading-tight text-foreground">
            {title}
          </h3>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {subtitle}
          </p>
        </header>

        <p className="text-xs text-muted-foreground line-clamp-3">
          {description}
        </p>

        <ul className="space-y-1.5 text-xs text-foreground/90">
          {features.map((feature) => (
            <li key={feature} className="flex items-center gap-2">
              <ArrowRight className={cn("w-3 h-3", colors.text)} />
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        <div className="mt-auto space-y-2 pt-4 border-t border-border/80">
          <button
            type="button"
            onClick={onOpen}
            className={cn(
              "w-full flex items-center justify-between",
              "px-3 py-2 rounded-xl text-xs font-semibold",
              "border",
              colors.bg,
              colors.border,
              "hover:bg-background/40 transition-colors"
            )}
          >
            <span className={cn(colors.text)}>Abrir</span>
            <ArrowRight className={cn("w-4 h-4", colors.text)} />
          </button>

          <button
            type="button"
            onClick={onRun}
            className={cn(
              "w-full flex items-center justify-between",
              "px-3 py-2 rounded-xl text-xs font-semibold",
              "bg-foreground/5 hover:bg-foreground/10",
              "border border-foreground/10 text-foreground",
              "transition-colors"
            )}
          >
            <span>Rodar</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </article>
  );
}
