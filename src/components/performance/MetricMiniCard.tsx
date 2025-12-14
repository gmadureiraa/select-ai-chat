import { memo, useMemo } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MetricMiniCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  change?: number;
  sparklineData?: number[];
  color?: "emerald" | "rose" | "blue" | "amber" | "violet";
}

const colorMap = {
  emerald: "hsl(145, 80%, 45%)",
  rose: "hsl(350, 80%, 55%)",
  blue: "hsl(210, 80%, 55%)",
  amber: "hsl(40, 95%, 50%)",
  violet: "hsl(270, 70%, 55%)",
};

export const MetricMiniCard = memo(function MetricMiniCard({
  icon: Icon,
  label,
  value,
  change,
  sparklineData = [],
  color = "blue",
}: MetricMiniCardProps) {
  const strokeColor = colorMap[color];

  const sparkline = useMemo(() => {
    if (sparklineData.length < 2) return null;
    const max = Math.max(...sparklineData);
    const min = Math.min(...sparklineData);
    const range = max - min || 1;
    const width = 60;
    const height = 28;

    const points = sparklineData.map((val, i) => {
      const x = (i / (sparklineData.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg width={width} height={height}>
        <defs>
          <linearGradient id={`mini-gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity={0.3} />
            <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <polyline
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          points={points}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }, [sparklineData, color, strokeColor]);

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
    if (change > 0) return "text-emerald-500";
    if (change < 0) return "text-rose-500";
    return "text-muted-foreground";
  };

  return (
    <div className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-card/50 hover:border-border/80 transition-colors">
      <div className="flex items-center gap-3">
        <div 
          className="p-2 rounded-lg" 
          style={{ backgroundColor: `${strokeColor}15` }}
        >
          <Icon className="h-4 w-4" style={{ color: strokeColor }} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold">{formatValue(value)}</span>
            {change !== undefined && (
              <span className={`flex items-center gap-0.5 text-xs ${getTrendColor()}`}>
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
