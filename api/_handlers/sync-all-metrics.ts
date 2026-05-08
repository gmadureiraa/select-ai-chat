// Migrated from supabase/functions/sync-all-metrics/index.ts
// Daily cron orchestrator that fans out to per-platform metric fetchers.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';
import { getPool, query } from '../_lib/db.js';
import { tryAuth } from '../_lib/auth.js';

type Platform = 'instagram' | 'tiktok' | 'twitter' | 'linkedin' | 'youtube';

interface PlatformJob {
  platform: Platform;
  fnName: string;
  body: Record<string, unknown>;
  estimated_cost_usd: number;
}

function extractHandle(value: string | undefined | null, kind: Platform): string | null {
  if (!value || typeof value !== 'string') return null;
  const v = value.trim();
  if (!v) return null;
  const urlMatch = v.match(/[a-z]+\.com\/(?:@)?([^/?#]+)/i);
  let h = urlMatch ? urlMatch[1] : v.replace(/^@/, '').replace(/^https?:\/\//i, '');
  h = h.replace(/^@/, '').trim();
  if (kind === 'linkedin') return v;
  return h || null;
}

function buildJobsForClient(client: any, platforms: Platform[]): PlatformJob[] {
  const sm = client.social_media || {};
  const jobs: PlatformJob[] = [];

  if (platforms.includes('instagram')) {
    const ig = extractHandle(sm.instagram, 'instagram');
    if (ig) {
      jobs.push({
        platform: 'instagram',
        fnName: 'fetch-instagram-metrics',
        body: { clientId: client.id, username: ig },
        estimated_cost_usd: 0.03,
      });
    }
  }
  if (platforms.includes('tiktok')) {
    const tt = extractHandle(sm.tiktok, 'tiktok');
    if (tt) {
      jobs.push({
        platform: 'tiktok',
        fnName: 'fetch-tiktok-apify',
        body: { clientId: client.id, username: tt },
        estimated_cost_usd: 0.01,
      });
    }
  }
  if (platforms.includes('twitter')) {
    const tw = extractHandle(sm.twitter, 'twitter');
    if (tw) {
      jobs.push({
        platform: 'twitter',
        fnName: 'fetch-twitter-apify',
        body: { clientId: client.id, username: tw },
        estimated_cost_usd: 0.01,
      });
    }
  }
  if (platforms.includes('linkedin')) {
    const li = sm.linkedin;
    if (li && typeof li === 'string' && li.trim()) {
      jobs.push({
        platform: 'linkedin',
        fnName: 'fetch-linkedin-apify',
        body: { clientId: client.id, handle: li.trim() },
        estimated_cost_usd: 0.02,
      });
    }
  }
  if (platforms.includes('youtube')) {
    const yt = sm.youtube_channel_id || extractHandle(sm.youtube, 'youtube');
    if (yt) {
      jobs.push({
        platform: 'youtube',
        fnName: 'fetch-youtube-metrics',
        body: { clientId: client.id, channelHandle: yt },
        estimated_cost_usd: 0,
      });
    }
  }
  return jobs;
}

function getOrigin(req: VercelRequest): string {
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
  const host = req.headers.host || 'localhost:3000';
  return `${proto}://${host}`;
}

async function callInternal(
  req: VercelRequest,
  fnName: string,
  body: any,
): Promise<{ ok: boolean; status: number; data: any }> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (req.headers.authorization) headers.Authorization = String(req.headers.authorization);
    const r = await fetch(`${getOrigin(req)}/api/${fnName}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const json = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, data: json };
  } catch (e: any) {
    return { ok: false, status: 0, data: { error: e.message } };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res);
  if (req.method !== 'POST' && req.method !== 'GET') {
    return jsonError(res, 405, 'Method not allowed');
  }

  // Auth: cron OR authed user
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;
  const isCron =
    req.headers['x-vercel-cron'] === '1' ||
    (cronSecret && authHeader === `Bearer ${cronSecret}`);
  if (!isCron) {
    const user = await tryAuth(req);
    if (!user) return jsonError(res, 401, 'Unauthorized');
  }

  const startedAt = Date.now();
  try {
    const body =
      req.body && typeof req.body === 'object'
        ? req.body
        : req.body
        ? JSON.parse(req.body)
        : {};
    const platforms: Platform[] =
      Array.isArray(body.platforms) && body.platforms.length > 0
        ? body.platforms
        : ['instagram', 'tiktok', 'twitter', 'linkedin', 'youtube'];
    const triggeredBy = body.source === 'cron' || isCron ? 'cron' : 'manual';
    const onlyClientId = body.clientId as string | undefined;

    const clients = onlyClientId
      ? await query<any>(`SELECT id, name, social_media FROM clients WHERE id = $1`, [onlyClientId])
      : await query<any>(`SELECT id, name, social_media FROM clients`);

    const allJobs: Array<{ client: any; job: PlatformJob }> = [];
    for (const c of clients) {
      const jobs = buildJobsForClient(c, platforms);
      for (const j of jobs) allJobs.push({ client: c, job: j });
    }

    console.log(
      `[sync-all-metrics] ${clients.length} clients → ${allJobs.length} jobs (${platforms.join(',')})`,
    );

    const CONCURRENCY = 5;
    const results: any[] = [];
    let totalCost = 0;

    for (let i = 0; i < allJobs.length; i += CONCURRENCY) {
      const batch = allJobs.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.allSettled(
        batch.map(async ({ client, job }) => {
          const t0 = Date.now();
          try {
            const resp = await callInternal(req, job.fnName, job.body);
            const json = resp.data || {};
            const ok = resp.ok && json?.success !== false;
            const duration = Date.now() - t0;
            totalCost += job.estimated_cost_usd;

            await getPool()
              .query(
                `INSERT INTO metrics_sync_runs
                  (client_id, platform, status, triggered_by, duration_ms,
                   estimated_cost_usd, items_synced, error_message, metadata)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
                [
                  client.id,
                  job.platform,
                  ok ? 'success' : 'failed',
                  triggeredBy,
                  duration,
                  job.estimated_cost_usd,
                  json?.items_synced || 0,
                  ok ? null : json?.error || `HTTP ${resp.status}`,
                  JSON.stringify({ client_name: client.name }),
                ],
              )
              .catch((e: any) => console.warn('[sync-all-metrics] insert run failed:', e.message));

            return {
              client: client.name,
              platform: job.platform,
              ok,
              error: ok ? null : json?.error,
            };
          } catch (e: any) {
            const duration = Date.now() - t0;
            await getPool()
              .query(
                `INSERT INTO metrics_sync_runs
                  (client_id, platform, status, triggered_by, duration_ms,
                   estimated_cost_usd, error_message, metadata)
                 VALUES ($1, $2, 'failed', $3, $4, 0, $5, $6::jsonb)`,
                [
                  client.id,
                  job.platform,
                  triggeredBy,
                  duration,
                  e.message,
                  JSON.stringify({ client_name: client.name }),
                ],
              )
              .catch(() => null);
            return { client: client.name, platform: job.platform, ok: false, error: e.message };
          }
        }),
      );
      for (const r of batchResults) {
        if (r.status === 'fulfilled') results.push(r.value);
        else results.push({ ok: false, error: String(r.reason) });
      }
    }

    const ok = results.filter((r) => r.ok).length;
    const failed = results.length - ok;

    return res.status(200).json({
      success: true,
      duration_ms: Date.now() - startedAt,
      total_jobs: results.length,
      ok,
      failed,
      estimated_cost_usd: Number(totalCost.toFixed(4)),
      triggered_by: triggeredBy,
      results,
    });
  } catch (err: any) {
    console.error('[sync-all-metrics] fatal:', err);
    return jsonError(res, 500, err?.message || 'fatal');
  }
}
