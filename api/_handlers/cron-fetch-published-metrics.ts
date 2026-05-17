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
import { assertCronAuth } from '../_lib/cron-auth.js';
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

  if (!assertCronAuth(req, res)) return;

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

  // 1.5. Local-first — tenta resolver via metricool_posts (populado pelo
  //      cron-metricool-backfill-posts às 5h UTC). Se o post já está local
  //      e foi sincronizado nas últimas 12h, atualiza direto sem hit API.
  //      Reduz drasticamente requests à Metricool (cap horário ~30 req).
  const itemKeys = items
    .filter((i) => i.client_id && i.platform && i.external_post_id)
    .map((i) => ({
      planning_id: i.id,
      client_id: i.client_id as string,
      // Metricool grava post_id como `${network}:${id}` (ver pickPostId no backfill)
      post_id: `${i.platform}:${i.external_post_id}`,
      network: NETWORK_MAP[i.platform || ''] as string,
    }))
    .filter((k) => k.network);

  let localResolved = 0;
  const resolvedItemIds = new Set<string>();
  if (itemKeys.length > 0) {
    const localPosts = await query<{
      client_id: string;
      network: string;
      post_id: string;
      likes: number | null;
      comments: number | null;
      shares: number | null;
      saves: number | null;
      reach: number | null;
      impressions: number | null;
      views: number | null;
      video_views: number | null;
      engagement_rate: string | null;
      last_synced_at: string;
    }>(
      `SELECT client_id, network, post_id, likes, comments, shares, saves,
              reach, impressions, views, video_views, engagement_rate, last_synced_at
         FROM metricool_posts
        WHERE (client_id, network, post_id) = ANY(
          SELECT (k->>'client_id')::uuid, k->>'network', k->>'post_id'
            FROM jsonb_array_elements($1::jsonb) k
        )
          AND last_synced_at > NOW() - INTERVAL '12 hours'`,
      [JSON.stringify(itemKeys.map((k) => ({ client_id: k.client_id, network: k.network, post_id: k.post_id })))],
    );
    const byKey = new Map(
      localPosts.map((p) => [`${p.client_id}::${p.network}::${p.post_id}`, p]),
    );

    // N+1 fix: junta todos os UPDATEs num batch via UPDATE FROM VALUES.
    type LocalBatchEntry = { itemId: string; metadata: string };
    const localBatch: LocalBatchEntry[] = [];

    for (const k of itemKeys) {
      const local = byKey.get(`${k.client_id}::${k.network}::${k.post_id}`);
      if (!local) continue;
      const item = items.find((i) => i.id === k.planning_id);
      if (!item) continue;
      const metrics: any = {
        likes: local.likes ?? 0,
        comments: local.comments ?? 0,
        shares: local.shares ?? 0,
        saves: local.saves ?? 0,
        reach: local.reach ?? 0,
        impressions: local.impressions ?? 0,
        views: local.views ?? local.video_views ?? 0,
        engagement_rate: local.engagement_rate ? Number(local.engagement_rate) : null,
        source: 'metricool_posts_local',
        last_synced_at: local.last_synced_at,
      };
      const newMeta = {
        ...(item.metadata || {}),
        metrics,
        metrics_synced_at: local.last_synced_at,
      };
      localBatch.push({ itemId: item.id, metadata: JSON.stringify(newMeta) });
      resolvedItemIds.add(item.id);
    }

    if (localBatch.length > 0) {
      const valuesClause = localBatch
        .map((_, i) => `($${i * 2 + 1}::uuid, $${i * 2 + 2}::jsonb)`)
        .join(', ');
      const params: any[] = [];
      for (const e of localBatch) {
        params.push(e.itemId);
        params.push(e.metadata);
      }
      await pool.query(
        `UPDATE planning_items pi
            SET metadata = data.metadata, updated_at = NOW()
           FROM (VALUES ${valuesClause}) AS data(id, metadata)
          WHERE pi.id = data.id`,
        params,
      );
      localResolved += localBatch.length;
    }
  }

  // Filtra items que ainda precisam ir pra API
  const remainingItems = items.filter((i) => !resolvedItemIds.has(i.id));
  if (remainingItems.length === 0) {
    return res.status(200).json({
      ok: true,
      candidates: items.length,
      localResolved,
      message: 'all resolved from local cache',
      durationMs: Date.now() - startedAt,
    });
  }

  // 2. Agrupa por (blogId, network) pra reduzir fan-out de chamadas
  // Resolve blogId por client_id em batch — só clientes dos remainingItems
  const clientIds = Array.from(new Set(remainingItems.map((i) => i.client_id).filter(Boolean) as string[]));
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
  for (const item of remainingItems) {
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

    // N+1 fix: ao invés de 1 UPDATE por item, faz BATCH UPDATE via UPDATE ...
    // FROM (VALUES (...)) AS data(id, metadata) — 1 round-trip pro DB.
    // Em buckets de 25 items (cap LIMIT do scheduled-posts), isso reduz
    // latência de 250ms (25 * 10ms RTT) → 15ms. Em produção com cap 100
    // de planning_items pickup, fica ainda mais relevante.
    type UpdatePayload = { id: string; metadata: string; eventEntry: any };
    const batchUpdates: UpdatePayload[] = [];

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
      batchUpdates.push({
        id: item.id,
        metadata: JSON.stringify(newMeta),
        eventEntry: {
          id: item.id,
          postId: item.external_post_id,
          action: 'updated',
          likes: metrics.likes,
          comments: metrics.comments,
        },
      });
    }

    if (batchUpdates.length > 0) {
      // Constrói VALUES com placeholders ($1,$2),($3,$4),...
      const valuesClause = batchUpdates
        .map((_, i) => `($${i * 2 + 1}::uuid, $${i * 2 + 2}::jsonb)`)
        .join(', ');
      const params: any[] = [];
      for (const u of batchUpdates) {
        params.push(u.id);
        params.push(u.metadata);
      }
      await pool.query(
        `UPDATE planning_items pi
            SET metadata = data.metadata, updated_at = NOW()
           FROM (VALUES ${valuesClause}) AS data(id, metadata)
          WHERE pi.id = data.id`,
        params,
      );
      updated += batchUpdates.length;
      for (const u of batchUpdates) events.push(u.eventEntry);
    }
  }

  return res.status(200).json({
    ok: true,
    candidates: items.length,
    localResolved,
    apiCandidates: remainingItems.length,
    buckets: buckets.size,
    updated,
    notFound,
    failedBuckets,
    events: events.slice(0, 50),
    durationMs: Date.now() - startedAt,
  });
}
