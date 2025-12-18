import { memo, useMemo } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  sparklineData?: number[];
  color?: "primary" | "secondary" | "accent" | "emerald" | "rose" | "violet" | "amber" | "blue";
  highlight?: boolean;
}

const colorConfig = {
  primary: {
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
    icon: "text-emerald-600 dark:text-emerald-400",
    stroke: "hsl(145, 75%, 45%)",
  },
  secondary: {
    bg: "bg-pink-50 dark:bg-pink-500/10",
    icon: "text-pink-600 dark:text-pink-400",
    stroke: "hsl(330, 85%, 55%)",
  },
  accent: {
    bg: "bg-orange-50 dark:bg-orange-500/10",
    icon: "text-orange-600 dark:text-orange-400",
    stroke: "hsl(25, 95%, 55%)",
  },
  emerald: {
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
    icon: "text-emerald-600 dark:text-emerald-400",
    stroke: "hsl(145, 75%, 45%)",
  },
  rose: {
    bg: "bg-rose-50 dark:bg-rose-500/10",
    icon: "text-rose-600 dark:text-rose-400",
    stroke: "hsl(350, 80%, 55%)",
  },
  violet: {
    bg: "bg-violet-50 dark:bg-violet-500/10",
    icon: "text-violet-600 dark:text-violet-400",
    stroke: "hsl(270, 70%, 55%)",
  },
  amber: {
    bg: "bg-amber-50 dark:bg-amber-500/10",
    icon: "text-amber-600 dark:text-amber-400",
    stroke: "hsl(40, 95%, 50%)",
  },
  blue: {
    bg: "bg-blue-50 dark:bg-blue-500/10",
    icon: "text-blue-600 dark:text-blue-400",
    stroke: "hsl(210, 80%, 55%)",
  },
};

export const StatCard = memo(function StatCard({
  icon: Icon,
  label,
  value,
  change,
  changeLabel,
  sparklineData = [],
  color = "primary",
  highlight = false,
}: StatCardProps) {
  const colors = colorConfig[color];

  // Render sparkline
  const sparkline = useMemo(() => {
    if (sparklineData.length < 2) return null;
    const max = Math.max(...sparklineData);
    const min = Math.min(...sparklineData);
    const range = max - min || 1;
    const width = 64;
    const height = 28;

    const points = sparklineData.map((val, i) => {
      const x = (i / (sparklineData.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    }).join(' ');

    // Create area path
    const firstX = 0;
    const lastX = width;
    const areaPath = `M${firstX},${height} L${points.split(' ').map(p => p).join(' L')} L${lastX},${height} Z`;

    return (
      <svg width={width} height={height} className="flex-shrink-0">
        <defs>
          <linearGradient id={`stat-gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors.stroke} stopOpacity={0.25} />
            <stop offset="100%" stopColor={colors.stroke} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#stat-gradient-${color})`} />
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
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border bg-card p-3.5 shadow-card hover:shadow-card-hover transition-all duration-200",
        highlight ? "border-primary/30" : "border-border/50"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2.5">
        <div className={cn("p-1.5 rounded-md", colors.bg)}>
          <Icon className={cn("h-3.5 w-3.5", colors.icon)} />
        </div>
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide truncate">
          {label}
        </span>
      </div>

      {/* Value + Sparkline */}
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xl font-semibold tracking-tight text-foreground">
            {formatValue(value)}
          </p>
          {change !== undefined && (
            <div className={cn("flex items-center gap-1 text-[11px] mt-0.5", getTrendColor())}>
              {getTrendIcon()}
              <span className="font-medium">
                {change > 0 ? "+" : ""}{change.toFixed(1)}%
              </span>
              {changeLabel && (
                <span className="text-muted-foreground ml-0.5 hidden sm:inline">{changeLabel}</span>
              )}
            </div>
          )}
        </div>
        {sparkline}
      </div>
    </div>
  );
});

StatCard.displayName = 'StatCard';
