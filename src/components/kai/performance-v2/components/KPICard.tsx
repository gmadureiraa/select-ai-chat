import * as React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type KPITrend = "up" | "down" | "neutral";

export interface KPICardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon?: React.ReactNode;
  trend?: KPITrend;
  trendValue?: string;
  loading?: boolean;
  onClick?: () => void;
  className?: string;
}

const ptBR = new Intl.NumberFormat("pt-BR");

function formatValue(value: string | number): string {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "—";
    return ptBR.format(value);
  }
  return value;
}

export function KPICard({
  label,
  value,
  subValue,
  icon,
  trend,
  trendValue,
  loading,
  onClick,
  className,
}: KPICardProps) {
  const trendColor =
    trend === "up"
      ? "text-emerald-600 dark:text-emerald-400"
      : trend === "down"
        ? "text-red-600 dark:text-red-400"
        : "text-muted-foreground";

  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  const interactive = typeof onClick === "function";

  return (
    <Card
      onClick={onClick}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={cn(
        "transition-all",
        interactive &&
          "cursor-pointer hover:ring-2 hover:ring-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        className,
      )}
    >
      <CardContent className="p-4 pt-4">
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
          {icon ? <span className="text-muted-foreground shrink-0">{icon}</span> : null}
        </div>

        {loading ? (
          <div className="mt-2 space-y-2">
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        ) : (
          <>
            <div className="mt-1 text-2xl font-bold tabular-nums leading-tight">
              {formatValue(value)}
            </div>

            {(subValue || trendValue) && (
              <div className="mt-1 flex items-center gap-2 text-xs">
                {trendValue ? (
                  <span className={cn("inline-flex items-center gap-1 font-medium", trendColor)}>
                    <TrendIcon className="h-3 w-3" />
                    {trendValue}
                  </span>
                ) : null}
                {subValue ? <span className="text-muted-foreground">{subValue}</span> : null}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default KPICard;
