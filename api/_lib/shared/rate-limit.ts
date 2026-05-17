// Rate limiter — Upstash Redis quando configurado, fallback in-memory.
//
// Backends:
//   - Upstash REST (`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`):
//     sliding window distribuído, compartilhado entre cold starts. Modo de
//     produção recomendado.
//   - In-memory: per-instance Map (bucket fixo por janela). Usado em dev
//     local ou quando as env vars não estão setadas. NÃO é cross-instance —
//     bypass trivial via requests paralelas em containers diferentes.
//
// APIs disponíveis:
//   1. `checkRateLimit(req, { key, maxPerMinute, maxPerHour? })` — SÍNCRONO,
//      always in-memory. API legada compatível com handlers já existentes
//      (firecrawl-scrape, radar-img-proxy, etc.). Retorna `{ok, remaining,
//      retryAfterSec}`.
//   2. `rateLimit({ key, limit, windowMs })` — ASYNC, escolhe Upstash quando
//      env presente, senão cai pro in-memory bucket. Recomendado pra rotas
//      novas (MCP tool calls, generate-content-v2, etc.). Retorna
//      `{allowed, remaining, reset, retryAfterSec}`.
//
// Uso (legado, mantém in-memory):
//   const rl = checkRateLimit(req, { key: 'firecrawl', maxPerMinute: 6 });
//   if (!rl.ok) { res.setHeader('Retry-After', String(rl.retryAfterSec)); ... }
//
// Uso (novo, distribuído quando Upstash setado):
//   const rl = await rateLimit({ key: `mcp:cheap:${userId}`, limit: 60, windowMs: 60_000 });
//   if (!rl.allowed) { res.setHeader('Retry-After', String(rl.retryAfterSec)); ... }
import type { VercelRequest } from '@vercel/node';

interface BucketEntry {
  count: number;
  windowStart: number;
}

// === API LEGADA (checkRateLimit) ===
export interface RateLimitResult {
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

// === API NOVA (rateLimit) ===
export interface AsyncRateLimitOptions {
  key: string;
  limit: number;
  windowMs: number;
}

export interface AsyncRateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Unix epoch ms quando a janela atual reseta. */
  reset: number;
  /** Segundos restantes até liberar (Retry-After header). */
  retryAfterSec: number;
}

const minuteBuckets = new Map<string, BucketEntry>();
const hourBuckets = new Map<string, BucketEntry>();
const customBuckets = new Map<string, BucketEntry>();

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

// Cap absoluto pra impedir memory leak — em ataque distribuído cada IP único
// criaria entry e nunca limparia até o GC time-based. Com cap, entries
// antigas (LRU) são descartadas mesmo antes do TTL natural.
const MAX_BUCKETS = 10_000;

function getIp(req: VercelRequest): string {
  // Vercel sets this header and it cannot be spoofed by clients
  const vercelIp = req.headers['x-vercel-forwarded-for'];
  if (typeof vercelIp === 'string') {
    const first = vercelIp.split(',')[0]?.trim();
    if (first) return first;
  }
  if (Array.isArray(vercelIp) && vercelIp[0]) {
    const first = vercelIp[0].split(',')[0]?.trim();
    if (first) return first;
  }

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
    // LRU touch — delete-then-set move pro fim, oldest entries somem primeiro
    if (bucket) buckets.delete(key);
    buckets.set(key, { count: 1, windowStart: now });
    // Cap absoluto — descarta oldest se passou do limite
    while (buckets.size > MAX_BUCKETS) {
      const oldestKey = buckets.keys().next().value;
      if (!oldestKey) break;
      buckets.delete(oldestKey);
    }
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
  for (const [k, b] of customBuckets) {
    // customBuckets pode ter windowMs variável; assumimos HOUR_MS como TTL
    // upper-bound conservador (entries que sobreviveram >1h são lixo).
    if (now - b.windowStart > HOUR_MS) customBuckets.delete(k);
  }
}

// =========================================================================
// API ASYNC — Upstash sliding window com fallback in-memory bucket fixo
// =========================================================================

// Import dinâmico via try/catch evita custo de require se Upstash não tem
// env vars setadas. A lib é tree-shakeable e leve, mas async init permite
// cold start mais rápido.
type RatelimitInstance = {
  limit: (
    identifier: string,
  ) => Promise<{ success: boolean; remaining: number; reset: number }>;
};

let cachedRedis: any = null;
let redisInitTried = false;
const limiterCache = new Map<string, RatelimitInstance>();

async function getRedis(): Promise<any> {
  if (redisInitTried) return cachedRedis;
  redisInitTried = true;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const mod = await import('@upstash/redis');
    cachedRedis = new mod.Redis({ url, token });
    return cachedRedis;
  } catch (err) {
    console.warn(
      '[rate-limit] falha inicializando Upstash Redis, fallback in-memory:',
      err,
    );
    return null;
  }
}

async function getLimiter(
  scope: string,
  limit: number,
  windowMs: number,
): Promise<RatelimitInstance | null> {
  const redis = await getRedis();
  if (!redis) return null;
  const cacheKey = `${scope}:${limit}:${windowMs}`;
  const cached = limiterCache.get(cacheKey);
  if (cached) return cached;
  try {
    const mod = await import('@upstash/ratelimit');
    const seconds = Math.max(1, Math.round(windowMs / 1000));
    const limiter = new mod.Ratelimit({
      redis,
      limiter: mod.Ratelimit.slidingWindow(limit, `${seconds} s`),
      // analytics=true habilita Upstash collected events (success/throttle por
      // identifier) — consulta via getAnalytics() no dashboard de admin.
      // Custo: 1 extra Redis write por request, marginal.
      analytics: true,
      prefix: 'kai:rl',
    });
    limiterCache.set(cacheKey, limiter);
    return limiter;
  } catch (err) {
    console.warn('[rate-limit] falha instanciando Ratelimit:', err);
    return null;
  }
}

function inMemoryAsyncCheck({
  key,
  limit,
  windowMs,
}: AsyncRateLimitOptions): AsyncRateLimitResult {
  const now = Date.now();
  const res = bump(customBuckets, windowMs, key, limit, now);
  // Compute reset epoch from bucket window start
  const bucket = customBuckets.get(key);
  const reset = bucket ? bucket.windowStart + windowMs : now + windowMs;
  return {
    allowed: res.ok,
    remaining: res.remaining,
    reset,
    retryAfterSec: res.ok ? 0 : res.retryAfterSec,
  };
}

/**
 * Async rate limit. Upstash sliding window quando env vars setadas, fallback
 * in-memory bucket fixo (per-instance) caso contrário.
 *
 * Use pra rotas novas — especialmente MCP tool calls e endpoints que
 * disparam custo externo (Gemini, Apify, Firecrawl).
 *
 * Recomendado prefixar `key` com scope (`mcp:cheap:user-id`, `gen:carousel:user-id`)
 * pra agrupar limiters cacheados eficientemente.
 */
export async function rateLimit(
  opts: AsyncRateLimitOptions,
): Promise<AsyncRateLimitResult> {
  const scope = opts.key.split(':')[0] || 'default';
  const limiter = await getLimiter(scope, opts.limit, opts.windowMs);
  if (!limiter) {
    return inMemoryAsyncCheck(opts);
  }
  try {
    const res = await limiter.limit(opts.key);
    const now = Date.now();
    const retryAfterSec = res.success
      ? 0
      : Math.max(1, Math.ceil((res.reset - now) / 1000));
    return {
      allowed: res.success,
      remaining: res.remaining,
      reset: res.reset,
      retryAfterSec,
    };
  } catch (err) {
    console.warn('[rate-limit] Upstash falhou, fallback in-memory:', err);
    return inMemoryAsyncCheck(opts);
  }
}

/**
 * Helper: monta uma rate-limit key consistente baseada em request + scope + identidade.
 * Prioriza `userId` se disponível, fallback pra IP.
 */
export function getRateLimitKey(
  req: VercelRequest,
  scope: string,
  userId?: string | null,
): string {
  const identity = userId || getIp(req);
  return `${scope}:${identity}`;
}

/** Re-export pra debug/inspeção em handlers que querem o IP cru. */
export { getIp as getRequestIp };
