/**
 * Port literal de code/reels-viral/lib/utils.ts.
 *
 * cn() removido daqui — KAI já tem `@/lib/utils`. Quem precisa importa de lá.
 */

/**
 * Extrai o shortCode de uma URL do Instagram.
 * Aceita /reel/, /reels/, /p/ e /tv/ — IG serve reels via /p/ quando o link
 * vem de carrossel/post regular ou link compartilhado, então rejeitar /p/
 * de cara queima reels reais. O guard real `item.type !== "Video"` no
 * handler server-side dá erro claro pra foto/carrossel-sem-video.
 * Suporta com ou sem trailing slash, com ou sem segmento de username.
 */
export function extractShortCode(url: string): string | null {
  const match = url.match(
    /instagram\.com\/(?:[^\/]+\/)?(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/
  );
  return match ? match[1] : null;
}

export function isValidInstagramUrl(url: string): boolean {
  return Boolean(extractShortCode(url));
}

export function formatNumber(n: number | undefined): string {
  if (n === undefined || n === null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function formatDuration(secs: number | undefined): string {
  if (!secs) return "—";
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
