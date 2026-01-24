import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { LucideIcon } from "lucide-react";
import { useMemo } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

interface EnhancedKPICardProps {
  title: string;
  value: number;
  change?: number | null;
  changeLabel?: string;
  icon: LucideIcon;
  formatter?: (v: number) => string;
  sparklineData?: number[];
  color?: "primary" | "secondary" | "muted";
}

// Simplified color map - uses theme colors
const colorMap = {
  primary: {
    bg: "bg-accent",
    icon: "text-primary",
    stroke: "hsl(var(--primary))",
  },
  secondary: {
    bg: "bg-accent/50",
    icon: "text-accent-foreground",
    stroke: "hsl(var(--chart-2))",
  },
  muted: {
    bg: "bg-muted",
    icon: "text-muted-foreground",
    stroke: "hsl(var(--chart-3))",
  },
};

export function EnhancedKPICard({
  title,
  value,
  change,
  changeLabel = "vs período anterior",
  icon: Icon,
  formatter = (v: number) => v.toLocaleString("pt-BR"),
  sparklineData = [],
  color = "primary",
}: EnhancedKPICardProps) {
  const colors = colorMap[color] || colorMap.primary;

  const chartData = useMemo(() => {
    return sparklineData.map((value, index) => ({ value, index }));
  }, [sparklineData]);

  const hasValidSparkline = sparklineData.length > 1;
  const isPositive = change !== null && change !== undefined && change >= 0;
  const isNeutral = change !== null && change !== undefined && change === 0;

  return (
    <Card className="relative overflow-hidden border border-border/50 bg-card shadow-card hover:shadow-card-hover transition-all duration-200">
      <CardContent className="p-4">
        {/* Header row: icon + title */}
        <div className="flex items-center gap-2 mb-3">
          <div className={cn("p-1.5 rounded-md", colors.bg)}>
            <Icon className={cn("h-3.5 w-3.5", colors.icon)} />
          </div>
          <span className="text-xs font-medium text-muted-foreground">{title}</span>
        </div>
        
        {/* Value row */}
        <div className="flex items-end justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="text-2xl font-semibold tracking-tight text-foreground">
              {formatter(value)}
            </div>
            {change !== null && change !== undefined && (
              <div className={cn(
                "text-xs flex items-center gap-1",
                isNeutral ? "text-muted-foreground" : isPositive ? "text-primary" : "text-destructive"
              )}>
                {isNeutral ? (
                  <Minus className="h-3 w-3" />
                ) : isPositive ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                <span className="font-medium">
                  {isPositive ? "+" : ""}{change.toFixed(1)}%
                </span>
                <span className="text-muted-foreground font-normal hidden sm:inline">{changeLabel}</span>
              </div>
            )}
          </div>
          
          {hasValidSparkline && (
            <div className="w-16 h-10 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id={`sparkline-gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={colors.stroke} stopOpacity={0.25} />
                      <stop offset="100%" stopColor={colors.stroke} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={colors.stroke}
                    strokeWidth={1.5}
                    fill={`url(#sparkline-gradient-${color})`}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
