// Lightweight in-memory IP rate-limit. Use só pra endpoints anônimos que
// disparam custo externo (Firecrawl, Apify, Gemini etc.).
//
// LIMITAÇÃO: em Vercel serverless cada container é frio e isolado, então
// o estado in-memory não é compartilhado entre invocações concorrentes. Isso
// reduz custo num cenário de uso normal (mesmo IP reusa container) mas não
// protege contra ataque distribuído. Pra hardening real, migrar pra Upstash
// Redis (REDIS_URL). Aqui só barramos abuso oportunista no mesmo container.
//
// Uso:
//   const rl = await checkRateLimit(req, { key: 'firecrawl', maxPerMinute: 6 });
//   if (!rl.ok) {
//     res.setHeader('Retry-After', String(rl.retryAfterSec));
//     return jsonError(res, 429, 'Too many requests');
//   }
import type { VercelRequest } from '@vercel/node';

interface BucketEntry {
  count: number;
  windowStart: number;
}

interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

interface RateLimitOpts {
  key: string;
  maxPerMinute: number;
  /** opcional: max por hora pra cap secundário */
  maxPerHour?: number;
}

const minuteBuckets = new Map<string, BucketEntry>();
const hourBuckets = new Map<string, BucketEntry>();

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

function getIp(req: VercelRequest): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string') return fwd.split(',')[0].trim();
  if (Array.isArray(fwd) && fwd[0]) return fwd[0].split(',')[0].trim();
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string') return realIp;
  // fallback genérico — assume mesmo container, mesmo "ip"
  return 'unknown';
}

function bump(
  buckets: Map<string, BucketEntry>,
  windowMs: number,
  key: string,
  limit: number,
  now: number,
): RateLimitResult {
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart > windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return { ok: true, remaining: limit - 1, retryAfterSec: 0 };
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    const retryAfter = Math.ceil((bucket.windowStart + windowMs - now) / 1000);
    return { ok: false, remaining: 0, retryAfterSec: Math.max(retryAfter, 1) };
  }
  return { ok: true, remaining: limit - bucket.count, retryAfterSec: 0 };
}

export function checkRateLimit(req: VercelRequest, opts: RateLimitOpts): RateLimitResult {
  const ip = getIp(req);
  const bucketKey = `${opts.key}:${ip}`;
  const now = Date.now();
  const perMinute = bump(minuteBuckets, MINUTE_MS, bucketKey, opts.maxPerMinute, now);
  if (!perMinute.ok) return perMinute;
  if (opts.maxPerHour) {
    const perHour = bump(hourBuckets, HOUR_MS, bucketKey, opts.maxPerHour, now);
    if (!perHour.ok) return perHour;
  }
  return perMinute;
}

// GC oportunista: chama de vez em quando pra não vazar memória em containers longos
let lastGc = Date.now();
const GC_INTERVAL = 5 * MINUTE_MS;
export function maybeGc(): void {
  const now = Date.now();
  if (now - lastGc < GC_INTERVAL) return;
  lastGc = now;
  for (const [k, b] of minuteBuckets) {
    if (now - b.windowStart > MINUTE_MS) minuteBuckets.delete(k);
  }
  for (const [k, b] of hourBuckets) {
    if (now - b.windowStart > HOUR_MS) hourBuckets.delete(k);
  }
}
