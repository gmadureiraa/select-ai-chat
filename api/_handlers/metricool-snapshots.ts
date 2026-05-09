// Lê snapshots históricos diários do `metricool_daily_snapshots`.
//
// Body: { clientId, network, fromDate, toDate }
//
// Lógica:
//   1. SELECT do range
//   2. Se snapshots cobrem todo o range -> source = 'snapshots'
//   3. Se range > 30d e snapshots começam tarde (gap no início) -> tenta
//      complementar com Metricool API (getNetworkPosts agregado por dia)
//      -> source = 'mixed'
//   4. Se snapshots vazios totalmente -> tenta API direto -> source = 'api'
//
// Retorno: { snapshots: [{date, followers, posts_count, total_likes, ...}], source }
import { authedPost } from '../_lib/handler.js';
import { query } from '../_lib/db.js';
import {
  getMetricoolConfig,
  resolveBlogId,
  getNetworkPosts,
  type MetricoolAnalyticsNetwork,
} from '../_lib/integrations/metricool.js';

interface SnapshotRow {
  date: string;
  followers: number | null;
  posts_count: number;
  total_likes: number;
  total_comments: number;
  total_shares: number;
  total_reach: number;
  total_impressions: number;
  total_views: number;
  total_saves: number;
  avg_engagement_rate: number;
  source: 'snapshot' | 'api';
}

function localDateKey(d: Date, tz = 'America/Sao_Paulo'): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d);
}

function n(v: unknown, fallback = 0): number {
  const num = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(num) ? num : fallback;
}

function getMetric(p: any, key: 'likes' | 'comments' | 'shares' | 'reach' | 'impressions' | 'views' | 'saves'): number {
  if (key === 'likes') return n(p.likes ?? p.reactions);
  if (key === 'comments') return n(p.comments);
  if (key === 'shares') return n(p.shares ?? p.reposts ?? p.retweets);
  if (key === 'reach') return n(p.reach);
  if (key === 'impressions') return n(p.impressions ?? p.views ?? p.videoViews);
  if (key === 'views') return n(p.videoViews ?? p.views ?? p.plays ?? p.impressions);
  if (key === 'saves') return n(p.saves ?? p.saved ?? p.savedCount);
  return 0;
}

function aggregateApiPostsByDay(posts: any[]): Record<string, Omit<SnapshotRow, 'date' | 'followers' | 'source'>> {
  const out: Record<string, Omit<SnapshotRow, 'date' | 'followers' | 'source'>> = {};
  for (const p of posts) {
    const dateStr = (p.date || p.publishedAt || p.publishDate || p.timestamp || '') as string;
    if (!dateStr) continue;
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) continue;
    const k = localDateKey(d);
    if (!out[k]) {
      out[k] = {
        posts_count: 0,
        total_likes: 0,
        total_comments: 0,
        total_shares: 0,
        total_reach: 0,
        total_impressions: 0,
        total_views: 0,
        total_saves: 0,
        avg_engagement_rate: 0,
      };
    }
    const cur = out[k];
    cur.posts_count += 1;
    cur.total_likes += getMetric(p, 'likes');
    cur.total_comments += getMetric(p, 'comments');
    cur.total_shares += getMetric(p, 'shares');
    cur.total_reach += getMetric(p, 'reach');
    cur.total_impressions += getMetric(p, 'impressions');
    cur.total_views += getMetric(p, 'views');
    cur.total_saves += getMetric(p, 'saves');
  }
  for (const k of Object.keys(out)) {
    const r = out[k];
    const eng = r.total_likes + r.total_comments + r.total_shares;
    const denom = Math.max(r.total_reach, r.total_impressions);
    r.avg_engagement_rate = denom > 0 ? Number(((eng / denom) * 100).toFixed(3)) : 0;
  }
  return out;
}

export default authedPost(async ({ body }) => {
  const { clientId, network, fromDate, toDate } = body as {
    clientId: string;
    network: MetricoolAnalyticsNetwork;
    fromDate?: string;
    toDate?: string;
  };

  if (!clientId) throw new Error('clientId é obrigatório');
  if (!network) throw new Error('network é obrigatório');

  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 30 * 86400_000);
  const from = fromDate || localDateKey(defaultFrom);
  const to = toDate || localDateKey(now);

  // 1. Snapshots locais
  const rows = await query<any>(
    `SELECT
        TO_CHAR(snapshot_date, 'YYYY-MM-DD') AS date,
        followers,
        posts_count,
        total_likes,
        total_comments,
        total_shares,
        total_reach,
        total_impressions,
        total_views,
        total_saves,
        COALESCE(avg_engagement_rate, 0)::float AS avg_engagement_rate
       FROM metricool_daily_snapshots
      WHERE client_id = $1
        AND network = $2
        AND snapshot_date >= $3::date
        AND snapshot_date <= $4::date
      ORDER BY snapshot_date ASC`,
    [clientId, network, from, to],
  );

  const snapshotMap = new Map<string, SnapshotRow>();
  for (const r of rows) {
    snapshotMap.set(r.date, {
      date: r.date,
      followers: r.followers ?? null,
      posts_count: r.posts_count ?? 0,
      total_likes: r.total_likes ?? 0,
      total_comments: r.total_comments ?? 0,
      total_shares: r.total_shares ?? 0,
      total_reach: r.total_reach ?? 0,
      total_impressions: r.total_impressions ?? 0,
      total_views: r.total_views ?? 0,
      total_saves: r.total_saves ?? 0,
      avg_engagement_rate: Number(r.avg_engagement_rate ?? 0),
      source: 'snapshot',
    });
  }

  // Calcula range completo de dias entre from..to
  const rangeDays: string[] = [];
  const fromD = new Date(`${from}T00:00:00Z`);
  const toD = new Date(`${to}T00:00:00Z`);
  for (let d = new Date(fromD); d <= toD; d.setUTCDate(d.getUTCDate() + 1)) {
    rangeDays.push(localDateKey(d, 'UTC'));
  }
  const totalDays = rangeDays.length;
  const snapshotDays = snapshotMap.size;

  // 2. Se snapshots cobrem >= 90% do range -> só snapshots
  const coverage = snapshotDays / totalDays;
  let source: 'snapshots' | 'mixed' | 'api' = 'snapshots';

  // 3. Range > 30d e snapshots começam tarde -> complementar com API
  // 4. Snapshots vazios -> só API
  const needsApi = snapshotDays === 0 || (totalDays > 30 && coverage < 0.5);
  if (needsApi) {
    try {
      const cfg = getMetricoolConfig();
      const blogId = await resolveBlogId(clientId);
      if (blogId) {
        const apiFrom = `${from}T00:00:00`;
        const apiTo = `${to}T23:59:59`;
        const posts = await getNetworkPosts(cfg, blogId, network, apiFrom, apiTo).catch(() => [] as any[]);
        const apiBuckets = aggregateApiPostsByDay(posts);
        for (const dayKey of Object.keys(apiBuckets)) {
          // Só preenche dias que NÃO têm snapshot local (snapshot é mais confiável)
          if (snapshotMap.has(dayKey)) continue;
          const a = apiBuckets[dayKey];
          snapshotMap.set(dayKey, {
            date: dayKey,
            followers: null,
            ...a,
            source: 'api',
          });
        }
        source = snapshotDays > 0 ? 'mixed' : 'api';
      }
    } catch (e: any) {
      // API failure não derruba a resposta — só retorna o que tem nos snapshots
      console.warn('[metricool-snapshots] API fallback failed:', e.message);
    }
  }

  // Sort por data
  const snapshots = Array.from(snapshotMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  return {
    ok: true,
    snapshots,
    source,
    range: { from, to, days: totalDays },
    coverage: { snapshotDays, totalDays, ratio: Number(coverage.toFixed(2)) },
  };
});
