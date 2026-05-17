// GET /api/radar-img-proxy?url=<encoded>
//
// Proxy de imagens IG/CDN. IG CDN retorna 403 sem Referer válido.
// Fetch server-side com Referer instagram.com + cache 1h.
// Ported de radar-viral/app/api/img/route.ts.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyCors, handlePreflight } from "../_lib/cors.js";
import { checkRateLimit, maybeGc } from "../_lib/shared/rate-limit.js";

const ALLOWED_HOSTS = [
  "cdninstagram.com",
  "fbcdn.net",
  "instagram.com",
  "ytimg.com", // bonus: YouTube thumbs
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res);

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Rate-limit por IP (Performance v2 precisa servir thumbs IG sem auth,
  // mas não pode virar proxy aberto pra atacante puxar volumes infinitos).
  maybeGc();
  const rl = checkRateLimit(req, {
    key: "radar-img-proxy",
    maxPerMinute: 120,
    maxPerHour: 1200,
  });
  if (!rl.ok) {
    res.setHeader("Retry-After", String(rl.retryAfterSec));
    return res
      .status(429)
      .json({ error: "Too many requests", retryAfterSec: rl.retryAfterSec });
  }

  const urlParam = req.query.url;
  const url = typeof urlParam === "string" ? urlParam : Array.isArray(urlParam) ? urlParam[0] : null;
  if (!url) return res.status(400).json({ error: "missing url" });

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return res.status(400).json({ error: "invalid url" });
  }

  const hostname = parsed.hostname;
  const allowed = ALLOWED_HOSTS.some(
    (h) => hostname === h || hostname.endsWith("." + h),
  );
  if (!allowed) {
    return res.status(403).json({ error: "host not allowed" });
  }

  try {
    const upstream = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15",
        Referer: "https://www.instagram.com/",
        Accept:
          "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
    });
    if (!upstream.ok) {
      return res
        .status(upstream.status)
        .json({ error: `upstream ${upstream.status}` });
    }
    const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.setHeader("Content-Type", contentType);
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=3600, max-age=600, stale-while-revalidate=86400",
    );
    return res.status(200).send(buffer);
  } catch (err) {
    console.error("[radar-img-proxy] failed:", err);
    return res.status(502).json({ error: "proxy failed" });
  }
}
