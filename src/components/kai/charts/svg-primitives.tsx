// SVG chart primitives — substituem recharts pra reduzir bundle (~406kB → 0).
//
// Filosofia: zero dep, viewBox-based responsivo, tooltip via React state
// nativo. Sem animação (já era `isAnimationActive={false}` em todo lugar).
//
// 3 componentes exportados:
//   - Sparkline: linha simples sem axis, opcional preencha embaixo
//   - AreaLineChart: hero chart com area+line+grid+axis+tooltip, opcional linha overlay (comparação)
//   - VerticalBarChart: bars verticais com axis (substitui Recharts BarChart no ClientAnalyticsTab)
//
// Helpers / tipos: em ./utils.ts pra fast-refresh ficar limpo.
//
// Tooltip: SVG `<rect>` invisíveis cobrindo cada slot do eixo X capturam
// pointerEnter; coords convertidas pra CSS via getBoundingClientRect do svg.
import {
  useId,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { cn } from "@/lib/utils";
import { type ChartPoint, DEFAULT_MARGIN, smoothPath } from "./utils";

// Re-export pra compat com call-sites que importavam ChartPoint daqui
export type { ChartPoint } from "./utils";

// ────────────────────────────────────────────────────────────────────────────
// Sparkline — single line, no axis, responsive (uses parent's width/height)
// ────────────────────────────────────────────────────────────────────────────

export interface SparklineProps {
  data: Array<{ value: number; label?: string }>;
  color?: string;
  /** Stroke width em px (viewBox unidades). Default 1.4 */
  strokeWidth?: number;
  /** Renderiza fill suave embaixo da linha. */
  withArea?: boolean;
  /** Renderiza tooltip on-hover. */
  withTooltip?: boolean;
  /** Formata valor no tooltip. */
  formatValue?: (v: number) => string;
  /** Formata label no tooltip. */
  formatLabel?: (l: string) => string;
  /** Aria-label. */
  ariaLabel?: string;
  className?: string;
}

export function Sparkline({
  data,
  color = "currentColor",
  strokeWidth = 1.4,
  withArea = false,
  withTooltip = false,
  formatValue,
  formatLabel,
  ariaLabel,
  className,
}: SparklineProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hover, setHover] = useState<{
    index: number;
    x: number;
    y: number;
  } | null>(null);

  // useMemo antes de qualquer return pra evitar churn em re-renders externos.
  const safe = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  // viewBox virtual: 100 wide × 40 tall. CSS escala.
  const W = 100;
  const H = 40;

  const { points, minV, maxV } = useMemo(() => {
    if (safe.length === 0)
      return { points: [] as Array<[number, number]>, minV: 0, maxV: 0 };
    let lo = Infinity;
    let hi = -Infinity;
    for (const p of safe) {
      if (p.value < lo) lo = p.value;
      if (p.value > hi) hi = p.value;
    }
    if (!Number.isFinite(lo)) lo = 0;
    if (!Number.isFinite(hi)) hi = 0;
    const span = Math.max(hi - lo, 1);
    const step = safe.length > 1 ? W / (safe.length - 1) : 0;
    const pts: Array<[number, number]> = safe.map((p, i) => {
      const x = i * step;
      const y = H - ((p.value - lo) / span) * (H - 4) - 2;
      return [x, y];
    });
    return { points: pts, minV: lo, maxV: hi };
  }, [safe]);

  if (safe.length < 2) {
    return (
      <div
        className={cn(
          "w-full h-full flex items-center justify-center text-[10px] text-muted-foreground",
          className,
        )}
        role="img"
        aria-label={ariaLabel}
      >
        —
      </div>
    );
  }

  const linePath = smoothPath(points);
  const areaPath =
    withArea && points.length > 0
      ? `${linePath} L${points[points.length - 1][0].toFixed(2)},${H} L${points[0][0].toFixed(2)},${H} Z`
      : "";

  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!withTooltip || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / Math.max(rect.width, 1);
    const idx = Math.min(
      safe.length - 1,
      Math.max(0, Math.round(ratio * (safe.length - 1))),
    );
    setHover({ index: idx, x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const onLeave = () => setHover(null);

  return (
    <div
      className={cn("relative w-full h-full", className)}
      role="img"
      aria-label={ariaLabel}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        width="100%"
        height="100%"
        onPointerMove={withTooltip ? onMove : undefined}
        onPointerLeave={withTooltip ? onLeave : undefined}
        style={{ overflow: "visible", display: "block" }}
      >
        {withArea && (
          <path d={areaPath} fill={color} fillOpacity={0.18} stroke="none" />
        )}
        <path
          d={linePath}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {hover && (
          <circle
            cx={points[hover.index][0]}
            cy={points[hover.index][1]}
            r={1.8}
            fill={color}
            vectorEffect="non-scaling-stroke"
            stroke="white"
            strokeWidth={1}
          />
        )}
      </svg>
      {hover && withTooltip && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border bg-popover px-2 py-1 text-xs shadow-sm"
          style={{
            left: Math.min(Math.max(hover.x + 8, 0), 220),
            top: Math.max(hover.y - 36, -32),
          }}
        >
          <div className="font-medium tabular-nums">
            {formatValue
              ? formatValue(safe[hover.index].value)
              : safe[hover.index].value}
          </div>
          {safe[hover.index].label && (
            <div className="text-muted-foreground">
              {formatLabel
                ? formatLabel(safe[hover.index].label!)
                : safe[hover.index].label}
            </div>
          )}
        </div>
      )}
      <span className="sr-only">
        {minV} a {maxV}
      </span>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// AreaLineChart — hero chart com area + line + grid + axis + tooltip + comparison overlay
// ────────────────────────────────────────────────────────────────────────────

export interface AreaLineChartProps {
  data: ChartPoint[];
  /** Cor principal — area + line. */
  color: string;
  /** Cor da linha de comparação (overlay tracejado). Se undefined, usa color/0.6. */
  compareColor?: string;
  /** Mostra linha overlay (previousValue). */
  showCompare?: boolean;
  /** Render dots em cada ponto. Default: auto (≤30 pontos). */
  showDots?: boolean | "auto";
  /** Altura em px. */
  height: number;
  /** Formata valor Y-axis e tooltip. */
  formatY?: (v: number) => string;
  /** Formata tooltip value (mais detalhado que Y axis). */
  formatTooltip?: (v: number) => string;
  /** Label pra tooltip. */
  metricLabel: string;
  /** Label da série comparativa. */
  compareLabel?: string;
  /** Aria-label. */
  ariaLabel?: string;
  className?: string;
}

export function AreaLineChart({
  data,
  color,
  compareColor,
  showCompare = false,
  showDots = "auto",
  height,
  formatY,
  formatTooltip,
  metricLabel,
  compareLabel,
  ariaLabel,
  className,
}: AreaLineChartProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gradId = useId();
  const [hover, setHover] = useState<{
    index: number;
    x: number;
    y: number;
  } | null>(null);

  const margin = DEFAULT_MARGIN;
  // SVG é responsivo via viewBox + width 100%. Usamos um viewBox virtual
  // proporcional pra simplificar: 800 wide.
  const VBW = 800;
  const VBH = Math.max(height, 80);
  const innerW = VBW - margin.left - margin.right;
  const innerH = VBH - margin.top - margin.bottom;

  const safe = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const { points, prevPoints, yMax, yMin, yTicks, xTicks } = useMemo(() => {
    if (safe.length === 0) {
      return {
        points: [] as Array<[number, number]>,
        prevPoints: [] as Array<[number, number]>,
        yMax: 1,
        yMin: 0,
        yTicks: [] as number[],
        xTicks: [] as Array<{ x: number; label: string; index: number }>,
      };
    }
    let hi = 0;
    for (const p of safe) {
      if (p.value > hi) hi = p.value;
      if (typeof p.previousValue === "number" && p.previousValue > hi)
        hi = p.previousValue;
    }
    // Y axis sempre começa em 0 (consistente com Recharts area chart)
    const yMin_ = 0;
    const yMax_ = Math.max(hi * 1.15, 1);

    const step = safe.length > 1 ? innerW / (safe.length - 1) : 0;

    const project = (v: number) => {
      const ratio = (v - yMin_) / Math.max(yMax_ - yMin_, 1);
      return innerH - ratio * innerH;
    };

    const pts: Array<[number, number]> = safe.map((p, i) => [
      i * step,
      project(p.value),
    ]);
    const prevPts: Array<[number, number]> = showCompare
      ? safe
          .map((p, i) =>
            typeof p.previousValue === "number"
              ? ([i * step, project(p.previousValue)] as [number, number])
              : null,
          )
          .filter((p): p is [number, number] => p !== null)
      : [];

    // Y ticks — 5 valores
    const ticks: number[] = [];
    for (let i = 0; i <= 4; i++) {
      ticks.push(yMin_ + (yMax_ - yMin_) * (i / 4));
    }

    // X ticks — preserveStartEnd + ~6 intermediários
    const desired = Math.min(safe.length, 7);
    const tickStep =
      safe.length > 1 ? Math.max(1, Math.floor(safe.length / desired)) : 1;
    const xTicks_: Array<{ x: number; label: string; index: number }> = [];
    for (let i = 0; i < safe.length; i += tickStep) {
      xTicks_.push({ x: i * step, label: safe[i].label, index: i });
    }
    const last = safe.length - 1;
    if (
      xTicks_.length === 0 ||
      xTicks_[xTicks_.length - 1].index !== last
    ) {
      xTicks_.push({ x: last * step, label: safe[last].label, index: last });
    }

    return {
      points: pts,
      prevPoints: prevPts,
      yMax: yMax_,
      yMin: yMin_,
      yTicks: ticks,
      xTicks: xTicks_,
    };
  }, [safe, innerW, innerH, showCompare]);

  const linePath = smoothPath(points);
  const areaPath =
    points.length > 0
      ? `${linePath} L${points[points.length - 1][0].toFixed(2)},${innerH} L${points[0][0].toFixed(2)},${innerH} Z`
      : "";
  const prevPath = showCompare && prevPoints.length > 0 ? smoothPath(prevPoints) : "";

  const shouldShowDots = showDots === "auto" ? safe.length <= 30 : showDots;

  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!svgRef.current || safe.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const ratio =
      (e.clientX - rect.left - (margin.left / VBW) * rect.width) /
      Math.max((innerW / VBW) * rect.width, 1);
    const idx = Math.min(
      safe.length - 1,
      Math.max(0, Math.round(ratio * (safe.length - 1))),
    );
    setHover({ index: idx, x: e.clientX - rect.left, y: e.clientY - rect.top });
  };
  const onLeave = () => setHover(null);

  const fmtY = (v: number) => (formatY ? formatY(v) : String(Math.round(v)));
  const fmtT = (v: number) => (formatTooltip ? formatTooltip(v) : fmtY(v));

  if (safe.length < 2) {
    return (
      <div
        ref={containerRef}
        className={cn(
          "flex items-center justify-center text-sm text-muted-foreground",
          className,
        )}
        style={{ height }}
        role="img"
        aria-label={ariaLabel}
      >
        Sem dados suficientes
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn("relative w-full", className)}
      style={{ height }}
      role="img"
      aria-label={ariaLabel}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VBW} ${VBH}`}
        preserveAspectRatio="none"
        width="100%"
        height="100%"
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        style={{ display: "block", overflow: "visible" }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.32} />
            <stop offset="55%" stopColor={color} stopOpacity={0.1} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>

        <g transform={`translate(${margin.left}, ${margin.top})`}>
          {/* Y grid lines + labels */}
          {yTicks.map((t, i) => {
            const ratio = (t - yMin) / Math.max(yMax - yMin, 1);
            const y = innerH - ratio * innerH;
            return (
              <g key={`yt-${i}`}>
                <line
                  x1={0}
                  x2={innerW}
                  y1={y}
                  y2={y}
                  stroke="hsl(var(--border))"
                  strokeOpacity={0.5}
                  strokeDasharray="3 3"
                  vectorEffect="non-scaling-stroke"
                />
                <text
                  x={-8}
                  y={y + 3}
                  textAnchor="end"
                  fontSize={11}
                  fill="hsl(var(--muted-foreground))"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {fmtY(t)}
                </text>
              </g>
            );
          })}

          {/* X axis labels (ticks) */}
          {xTicks.map((t, i) => (
            <text
              key={`xt-${i}`}
              x={t.x}
              y={innerH + 16}
              textAnchor="middle"
              fontSize={11}
              fill="hsl(var(--muted-foreground))"
            >
              {t.label}
            </text>
          ))}

          {/* Area */}
          <path d={areaPath} fill={`url(#${gradId})`} stroke="none" />

          {/* Comparison line (dashed) */}
          {showCompare && prevPath && (
            <path
              d={prevPath}
              stroke={compareColor || color}
              strokeOpacity={0.55}
              strokeWidth={1.6}
              strokeDasharray="5 4"
              fill="none"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {/* Main line */}
          <path
            d={linePath}
            stroke={color}
            strokeWidth={2.4}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />

          {/* Dots */}
          {shouldShowDots &&
            points.map(([x, y], i) => (
              <circle
                key={`dot-${i}`}
                cx={x}
                cy={y}
                r={2.5}
                fill={color}
                stroke="hsl(var(--background))"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
              />
            ))}

          {/* Hover indicator */}
          {hover && points[hover.index] && (
            <>
              <line
                x1={points[hover.index][0]}
                x2={points[hover.index][0]}
                y1={0}
                y2={innerH}
                stroke={color}
                strokeOpacity={0.25}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
              <circle
                cx={points[hover.index][0]}
                cy={points[hover.index][1]}
                r={5}
                fill="hsl(var(--background))"
                stroke={color}
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
              />
            </>
          )}
        </g>
      </svg>

      {hover && safe[hover.index] && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border bg-popover px-3 py-2 text-xs shadow-md"
          style={{
            left: Math.min(Math.max(hover.x + 12, 0), 600),
            top: Math.max(hover.y - 48, -36),
            minWidth: 120,
          }}
        >
          <div className="font-semibold text-foreground mb-1">
            {safe[hover.index].label}
          </div>
          <div className="flex items-center justify-between gap-3 tabular-nums">
            <span className="text-muted-foreground">{metricLabel}</span>
            <span className="font-medium" style={{ color }}>
              {fmtT(safe[hover.index].value)}
            </span>
          </div>
          {showCompare &&
            typeof safe[hover.index].previousValue === "number" && (
              <div className="flex items-center justify-between gap-3 tabular-nums">
                <span className="text-muted-foreground">
                  {compareLabel || `${metricLabel} (anterior)`}
                </span>
                <span className="font-medium opacity-70" style={{ color }}>
                  {fmtT(safe[hover.index].previousValue!)}
                </span>
              </div>
            )}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// VerticalBarChart — substituto pra Recharts BarChart no ClientAnalyticsTab
// ────────────────────────────────────────────────────────────────────────────

export interface VerticalBarChartProps {
  data: Array<{ label: string; value: number }>;
  color?: string;
  height: number;
  formatValue?: (v: number) => string;
  /** Border radius do topo da barra. */
  topRadius?: number;
  className?: string;
  ariaLabel?: string;
}

export function VerticalBarChart({
  data,
  color = "hsl(var(--primary))",
  height,
  formatValue,
  topRadius = 4,
  className,
  ariaLabel,
}: VerticalBarChartProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hover, setHover] = useState<{
    index: number;
    x: number;
    y: number;
  } | null>(null);

  const margin = { top: 8, right: 8, bottom: 24, left: 32 };
  const VBW = 800;
  const VBH = Math.max(height, 80);
  const innerW = VBW - margin.left - margin.right;
  const innerH = VBH - margin.top - margin.bottom;

  const safe = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const { bars, yMax, yTicks } = useMemo(() => {
    if (safe.length === 0) {
      return {
        bars: [] as Array<{
          x: number;
          y: number;
          w: number;
          h: number;
          value: number;
          label: string;
        }>,
        yMax: 1,
        yTicks: [] as number[],
      };
    }
    let hi = 0;
    for (const p of safe) if (p.value > hi) hi = p.value;
    const yMax_ = Math.max(hi * 1.15, 1);

    // Espaçamento padrão tipo recharts: 30% gap entre bars
    const slotW = innerW / safe.length;
    const barW = slotW * 0.7;
    const offset = slotW * 0.15;

    const bars_ = safe.map((d, i) => {
      const ratio = d.value / yMax_;
      const h = ratio * innerH;
      const x = i * slotW + offset;
      const y = innerH - h;
      return { x, y, w: barW, h, value: d.value, label: d.label };
    });

    const ticks: number[] = [];
    for (let i = 0; i <= 3; i++) ticks.push((yMax_ * i) / 3);

    return { bars: bars_, yMax: yMax_, yTicks: ticks };
  }, [safe, innerW, innerH]);

  if (safe.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center text-sm text-muted-foreground",
          className,
        )}
        style={{ height }}
        role="img"
        aria-label={ariaLabel}
      >
        Sem dados
      </div>
    );
  }

  const fmt = (v: number) => (formatValue ? formatValue(v) : String(Math.round(v)));

  const barPath = (b: { x: number; y: number; w: number; h: number }) => {
    const r = Math.min(topRadius, b.w / 2, b.h);
    if (r <= 0 || b.h <= 0) {
      return `M${b.x},${b.y + b.h} L${b.x},${b.y} L${b.x + b.w},${b.y} L${b.x + b.w},${b.y + b.h} Z`;
    }
    return [
      `M${b.x},${b.y + b.h}`,
      `L${b.x},${b.y + r}`,
      `Q${b.x},${b.y} ${b.x + r},${b.y}`,
      `L${b.x + b.w - r},${b.y}`,
      `Q${b.x + b.w},${b.y} ${b.x + b.w},${b.y + r}`,
      `L${b.x + b.w},${b.y + b.h}`,
      "Z",
    ].join(" ");
  };

  return (
    <div
      className={cn("relative w-full", className)}
      style={{ height }}
      role="img"
      aria-label={ariaLabel}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VBW} ${VBH}`}
        preserveAspectRatio="none"
        width="100%"
        height="100%"
        style={{ display: "block", overflow: "visible" }}
        onPointerLeave={() => setHover(null)}
      >
        <g transform={`translate(${margin.left}, ${margin.top})`}>
          {/* Y grid */}
          {yTicks.map((t, i) => {
            const ratio = t / yMax;
            const y = innerH - ratio * innerH;
            return (
              <g key={`yt-${i}`}>
                <line
                  x1={0}
                  x2={innerW}
                  y1={y}
                  y2={y}
                  stroke="hsl(var(--border))"
                  strokeOpacity={0.4}
                  strokeDasharray="3 3"
                  vectorEffect="non-scaling-stroke"
                />
                <text
                  x={-6}
                  y={y + 3}
                  textAnchor="end"
                  fontSize={11}
                  fill="hsl(var(--muted-foreground))"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {fmt(t)}
                </text>
              </g>
            );
          })}

          {/* Bars */}
          {bars.map((b, i) => (
            <g key={`bar-${i}`}>
              <path d={barPath(b)} fill={color} />
              {/* Invisible larger hit area pra tooltip */}
              <rect
                x={i * (innerW / safe.length)}
                y={0}
                width={innerW / safe.length}
                height={innerH}
                fill="transparent"
                onPointerMove={(e) => {
                  const rect = svgRef.current!.getBoundingClientRect();
                  setHover({
                    index: i,
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top,
                  });
                }}
              />
            </g>
          ))}

          {/* X axis labels */}
          {bars.map((b, i) => (
            <text
              key={`xl-${i}`}
              x={b.x + b.w / 2}
              y={innerH + 16}
              textAnchor="middle"
              fontSize={11}
              fill="hsl(var(--muted-foreground))"
            >
              {b.label}
            </text>
          ))}
        </g>
      </svg>

      {hover && bars[hover.index] && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border bg-popover px-2 py-1 text-xs shadow-sm"
          style={{
            left: Math.min(Math.max(hover.x + 8, 0), 600),
            top: Math.max(hover.y - 32, -32),
          }}
        >
          <div className="font-semibold text-foreground">
            {bars[hover.index].label}
          </div>
          <div className="tabular-nums" style={{ color }}>
            {fmt(bars[hover.index].value)}
          </div>
        </div>
      )}
    </div>
  );
}
