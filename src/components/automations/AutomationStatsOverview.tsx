import { TrendingUp, TrendingDown, AlertTriangle, Clock, Zap, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  sublabel: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  variant?: "default" | "error" | "success";
}

const StatCard = ({ label, sublabel, value, change, changeLabel, variant = "default" }: StatCardProps) => {
  const isNegative = change && change < 0;
  const isPositive = change && change > 0;
  
  return (
    <div className="flex flex-col gap-1 p-4">
      <div className="text-sm font-medium text-muted-foreground">{label}</div>
      <div className="text-xs text-muted-foreground/70">{sublabel}</div>
      <div className="flex items-baseline gap-2 mt-1">
        <span className={cn(
          "text-2xl font-bold",
          variant === "error" && "text-destructive",
          variant === "success" && "text-green-500"
        )}>
          {value}
        </span>
        {change !== undefined && (
          <span className={cn(
            "text-xs flex items-center gap-0.5",
            isNegative && "text-green-500",
            isPositive && variant === "error" && "text-destructive",
            isPositive && variant !== "error" && "text-green-500",
            !isPositive && !isNegative && "text-muted-foreground"
          )}>
            {isPositive ? <TrendingUp className="h-3 w-3" /> : isNegative ? <TrendingDown className="h-3 w-3" /> : null}
            {isPositive ? "+" : ""}{change}%
            {changeLabel && <span className="ml-1 text-muted-foreground">{changeLabel}</span>}
          </span>
        )}
      </div>
    </div>
  );
};

interface AutomationStatsOverviewProps {
  totalExecutions?: number;
  failedExecutions?: number;
  successExecutions?: number;
  failureRate?: number;
  avgRunTime?: number;
}

export const AutomationStatsOverview = ({
  totalExecutions = 0,
  failedExecutions = 0,
  successExecutions = 0,
  failureRate = 0,
  avgRunTime = 0,
}: AutomationStatsOverviewProps) => {
  const successRate = totalExecutions > 0 ? ((successExecutions / totalExecutions) * 100) : 0;
  
  return (
    <Card className="mb-6 overflow-hidden">
      <div className="grid grid-cols-5 divide-x divide-border">
        <StatCard
          label="Total de Execuções"
          sublabel="Últimos 7 dias"
          value={totalExecutions}
        />
        <StatCard
          label="Execuções com Sucesso"
          sublabel="Últimos 7 dias"
          value={successExecutions}
          variant="success"
        />
        <StatCard
          label="Execuções com Erro"
          sublabel="Últimos 7 dias"
          value={failedExecutions}
          variant="error"
        />
        <StatCard
          label="Taxa de Sucesso"
          sublabel="Últimos 7 dias"
          value={`${successRate.toFixed(1)}%`}
          variant={successRate >= 80 ? "success" : successRate < 50 ? "error" : "default"}
        />
        <StatCard
          label="Tempo Médio"
          sublabel="Últimos 7 dias"
          value={`${avgRunTime.toFixed(2)}s`}
        />
      </div>
    </Card>
  );
};