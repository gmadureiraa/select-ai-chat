/**
 * imgProxy — roteia URLs de hosts que bloqueiam hotlink/expiram (IG/FB CDN)
 * via /api/radar-img-proxy. Pra outros hosts (YT, Twitter, etc.), retorna a
 * URL original.
 *
 * Mantém URL original sem-token / com-token funcional pra IG: a CDN do IG
 * assina URLs com `&oh=...&oe=...` que expiram em ~48h E rejeita hotlink
 * sem Referer válido. O proxy faz fetch com Referer instagram.com e cacheia
 * 1h via headers Vercel.
 *
 * Esse mesmo helper já existe localizado em
 * `src/components/kai/viral-radar-original/lib/img-proxy.ts` (cópia do
 * standalone). Este arquivo expõe a versão canônica pra todo o app —
 * importem daqui em vez do path do radar.
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
