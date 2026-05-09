// Cron: 1x/dia (13h UTC) — atualiza metrics de posts publicados nos últimos 60 dias.
//
// Lê planning_items WHERE status='published' AND external_post_id IS NOT NULL
// AND published_at > NOW() - 60d AND (metrics_synced_at IS NULL OR > 12h atrás).
// Pra cada item, chama getNetworkPosts/getInstagramReels e persiste metadata.metrics.
//
// Limite por run: 100 items. Rate-limit Metricool (~30 req/h) é respeitado em
// fan-out por blog (não por item) — de fato fazemos 1 query por (blogId, network).
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight } from '../_lib/cors.js';
import { getPool, query } from '../_lib/db.js';
import {
  getMetricoolConfig,
  getNetworkPosts,
  getInstagramReels,
  type MetricoolAnalyticsNetwork,
  type MetricoolPostMetrics,
} from '../_lib/integrations/metricool.js';

interface PlanningRow {
  id: string;
  client_id: string | null;
  platform: string | null;
  external_post_id: string;
  published_at: string | null;
  metadata: Record<string, any>;
}

const NETWORK_MAP: Record<string, MetricoolAnalyticsNetwork> = {
  instagram: 'instagram',
  facebook: 'facebook',
  twitter: 'twitter',
  linkedin: 'linkedin',
  tiktok: 'tiktok',
  threads: 'threads',
  youtube: 'youtube',
};

function pickNumber(...vals: Array<unknown>): number {
  for (const v of vals) {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return 0;
}

function normalizeMetrics(m: MetricoolPostMetrics | Record<string, unknown>) {
  const r = m as Record<string, unknown>;
  const likes = pickNumber(r.likes, r.likeCount, r.reactions);
  const comments = pickNumber(r.comments, r.commentCount, r.replies);
  const shares = pickNumber(r.shares, r.shareCount, r.retweets, r.reposts);
  const reach = pickNumber(r.reach, r.uniqueReach);
  const impressions = pickNumber(r.impressions, r.views);
  const video_views = pickNumber(r.videoViews, r.plays, r.videoPlays);
  const saves = pickNumber(r.saves, r.saved, r.bookmarkCount);
  let eng_rate = pickNumber(r.engagementRate, r.engagement_rate);
  if (!eng_rate && reach > 0) {
    eng_rate = ((likes + comments + shares + saves) / reach) * 100;
  }
  return {
    likes,
    comments,
    shares,
    reach,
    impressions,
    video_views,
    saves,
    eng_rate: Number.isFinite(eng_rate) ? eng_rate : 0,
    last_synced_at: new Date().toISOString(),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res);

  const authHeader = req.headers.authorization;
  const isVercelCron = !!req.headers['x-vercel-cron'];
  const isManualCron = authHeader === `Bearer ${process.env.CRON_SECRET}` && !!process.env.CRON_SECRET;
  if (!isVercelCron && !isManualCron) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let cfg;
  try {
    cfg = getMetricoolConfig();
  } catch (e: any) {
    return res.status(503).json({ error: 'Metricool not configured', detail: e.message });
  }

  const pool = getPool();
  const startedAt = Date.now();

  // 1. Items pendentes de sync
  const items = await query<PlanningRow>(
    `SELECT pi.id, pi.client_id, pi.platform, pi.external_post_id, pi.published_at, pi.metadata
       FROM planning_items pi
      WHERE pi.status = 'published'
        AND pi.external_post_id IS NOT NULL
        AND pi.published_at IS NOT NULL
        AND pi.published_at > NOW() - INTERVAL '60 days'
        AND (
          pi.metadata->>'metrics_synced_at' IS NULL
          OR (pi.metadata->>'metrics_synced_at')::timestamptz < NOW() - INTERVAL '12 hours'
        )
      ORDER BY pi.published_at DESC
      LIMIT 100`,
  );

  if (items.length === 0) {
    return res.status(200).json({
      ok: true,
      message: 'no items need metrics sync',
      durationMs: Date.now() - startedAt,
    });
  }

  // 2. Agrupa por (blogId, network) pra reduzir fan-out de chamadas
  // Resolve blogId por client_id em batch
  const clientIds = Array.from(new Set(items.map((i) => i.client_id).filter(Boolean) as string[]));
  const blogMap = new Map<string, string>();
  if (clientIds.length > 0) {
    const rows = await query<{ client_id: string; blog_id: string }>(
      `SELECT client_id, metadata->>'metricool_blog_id' AS blog_id
         FROM client_social_credentials
        WHERE client_id = ANY($1::uuid[])
          AND metadata->>'metricool_blog_id' IS NOT NULL`,
      [clientIds],
    );
    for (const r of rows) blogMap.set(r.client_id, r.blog_id);
  }

  // bucket por (blogId, network)
  type Bucket = {
    blogId: string;
    network: MetricoolAnalyticsNetwork;
    items: PlanningRow[];
    minDate: Date;
  };
  const buckets = new Map<string, Bucket>();
  for (const item of items) {
    if (!item.client_id) continue;
    const blogId = blogMap.get(item.client_id);
    if (!blogId) continue;
    const network = NETWORK_MAP[item.platform || ''];
    if (!network) continue;
    const key = `${blogId}::${network}`;
    const pubDate = item.published_at ? new Date(item.published_at) : new Date();
    const existing = buckets.get(key);
    if (existing) {
      existing.items.push(item);
      if (pubDate < existing.minDate) existing.minDate = pubDate;
    } else {
      buckets.set(key, { blogId, network, items: [item], minDate: pubDate });
    }
  }

  let updated = 0;
  let notFound = 0;
  let failedBuckets = 0;
  const events: any[] = [];
  const to = new Date().toISOString().slice(0, 19);

  for (const bucket of buckets.values()) {
    const from = new Date(bucket.minDate.getTime() - 86400_000).toISOString().slice(0, 19);
    let posts: MetricoolPostMetrics[] = [];
    try {
      posts = await getNetworkPosts(cfg, bucket.blogId, bucket.network, from, to);
      // Pra IG, complementa com reels (alguns posts só aparecem lá)
      if (bucket.network === 'instagram') {
        try {
          const reels = await getInstagramReels(cfg, bucket.blogId, from, to);
          posts = [...posts, ...reels];
        } catch {
          /* ignore */
        }
      }
    } catch (e: any) {
      failedBuckets++;
      events.push({ blogId: bucket.blogId, network: bucket.network, error: e.message });
      continue;
    }

    const byId = new Map<string, MetricoolPostMetrics>();
    for (const p of posts) byId.set(String(p.id), p);

    for (const item of bucket.items) {
      const remote = byId.get(String(item.external_post_id));
      if (!remote) {
        notFound++;
        events.push({ id: item.id, postId: item.external_post_id, action: 'not_found' });
        continue;
      }
      const metrics = normalizeMetrics(remote);
      const newMeta = {
        ...(item.metadata || {}),
        metrics,
        metrics_synced_at: metrics.last_synced_at,
      };
      await pool.query(
        `UPDATE planning_items SET metadata = $1::jsonb, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(newMeta), item.id],
      );
      updated++;
      events.push({
        id: item.id,
        postId: item.external_post_id,
        action: 'updated',
        likes: metrics.likes,
        comments: metrics.comments,
      });
    }
  }

  return res.status(200).json({
    ok: true,
    candidates: items.length,
    buckets: buckets.size,
    updated,
    notFound,
    failedBuckets,
    events: events.slice(0, 50),
    durationMs: Date.now() - startedAt,
  });
}
