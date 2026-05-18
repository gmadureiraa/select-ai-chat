// 2026-05-18 rev2 — STUB. Metricool removido. Analytics vai usar Late/Zernio
// `late-analytics` handler. Por enquanto exports só types pra não quebrar
// arquivos que ainda fazem `import type { MetricoolNetwork }`.

export type MetricoolNetwork =
  | "instagram"
  | "facebook"
  | "twitter"
  | "linkedin"
  | "tiktok"
  | "youtube"
  | "threads"
  | "pinterest"
  | "bluesky";

export type MetricoolPost = Record<string, unknown>;
