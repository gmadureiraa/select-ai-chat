/**
 * Helper pra construir URL do /api/img proxy. Cópia do standalone.
 *
 * IG CDN retorna 403 quando hot-linkado. YT thumbs retornam OK direto.
 *
 * No KAI, /api/img não existe ainda — mantemos a chamada (vai retornar
 * 404 e o card cai no placeholder), igual ao comportamento de erro do
 * standalone quando o proxy falha. Quando o handler for portado, basta
 * o endpoint existir e tudo funciona automaticamente.
 */

const PROXY_HOSTS = ["cdninstagram.com", "fbcdn.net", "instagram.com"];

export function imgProxy(url: string | null | undefined): string {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (PROXY_HOSTS.some((h) => parsed.hostname.endsWith(h))) {
      return `/api/radar-img-proxy?url=${encodeURIComponent(url)}`;
    }
    return url;
  } catch {
    return url;
  }
}
