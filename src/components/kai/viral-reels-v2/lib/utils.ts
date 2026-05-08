/**
 * Helpers do Reels Viral v2 — extração de shortCode, validação de URL e
 * formatadores numéricos. Adaptado de `code/reels-viral/lib/utils.ts`.
 */

/**
 * Extrai o shortCode de uma URL do Instagram.
 * Aceita SOMENTE /reel/ e /reels/ (rejeita /p/ carrossel e /tv/ igtv pra
 * não queimar 1 hit Apify antes do guard `item.type !== "Video"` rejeitar).
 * Suporta com ou sem trailing slash, com ou sem segmento de username.
 */
export function extractShortCode(url: string): string | null {
  const match = url.match(
    /instagram\.com\/(?:[^\/]+\/)?reels?\/([A-Za-z0-9_-]+)/,
  );
  return match ? match[1] : null;
}

export function isValidInstagramUrl(url: string): boolean {
  return Boolean(extractShortCode(url));
}

export function formatNumber(n: number | undefined | null): string {
  if (n === undefined || n === null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function formatDuration(secs: number | undefined | null): string {
  if (!secs) return "—";
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
