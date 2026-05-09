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
  getFacebookReels,
  getInstagramStories,
  getFacebookStories,
  normalizeMetrics,
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
  // Gap #1 — filtra apenas posts criados via Metricool (NULL = retro-compat).
  // Gap #5 — decay 30d+: se já sincado nos últimos 7d, pula (métrica raramente muda).
  const items = await query<PlanningRow>(
    `SELECT pi.id, pi.client_id, pi.platform, pi.external_post_id, pi.published_at, pi.metadata
       FROM planning_items pi
      WHERE pi.status = 'published'
        AND pi.external_post_id IS NOT NULL
        AND pi.published_at IS NOT NULL
        AND pi.published_at > NOW() - INTERVAL '60 days'
        AND (pi.metadata->>'provider' = 'metricool' OR pi.metadata->>'provider' IS NULL)
        AND (
          pi.metadata->>'metrics_synced_at' IS NULL
          OR (pi.metadata->>'metrics_synced_at')::timestamptz < NOW() - INTERVAL '12 hours'
        )
        AND NOT (
          pi.published_at < NOW() - INTERVAL '30 days'
          AND (pi.metadata->'metrics'->>'last_synced_at')::timestamptz > NOW() - INTERVAL '7 days'
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

  // bucket por (blogId, network, kind) — Gap #2: stories e reels usam endpoints próprios
  type ContentKind = 'post' | 'reel' | 'story';
  type Bucket = {
    blogId: string;
    network: MetricoolAnalyticsNetwork;
    kind: ContentKind;
    items: PlanningRow[];
    minDate: Date;
  };

  function detectKind(item: PlanningRow): ContentKind {
    const meta = (item.metadata || {}) as Record<string, any>;
    const ct = String(meta.contentType ?? meta.content_type ?? '').toLowerCase();
    if (ct === 'story' || ct === 'stories') return 'story';
    if (ct === 'reel' || ct === 'reels') return 'reel';
    const igType = String(meta?.instagramData?.type ?? '').toLowerCase();
    if (igType === 'story') return 'story';
    if (igType === 'reel') return 'reel';
    const fbType = String(meta?.facebookData?.type ?? '').toLowerCase();
    if (fbType === 'story') return 'story';
    if (fbType === 'reel') return 'reel';
    return 'post';
  }

  const buckets = new Map<string, Bucket>();
  for (const item of items) {
    if (!item.client_id) continue;
    const blogId = blogMap.get(item.client_id);
    if (!blogId) continue;
    const network = NETWORK_MAP[item.platform || ''];
    if (!network) continue;
    const kind = detectKind(item);
    // stories/reels só fazem sentido em IG/FB; em outras redes força 'post'
    const effectiveKind: ContentKind =
      (kind === 'story' || kind === 'reel') && (network === 'instagram' || network === 'facebook')
        ? kind
        : 'post';
    const key = `${blogId}::${network}::${effectiveKind}`;
    const pubDate = item.published_at ? new Date(item.published_at) : new Date();
    const existing = buckets.get(key);
    if (existing) {
      existing.items.push(item);
      if (pubDate < existing.minDate) existing.minDate = pubDate;
    } else {
      buckets.set(key, { blogId, network, kind: effectiveKind, items: [item], minDate: pubDate });
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
      if (bucket.kind === 'story') {
        // Gap #2 — stories endpoint dedicado
        posts = bucket.network === 'instagram'
          ? await getInstagramStories(cfg, bucket.blogId, from, to)
          : await getFacebookStories(cfg, bucket.blogId, from, to);
      } else if (bucket.kind === 'reel') {
        posts = bucket.network === 'instagram'
          ? await getInstagramReels(cfg, bucket.blogId, from, to)
          : await getFacebookReels(cfg, bucket.blogId, from, to);
      } else {
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
      }
    } catch (e: any) {
      failedBuckets++;
      events.push({
        blogId: bucket.blogId,
        network: bucket.network,
        kind: bucket.kind,
        error: e.message,
      });
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
