import { memo, useMemo } from "react";
import { Target, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GoalGaugeProps {
  label: string;
  currentValue: number;
  targetValue: number;
  onAddGoal?: () => void;
  color?: "primary" | "secondary" | "emerald" | "amber";
}

const colorMap = {
  primary: {
    stroke: "hsl(var(--primary))",
    bg: "hsl(var(--primary) / 0.1)",
    text: "text-primary",
  },
  secondary: {
    stroke: "hsl(var(--secondary))",
    bg: "hsl(var(--secondary) / 0.1)",
    text: "text-secondary",
  },
  emerald: {
    stroke: "hsl(145, 80%, 45%)",
    bg: "hsl(145, 80%, 45%, 0.1)",
    text: "text-emerald-500",
  },
  amber: {
    stroke: "hsl(40, 95%, 50%)",
    bg: "hsl(40, 95%, 50%, 0.1)",
    text: "text-amber-500",
  },
};

export const GoalGauge = memo(function GoalGauge({
  label,
  currentValue,
  targetValue,
  onAddGoal,
  color = "primary",
}: GoalGaugeProps) {
  const colors = colorMap[color];
  const progress = Math.min((currentValue / targetValue) * 100, 100);
  const remaining = Math.max(targetValue - currentValue, 0);
  const exceeded = currentValue > targetValue;

  // SVG Arc calculation with useMemo for performance
  const size = 140;
  const strokeWidth = 12;
  const arcData = useMemo(() => {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const arc = circumference * 0.75; // 270 degrees
    const offset = arc - (arc * Math.min(progress, 100)) / 100;
    return { radius, circumference, arc, offset };
  }, [progress]);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString('pt-BR');
  };

  if (targetValue === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 rounded-xl border border-dashed border-border/50 bg-card/50 h-full min-h-[240px]">
        <div className="p-3 rounded-full bg-muted mb-3">
          <Target className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground mb-3 text-center">
          Nenhuma meta definida
        </p>
        {onAddGoal && (
          <Button size="sm" variant="outline" onClick={onAddGoal}>
            <Plus className="h-4 w-4 mr-2" />
            Criar Meta
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-4 rounded-xl border border-border/50 bg-card/50 h-full min-h-[240px]">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4">
        {label}
      </p>

      <div className="relative">
        <svg
          width={size}
          height={size}
          className="transform -rotate-[135deg]"
        >
          {/* Background arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={arcData.radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={strokeWidth}
            strokeDasharray={arcData.arc}
            strokeDashoffset={0}
            strokeLinecap="round"
          />
          {/* Progress arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={arcData.radius}
            fill="none"
            stroke={colors.stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={arcData.arc}
            strokeDashoffset={arcData.offset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        </svg>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-bold ${exceeded ? 'text-emerald-500' : ''}`}>
            {progress.toFixed(0)}%
          </span>
          <span className="text-xs text-muted-foreground">
            concluído
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 mt-4 text-sm">
        <div className="text-center">
          <p className="font-semibold">{formatNumber(currentValue)}</p>
          <p className="text-xs text-muted-foreground">Atual</p>
        </div>
        <div className="h-8 w-px bg-border" />
        <div className="text-center">
          <p className="font-semibold">{formatNumber(targetValue)}</p>
          <p className="text-xs text-muted-foreground">Meta</p>
        </div>
      </div>

      {exceeded ? (
        <p className="text-xs text-emerald-500 mt-3 font-medium">
          🎉 Meta excedida em {formatNumber(currentValue - targetValue)}!
        </p>
      ) : (
        <p className="text-xs text-muted-foreground mt-3">
          Faltam {formatNumber(remaining)} para a meta
        </p>
      )}
    </div>
  );
});

GoalGauge.displayName = 'GoalGauge';
