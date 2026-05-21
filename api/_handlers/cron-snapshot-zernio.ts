// Snapshot diário de métricas do Late/Zernio → tabela zernio_daily_snapshots.
// Substitui o antigo cron-fetch-published-metrics (dependia de Metricool).
//
// Pra cada cliente com `late_profile_id` conectado, busca analytics +
// follower-stats das plataformas (instagram, twitter, linkedin, tiktok,
// youtube) e grava 1 row por (client, network, dia). Idempotente (upsert).
//
// Custo: ZERO Apify — usa só a API do Late/Zernio (analytics addon já ativo).
//
// Auth: cron (Bearer CRON_SECRET) OU usuário autenticado (trigger manual).
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';
import { getPool, query } from '../_lib/db.js';
import { tryAuth } from '../_lib/auth.js';
import { isValidCronCall } from '../_lib/cron-auth.js';

const LATE_API_BASE = 'https://getlate.dev/api/v1';
const PLATFORMS = ['instagram', 'twitter', 'linkedin', 'tiktok', 'youtube'] as const;
type Platform = (typeof PLATFORMS)[number];

interface LatePostAnalytics {
  impressions?: number;
  reach?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  views?: number;
  engagementRate?: number;
}
interface LatePost {
  analytics?: LatePostAnalytics;
  // shapes antigos guardavam métricas no topo — fallback defensivo:
  impressions?: number;
  likes?: number;
}

function spDateKey(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
}

async function fetchAnalytics(
  profileId: string,
  apiKey: string,
  platform: string,
  fromDate: string,
  toDate: string,
): Promise<{ posts: LatePost[]; addonMissing?: boolean }> {
  const params = new URLSearchParams({ profileId, platform, fromDate, toDate, limit: '100' });
  const r = await fetch(`${LATE_API_BASE}/analytics?${params}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!r.ok) {
    if (r.status === 402) return { posts: [], addonMissing: true };
    return { posts: [] };
  }
  const data = await r.json().catch(() => ({}));
  return { posts: data.posts || data.data || [] };
}

async function fetchFollowerStats(
  profileId: string,
  apiKey: string,
  fromDate: string,
  toDate: string,
): Promise<any[]> {
  const params = new URLSearchParams({ profileId, granularity: 'daily', fromDate, toDate });
  const r = await fetch(`${LATE_API_BASE}/accounts/follower-stats?${params}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!r.ok) return [];
  const data = await r.json().catch(() => ({}));
  return data.accounts || data.data || [];
}

function latestFollowers(account: any): number | null {
  if (!account?.stats || typeof account.stats !== 'object') {
    return typeof account?.followers === 'number' ? account.followers : null;
  }
  const dates = Object.keys(account.stats).sort();
  const last = dates[dates.length - 1];
  return last ? account.stats[last]?.followers ?? null : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res, req);
  if (req.method !== 'POST' && req.method !== 'GET') {
    return jsonError(res, 405, 'Method not allowed');
  }

  const isCron = isValidCronCall(req);
  if (!isCron) {
    const authed = await tryAuth(req);
    if (!authed) return jsonError(res, 401, 'Unauthorized');
  }

  const apiKey = process.env.LATE_API_KEY;
  if (!apiKey) return jsonError(res, 503, 'LATE_API_KEY not configured');

  const today = spDateKey();
  const fromDate30d = spDateKey(new Date(Date.now() - 30 * 86400000));
  const startedAt = Date.now();

  try {
    const body =
      req.body && typeof req.body === 'object' ? req.body : req.body ? JSON.parse(req.body) : {};
    const onlyClientId = body.clientId as string | undefined;

    const clients = onlyClientId
      ? await query<any>(`SELECT id, name FROM clients WHERE id = $1`, [onlyClientId])
      : await query<any>(`SELECT id, name FROM clients`);

    const summary: Record<string, number> = {};
    let rowsUpserted = 0;
    let addonMissing = false;
    const pool = getPool();

    for (const client of clients) {
      const creds = await query<any>(
        `SELECT platform, metadata->>'late_profile_id' AS late_profile_id
           FROM client_social_credentials
          WHERE client_id = $1 AND metadata->>'late_profile_id' IS NOT NULL`,
        [client.id],
      );
      if (!creds.length) continue;

      // platform → profileId (uma plataforma pode estar num profile específico)
      const platformProfile = new Map<Platform, string>();
      for (const c of creds) {
        if ((PLATFORMS as readonly string[]).includes(c.platform) && c.late_profile_id) {
          platformProfile.set(c.platform as Platform, c.late_profile_id);
        }
      }
      if (!platformProfile.size) continue;

      // follower-stats por profileId (cache pra não repetir)
      const followerCache = new Map<string, any[]>();
      const getFollowers = async (profileId: string) => {
        if (!followerCache.has(profileId)) {
          followerCache.set(
            profileId,
            await fetchFollowerStats(profileId, apiKey, fromDate30d, today),
          );
        }
        return followerCache.get(profileId)!;
      };

      for (const [platform, profileId] of platformProfile) {
        const { posts, addonMissing: am } = await fetchAnalytics(
          profileId,
          apiKey,
          platform,
          fromDate30d,
          today,
        );
        if (am) addonMissing = true;

        let imp = 0,
          reach = 0,
          likes = 0,
          comments = 0,
          shares = 0,
          saves = 0,
          views = 0;
        const erates: number[] = [];
        for (const p of posts) {
          const a = p.analytics ?? {};
          imp += a.impressions ?? p.impressions ?? 0;
          reach += a.reach ?? 0;
          likes += a.likes ?? p.likes ?? 0;
          comments += a.comments ?? 0;
          shares += a.shares ?? 0;
          saves += a.saves ?? 0;
          views += a.views ?? 0;
          if (typeof a.engagementRate === 'number') erates.push(a.engagementRate);
        }
        const avgEr =
          erates.length > 0 ? erates.reduce((s, v) => s + v, 0) / erates.length : 0;

        const followerAccounts = await getFollowers(profileId);
        const acct = followerAccounts.find(
          (f: any) => f.platform?.toLowerCase() === platform,
        );
        const followers = acct ? latestFollowers(acct) : null;

        // Pula gravação se não há nada (sem posts, sem followers) — evita lixo.
        if (posts.length === 0 && followers === null) continue;

        await pool.query(
          `INSERT INTO zernio_daily_snapshots
             (client_id, late_profile_id, network, snapshot_date, followers,
              posts_count, total_likes, total_comments, total_shares, total_reach,
              total_impressions, total_views, total_saves, avg_engagement_rate, raw_data)
           VALUES ($1,$2,$3,$4::date,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb)
           ON CONFLICT (client_id, network, snapshot_date) DO UPDATE SET
             late_profile_id = EXCLUDED.late_profile_id,
             followers = EXCLUDED.followers,
             posts_count = EXCLUDED.posts_count,
             total_likes = EXCLUDED.total_likes,
             total_comments = EXCLUDED.total_comments,
             total_shares = EXCLUDED.total_shares,
             total_reach = EXCLUDED.total_reach,
             total_impressions = EXCLUDED.total_impressions,
             total_views = EXCLUDED.total_views,
             total_saves = EXCLUDED.total_saves,
             avg_engagement_rate = EXCLUDED.avg_engagement_rate,
             raw_data = EXCLUDED.raw_data,
             updated_at = now()`,
          [
            client.id,
            profileId,
            platform,
            today,
            followers,
            posts.length,
            likes,
            comments,
            shares,
            reach,
            imp,
            views,
            saves,
            Math.round(avgEr * 100) / 100,
            JSON.stringify({ source: 'zernio', postsSampled: posts.length }),
          ],
        );
        rowsUpserted++;
        summary[platform] = (summary[platform] || 0) + 1;
      }
    }

    return res.status(200).json({
      success: true,
      date: today,
      clients: clients.length,
      rowsUpserted,
      byPlatform: summary,
      addonMissing,
      durationMs: Date.now() - startedAt,
    });
  } catch (e: any) {
    console.error('[cron-snapshot-zernio] error:', e);
    return jsonError(res, 500, e?.message || 'snapshot failed');
  }
}
