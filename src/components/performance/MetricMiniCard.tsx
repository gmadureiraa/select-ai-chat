import { memo, useMemo } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricMiniCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  change?: number;
  sparklineData?: number[];
  color?: "emerald" | "rose" | "blue" | "amber" | "violet";
}

// Simplified color config using theme variables
const colorConfig = {
  emerald: {
    bg: "bg-primary/10",
    icon: "text-primary",
    stroke: "hsl(var(--primary))",
  },
  rose: {
    bg: "bg-primary/10",
    icon: "text-primary",
    stroke: "hsl(var(--primary))",
  },
  blue: {
    bg: "bg-primary/10",
    icon: "text-primary",
    stroke: "hsl(var(--primary))",
  },
  amber: {
    bg: "bg-primary/10",
    icon: "text-primary",
    stroke: "hsl(var(--primary))",
  },
  violet: {
    bg: "bg-primary/10",
    icon: "text-primary",
    stroke: "hsl(var(--primary))",
  },
};

export const MetricMiniCard = memo(function MetricMiniCard({
  icon: Icon,
  label,
  value,
  change,
  sparklineData = [],
  color = "blue",
}: MetricMiniCardProps) {
  const colors = colorConfig[color];

  const sparkline = useMemo(() => {
    if (sparklineData.length < 2) return null;
    const max = Math.max(...sparklineData);
    const min = Math.min(...sparklineData);
    const range = max - min || 1;
    const width = 56;
    const height = 24;

    const points = sparklineData.map((val, i) => {
      const x = (i / (sparklineData.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg width={width} height={height} className="flex-shrink-0">
        <defs>
          <linearGradient id={`mini-gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors.stroke} stopOpacity={0.25} />
            <stop offset="100%" stopColor={colors.stroke} stopOpacity={0} />
          </linearGradient>
        </defs>
        <polyline
          fill="none"
          stroke={colors.stroke}
          strokeWidth="1.5"
          points={points}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }, [sparklineData, color, colors.stroke]);

  const formatValue = (val: string | number) => {
    if (typeof val === "number") {
      if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
      if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
      return val.toLocaleString('pt-BR');
    }
    return val;
  };

  const getTrendIcon = () => {
    if (change === undefined) return null;
    if (change > 0) return <TrendingUp className="h-3 w-3" />;
    if (change < 0) return <TrendingDown className="h-3 w-3" />;
    return <Minus className="h-3 w-3" />;
  };

  const getTrendColor = () => {
    if (change === undefined) return "text-muted-foreground";
    if (change > 0) return "text-emerald-600 dark:text-emerald-400";
    if (change < 0) return "text-rose-600 dark:text-rose-400";
    return "text-muted-foreground";
  };

  return (
    <div className="flex items-center justify-between p-3.5 rounded-lg border border-border/50 bg-card shadow-card hover:shadow-card-hover transition-all duration-200">
      <div className="flex items-center gap-3">
        <div className={cn("p-2 rounded-md", colors.bg)}>
          <Icon className={cn("h-4 w-4", colors.icon)} />
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground font-medium">{label}</p>
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold">{formatValue(value)}</span>
            {change !== undefined && (
              <span className={cn("flex items-center gap-0.5 text-[11px]", getTrendColor())}>
                {getTrendIcon()}
                {change > 0 ? "+" : ""}{change.toFixed(0)}%
              </span>
            )}
          </div>
        </div>
      </div>
      {sparkline}
    </div>
  );
});

MetricMiniCard.displayName = 'MetricMiniCard';
