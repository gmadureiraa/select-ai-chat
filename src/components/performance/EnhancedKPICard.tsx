import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import { LucideIcon } from "lucide-react";
import { useMemo } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

interface EnhancedKPICardProps {
  title: string;
  value: number;
  change?: number | null;
  changeLabel?: string;
  icon: LucideIcon;
  formatter?: (v: number) => string;
  sparklineData?: number[];
  accentColor?: "primary" | "secondary" | "accent";
}

export function EnhancedKPICard({
  title,
  value,
  change,
  changeLabel = "vs período anterior",
  icon: Icon,
  formatter = (v: number) => v.toLocaleString("pt-BR"),
  sparklineData = [],
  accentColor = "primary",
}: EnhancedKPICardProps) {
  const colorMap = {
    primary: {
      gradient: "from-primary/10 to-transparent",
      stroke: "hsl(var(--primary))",
      fill: "hsl(var(--primary))",
    },
    secondary: {
      gradient: "from-secondary/10 to-transparent",
      stroke: "hsl(var(--secondary))",
      fill: "hsl(var(--secondary))",
    },
    accent: {
      gradient: "from-accent/10 to-transparent",
      stroke: "hsl(var(--accent))",
      fill: "hsl(var(--accent))",
    },
  };

  const colors = colorMap[accentColor];

  const chartData = useMemo(() => {
    return sparklineData.map((value, index) => ({ value, index }));
  }, [sparklineData]);

  const hasValidSparkline = sparklineData.length > 1;
  const isPositive = change !== null && change !== undefined && change >= 0;

  return (
    <Card className="relative overflow-hidden border-border/50 bg-card backdrop-blur-sm transition-all hover:border-border hover:shadow-lg">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg bg-${accentColor}/10`}>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">{title}</span>
          </div>
        </div>
        
        <div className="flex items-end justify-between">
          <div className="space-y-1">
            <div className="text-3xl font-bold tracking-tight">
              {formatter(value)}
            </div>
            {change !== null && change !== undefined && (
              <div className={`text-xs flex items-center gap-1 ${
                isPositive ? "text-emerald-500" : "text-red-500"
              }`}>
                {isPositive ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                <span className="font-medium">
                  {isPositive ? "+" : ""}{change.toFixed(1)}%
                </span>
                <span className="text-muted-foreground font-normal">{changeLabel}</span>
              </div>
            )}
          </div>
          
          {hasValidSparkline && (
            <div className="w-20 h-12">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id={`sparkline-${accentColor}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={colors.fill} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={colors.fill} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={colors.stroke}
                    strokeWidth={1.5}
                    fill={`url(#sparkline-${accentColor})`}
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
