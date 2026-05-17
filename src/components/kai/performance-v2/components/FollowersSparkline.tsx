import * as React from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip } from "recharts";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface FollowersSparklinePoint {
  date: string;
  value: number;
}

export interface FollowersSparklineProps {
  data: FollowersSparklinePoint[];
  height?: number;
  color?: string;
  loading?: boolean;
  className?: string;
}

const ptBR = new Intl.NumberFormat("pt-BR");
const ptBRSigned = new Intl.NumberFormat("pt-BR", { signDisplay: "exceptZero" });

function formatDateLabel(raw: string): string {
  if (!raw) return "";
  // Try to parse as ISO; fall back to raw string
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

interface SparklineTooltipPayload {
  payload?: FollowersSparklinePoint;
  value?: number;
}

function SparklineTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: SparklineTooltipPayload[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  return (
    <div className="rounded-md border bg-popover px-2 py-1 text-xs shadow-sm">
      <div className="font-medium">{ptBR.format(point.value)}</div>
      <div className="text-muted-foreground">{formatDateLabel(point.date)}</div>
    </div>
  );
}

export function FollowersSparkline({
  data,
  height = 60,
  color = "hsl(var(--primary))",
  loading,
  className,
}: FollowersSparklineProps) {
  if (loading) {
    return (
      <div className={cn("space-y-2", className)}>
        <Skeleton className="h-4 w-32" />
        <Skeleton style={{ height }} className="w-full" />
      </div>
    );
  }

  const safeData = Array.isArray(data) ? data : [];

  if (safeData.length < 2) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground",
          className,
        )}
        style={{ height: height + 24 }}
      >
        Sem dados de evolução
      </div>
    );
  }

  const first = safeData[0]?.value ?? 0;
  const last = safeData[safeData.length - 1]?.value ?? 0;
  const delta = last - first;
  const deltaColor =
    delta > 0
      ? "text-emerald-600 dark:text-emerald-400"
      : delta < 0
        ? "text-red-600 dark:text-red-400"
        : "text-muted-foreground";

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold tabular-nums">{ptBR.format(last)}</span>
        <span className={cn("text-xs font-medium tabular-nums", deltaColor)}>
          {ptBRSigned.format(delta)}
        </span>
      </div>

      <div
        style={{ height, width: "100%" }}
        role="img"
        aria-label={`Evolução de seguidores: ${ptBR.format(first)} em ${formatDateLabel(safeData[0]?.date)} → ${ptBR.format(last)} em ${formatDateLabel(safeData[safeData.length - 1]?.date)} (${ptBRSigned.format(delta)})`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={safeData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
            <Tooltip
              cursor={{ stroke: color, strokeOpacity: 0.2 }}
              content={<SparklineTooltip />}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default FollowersSparkline;
