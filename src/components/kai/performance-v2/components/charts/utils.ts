// Helpers compartilhados pelos SVG chart primitives. Extraído pra resolver
// `react-refresh/only-export-components` no svg-primitives.tsx.

export interface ChartPoint {
  /** Eixo X — string (rotulada) ou número (numérico). */
  label: string;
  /** Valor principal. */
  value: number;
  /** Valor overlay opcional (comparação período anterior). */
  previousValue?: number | null;
  /** Payload arbitrário pra tooltip. */
  meta?: unknown;
}

export interface MarginConfig {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const DEFAULT_MARGIN: MarginConfig = {
  top: 10,
  right: 12,
  bottom: 24,
  left: 40,
};

export function path(points: Array<[number, number]>): string {
  if (points.length === 0) return "";
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(2)},${p[1].toFixed(2)}`)
    .join(" ");
}

// "Monotone-like" smoothing — cardinal spline com tensão t. Suaviza linha
// sem usar derivativa monotônica (Recharts faz monotone; visualmente parecido
// pra séries não-oscilantes).
export function smoothPath(points: Array<[number, number]>): string {
  if (points.length < 2) return path(points);
  const t = 0.2;
  const segments: string[] = [];
  segments.push(`M${points[0][0].toFixed(2)},${points[0][1].toFixed(2)}`);
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) * t;
    const c1y = p1[1] + (p2[1] - p0[1]) * t;
    const c2x = p2[0] - (p3[0] - p1[0]) * t;
    const c2y = p2[1] - (p3[1] - p1[1]) * t;
    segments.push(
      `C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`,
    );
  }
  return segments.join(" ");
}
