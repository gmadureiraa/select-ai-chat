import { memo, useMemo } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { motion } from "framer-motion";

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

const colorMap = {
  primary: "hsl(var(--primary))",
  secondary: "hsl(var(--secondary))",
  accent: "hsl(var(--accent))",
  emerald: "hsl(145, 80%, 45%)",
  rose: "hsl(350, 80%, 55%)",
  violet: "hsl(270, 70%, 55%)",
  amber: "hsl(40, 95%, 50%)",
  blue: "hsl(210, 80%, 55%)",
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
  const strokeColor = colorMap[color];

  // Render sparkline
  const sparkline = useMemo(() => {
    if (sparklineData.length < 2) return null;
    const max = Math.max(...sparklineData);
    const min = Math.min(...sparklineData);
    const range = max - min || 1;
    const width = 80;
    const height = 32;

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
      <svg width={width} height={height} className="absolute bottom-0 right-0 opacity-30">
        <defs>
          <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity={0.5} />
            <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#gradient-${color})`} />
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      whileHover={{ scale: 1.02, y: -2 }}
      className={`
        relative overflow-hidden rounded-xl border bg-card p-4
        transition-colors duration-200 hover:shadow-lg hover:border-border/80 cursor-default
        ${highlight ? 'border-primary/30 shadow-primary/5 shadow-lg' : 'border-border/50'}
      `}
    >
      {/* Background sparkline */}
      {sparkline}

      {/* Content */}
      <div className="relative z-10">
        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          <div 
            className="p-1.5 rounded-lg" 
            style={{ backgroundColor: `${strokeColor}15` }}
          >
            <Icon className="h-3.5 w-3.5" style={{ color: strokeColor }} />
          </div>
          <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
        </div>

        <div className="flex items-end justify-between">
          <div>
            <p className="text-2xl font-bold tracking-tight">
              {formatValue(value)}
            </p>
            {change !== undefined && (
              <div className={`flex items-center gap-1 text-xs mt-1 ${getTrendColor()}`}>
                {getTrendIcon()}
                <span className="font-medium">
                  {change > 0 ? "+" : ""}{change.toFixed(1)}%
                </span>
                {changeLabel && (
                  <span className="text-muted-foreground ml-1">{changeLabel}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
});

StatCard.displayName = 'StatCard';
