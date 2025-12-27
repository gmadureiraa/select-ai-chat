import { TrendingUp, TrendingDown, AlertTriangle, Clock, Zap, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  sublabel: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  variant?: "default" | "error";
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
          variant === "error" && "text-destructive"
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
  failureRate?: number;
  timeSaved?: string;
  avgRunTime?: number;
  executionsChange?: number;
  failedChange?: number;
  failureRateChange?: number;
  runTimeChange?: number;
}

export const AutomationStatsOverview = ({
  totalExecutions = 0,
  failedExecutions = 0,
  failureRate = 0,
  timeSaved = "--",
  avgRunTime = 0,
  executionsChange,
  failedChange,
  failureRateChange,
  runTimeChange,
}: AutomationStatsOverviewProps) => {
  return (
    <Card className="mb-6 overflow-hidden">
      <div className="grid grid-cols-5 divide-x divide-border">
        <StatCard
          label="Prod. executions"
          sublabel="Last 7 days"
          value={totalExecutions}
          change={executionsChange}
        />
        <StatCard
          label="Failed prod. executions"
          sublabel="Last 7 days"
          value={failedExecutions}
          change={failedChange}
          variant="error"
        />
        <StatCard
          label="Failure rate"
          sublabel="Last 7 days"
          value={`${failureRate.toFixed(1)}%`}
          change={failureRateChange}
          changeLabel="pp"
          variant={failureRate > 20 ? "error" : "default"}
        />
        <StatCard
          label="Time saved"
          sublabel="Last 7 days"
          value={timeSaved}
        />
        <StatCard
          label="Run time (avg.)"
          sublabel="Last 7 days"
          value={`${avgRunTime.toFixed(2)}s`}
          change={runTimeChange}
        />
      </div>
    </Card>
  );
};
