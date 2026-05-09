// ClientPerformanceCard — card individual no Performance Snapshot grid do
// Dashboard. Mostra dados reais de followers/posts/engagement do cliente
// (vindos de `useDashboardClientCards`) com sparkline + trend vs semana anterior.
//
// Mantido AQUI dentro de `home/` porque é específico do dashboard — não
// compartilha layout com outros lugares.
import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus, TrendingUp } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ClientCardData } from "@/hooks/useDashboardClientCards";

interface ClientPerformanceCardProps {
  data: ClientCardData;
  onClick?: () => void;
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toString();
}

function trendDirection(curr: number, prev: number): "up" | "down" | "flat" {
  if (curr === prev) return "flat";
  return curr > prev ? "up" : "down";
}

function pctChange(curr: number, prev: number): number {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
}

/**
 * Mini sparkline puro SVG — sem dependência externa pra ficar leve.
 * Width/height responsivo via viewBox; renderiza linha + área sutil.
 */
function Sparkline({
  data,
  color = "hsl(var(--primary))",
}: {
  data: number[];
  color?: string;
}) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 100;
  const h = 24;
  const stepX = w / (data.length - 1);
  const points = data
    .map((v, i) => {
      const x = i * stepX;
      const y = h - ((v - min) / range) * h;
      return `${x},${y.toFixed(2)}`;
    })
    .join(" ");
  const areaPath = `M0,${h} L${data
    .map((v, i) => {
      const x = i * stepX;
      const y = h - ((v - min) / range) * h;
      return `${x},${y.toFixed(2)}`;
    })
    .join(" L")} L${w},${h} Z`;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="w-full h-6"
      aria-hidden="true"
    >
      <path d={areaPath} fill={color} fillOpacity={0.12} />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ClientPerformanceCard({
  data,
  onClick,
}: ClientPerformanceCardProps) {
  const sparkValues = data.followersSparkline.map((s) => s.value);
  const dir = trendDirection(data.postsLast7d, data.postsPrev7d);
  const TrendIcon =
    dir === "up" ? ArrowUpRight : dir === "down" ? ArrowDownRight : Minus;
  const trendColor =
    dir === "up"
      ? "text-emerald-500"
      : dir === "down"
        ? "text-destructive"
        : "text-muted-foreground";
  const pct = pctChange(data.postsLast7d, data.postsPrev7d);
  const initials = data.clientName.slice(0, 2).toUpperCase();

  return (
    <Card
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={`Abrir performance de ${data.clientName}`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (!onClick) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "group transition-all duration-200 overflow-hidden",
        onClick &&
          "cursor-pointer hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
      )}
    >
      <CardContent className="p-4 space-y-3">
        {/* Header — avatar + nome + arrow */}
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 rounded-lg shrink-0">
            <AvatarImage src={data.clientAvatar ?? undefined} />
            <AvatarFallback className="rounded-lg bg-primary/15 text-primary text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold truncate text-foreground">
              {data.clientName}
            </h3>
            <p className="text-[11px] text-muted-foreground">
              {data.hasData
                ? `${formatNumber(data.totalFollowers)} seguidores`
                : "Sem dados ainda"}
            </p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0" />
        </div>

        {/* Sparkline */}
        <div className="h-7">
          {sparkValues.length >= 2 ? (
            <Sparkline data={sparkValues} />
          ) : (
            <div className="h-full flex items-center justify-center">
              <span className="text-[10px] text-muted-foreground/50">
                {data.hasData ? "Snapshot único" : "Aguardando snapshots"}
              </span>
            </div>
          )}
        </div>

        {/* KPIs row */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/40">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
              Posts 7d
            </p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <p className="text-lg font-semibold tabular-nums">
                {data.postsLast7d}
              </p>
              {data.postsPrev7d > 0 && (
                <span
                  className={cn(
                    "text-[10px] font-medium flex items-center gap-0.5",
                    trendColor,
                  )}
                >
                  <TrendIcon className="h-3 w-3" />
                  {Math.abs(pct)}%
                </span>
              )}
            </div>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
              Eng% 7d
            </p>
            <p className="text-lg font-semibold tabular-nums mt-0.5">
              {data.avgEngagementLast7d > 0
                ? `${data.avgEngagementLast7d.toFixed(1)}%`
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <TrendingUp className="h-2.5 w-2.5" />
              Crescimento
            </p>
            {sparkValues.length >= 2 ? (
              (() => {
                const first = sparkValues[0];
                const last = sparkValues[sparkValues.length - 1];
                const delta = last - first;
                const sign = delta >= 0 ? "+" : "";
                return (
                  <p
                    className={cn(
                      "text-lg font-semibold tabular-nums mt-0.5",
                      delta > 0
                        ? "text-emerald-500"
                        : delta < 0
                          ? "text-destructive"
                          : "text-muted-foreground",
                    )}
                  >
                    {sign}
                    {formatNumber(Math.abs(delta))}
                  </p>
                );
              })()
            ) : (
              <p className="text-lg font-semibold tabular-nums mt-0.5 text-muted-foreground">
                —
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
