export const CANVAS_TEXT_FORMATS = [
  "post",
  "carousel",
  "thread",
  "newsletter",
  "stories",
  "reel_script",
] as const;

export type CanvasTextFormat = (typeof CANVAS_TEXT_FORMATS)[number];
export type CanvasFormat = CanvasTextFormat | "image";

/**
 * Normaliza formatos vindos de UI, templates ou integrações.
 * Mantém um padrão interno único no Canvas.
 */
export function normalizeCanvasFormat(input?: string): CanvasFormat {
  const raw = (input || "post").toLowerCase().trim();

  // aliases comuns (PT/EN)
  if (raw === "carrossel" || raw === "carousel") return "carousel";
  if (raw === "thread") return "thread";
  if (raw === "newsletter") return "newsletter";
  if (raw === "stories" || raw === "story") return "stories";
  if (raw === "reels" || raw === "reel" || raw === "reel_script" || raw === "reels_script") return "reel_script";
  if (raw === "image" || raw === "imagem") return "image";

  return "post";
}

/**
 * Formato enviado ao backend `generate-content-v2`.
 * Lá também existe normalização, mas manter isso aqui evita drift.
 */
export function toGenerateContentV2Format(format: CanvasFormat): string {
  if (format === "reel_script") return "reels";
  return format;
}


/**
 * Formato enviado ao kai-content-agent.
 * IMPORTANTE: reel_script precisa virar reels, senão o agente cai em regras de post.
 */
export function toKaiContentAgentFormat(format: CanvasFormat): string {
  if (format === "reel_script") return "reels";
  if (format === "image") return "post";
  return format;
}
