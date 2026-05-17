/**
 * Endpoint admin — retorna stats do rate-limit Upstash pra dashboard.
 *
 * Lê analytics dos últimos N dias via @upstash/ratelimit `getUsage()`. Quando
 * Upstash não está configurado, retorna shape compatível mas indica fonte
 * `in-memory` (sem analytics — só snapshot do Map atual).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';
import { tryAuth } from '../_lib/auth.js';

interface UsageEntry {
  identifier: string;
  success: number;
  blocked: number;
  total: number;
}

interface StatsResponse {
  source: 'upstash' | 'in-memory' | 'none';
  windowDays: number;
  totalRequests: number;
  totalBlocked: number;
  topIdentities: UsageEntry[];
  /** Buckets ativos no momento (apenas com Upstash). */
  activeBuckets: number;
  generatedAt: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(res, req.headers.origin as string | undefined);
  if (req.method === 'OPTIONS') return handlePreflight(req, res);
  if (req.method !== 'GET') return jsonError(res, 405, 'Method not allowed');

  const auth = await tryAuth(req);
  if (!auth) return jsonError(res, 401, 'Unauthorized');

  const daysParam = Number(req.query.days ?? 7);
  const days = Math.max(1, Math.min(30, isNaN(daysParam) ? 7 : daysParam));

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    const payload: StatsResponse = {
      source: 'none',
      windowDays: days,
      totalRequests: 0,
      totalBlocked: 0,
      topIdentities: [],
      activeBuckets: 0,
      generatedAt: new Date().toISOString(),
    };
    return res.status(200).json(payload);
  }

  try {
    const { Redis } = await import('@upstash/redis');
    const { Ratelimit } = await import('@upstash/ratelimit');
    const redis = new Redis({ url, token });

    // getUsage() lê os eventos analytics agregados. Janela em ms.
    const windowMs = days * 24 * 60 * 60 * 1000;
    const usage = (await Ratelimit.getUsage({
      redis,
      prefix: 'kai:rl',
      window: windowMs,
    })) as Array<{ identifier: string; success: number; blocked: number }>;

    const entries: UsageEntry[] = (usage || []).map((u) => ({
      identifier: u.identifier,
      success: u.success || 0,
      blocked: u.blocked || 0,
      total: (u.success || 0) + (u.blocked || 0),
    }));

    // Conta buckets ativos via SCAN — escaneia chaves prefixadas (custo O(n)
    // proporcional ao número de buckets). Cap em 1000 pra evitar travar.
    let activeBuckets = 0;
    try {
      let cursor = 0;
      let iterations = 0;
      do {
        const [next, keys] = (await redis.scan(cursor, {
          match: 'kai:rl:*',
          count: 200,
        })) as [number, string[]];
        activeBuckets += keys.length;
        cursor = Number(next);
        iterations++;
        if (iterations > 5) break; // cap defensivo
      } while (cursor !== 0);
    } catch (err) {
      console.warn('[rate-limit-stats] SCAN falhou:', err);
    }

    const totalRequests = entries.reduce((a, e) => a + e.success, 0);
    const totalBlocked = entries.reduce((a, e) => a + e.blocked, 0);
    const topIdentities = entries
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    const payload: StatsResponse = {
      source: 'upstash',
      windowDays: days,
      totalRequests,
      totalBlocked,
      topIdentities,
      activeBuckets,
      generatedAt: new Date().toISOString(),
    };
    return res.status(200).json(payload);
  } catch (err) {
    console.error('[rate-limit-stats] erro:', err);
    return jsonError(
      res,
      500,
      err instanceof Error ? err.message : 'Erro ao ler stats',
    );
  }
}
