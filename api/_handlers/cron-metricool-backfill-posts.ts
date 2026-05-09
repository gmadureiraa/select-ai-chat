// Cron diário 05:00 UTC: backfill COMPLETO de posts individuais Metricool
// das últimas 90 dias por (client × network), incluindo reels/stories IG/FB.
//
// Fluxo:
//   1. Lista pares (client_id, blog_id) com metricool_blog_id mapeado
//   2. Pra cada cliente × cada rede (7):
//      - getNetworkPosts(from -90d, to now) — todos posts publicados
//      - IG: + getInstagramReels + getInstagramStories
//      - FB: + getFacebookReels + getFacebookStories
//      - UPSERT em metricool_posts com ON CONFLICT(client_id, network, post_id)
//   3. Idempotente — atualiza métricas e last_synced_at em cada execução.
//
// Auth: x-vercel-cron OR `Authorization: Bearer ${CRON_SECRET}`.
// Cap: max 100 (client × redes) por execução, defensivo pro rate-limit
// Metricool (~30 req/h por chave).
//
// Roda 5h UTC (1h antes do snapshot 6h) pra que os snapshots agreguem
// dados frescos. Combina bem com cron-metricool-snapshot existente.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight } from '../_lib/cors.js';
import { getPool, query } from '../_lib/db.js';
import {
  getMetricoolConfig,
  getNetworkPosts,
  getInstagramReels,
  getInstagramStories,
  getFacebookReels,
  getFacebookStories,
  type MetricoolAnalyticsNetwork,
} from '../_lib/integrations/metricool.js';

const BACKFILL_NETWORKS: MetricoolAnalyticsNetwork[] = [
  'instagram',
  'facebook',
  // 'twitter' — Metricool /v2/analytics/posts/twitter retorna só postsCount,
  //              backfill grava zeros e polui dashboards. Usar /stats/twitter/posts
  //              (legacy v1) quando habilitarmos métricas X de verdade.
  'linkedin',
  'tiktok',
  'threads',
  'youtube',
];

const BACKFILL_DAYS = 90;
// Cap defensivo pro rate-limit Metricool (~30 req/h por chave).
// Cada task = até 3 calls (posts + reels/stories), com delay 2s entre tasks
// = max ~30 tasks/min de pico, dentro do orçamento horário.
const MAX_TASKS_PER_RUN = 25; // (client × network)
const TASK_DELAY_MS = 2000;

function n(v: unknown, fallback = 0): number {
  const num = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(num) ? num : fallback;
}

function pickPublishedAt(p: any): string | null {
  // Metricool retorna shapes DIFERENTES por rede:
  //   - Instagram /v2: publishedAt = {dateTime, timezone}
  //   - Threads /v2:   publishedDate = {dateTime, timezone}
  //   - TikTok /v2:    publishedAt (provavelmente object)
  //   - LinkedIn /v2:  publishedAt (não verificado)
  //   - Twitter:       date (string ISO) — legacy
  let raw: any =
    p.publishedAt ?? p.publishedDate ?? p.date ?? p.publishDate ?? p.timestamp ?? p.createdAt;
  if (raw && typeof raw === 'object' && 'dateTime' in raw) raw = raw.dateTime;
  if (!raw) return null;
  const d = new Date(raw as string);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function pickPostId(p: any, network: string): string | null {
  // postId é o canônico (Metricool v2). id como fallback pra endpoints legacy.
  const id = p.postId ?? p.id ?? p.postid ?? p.uuid ?? p.url ?? p.permalink;
  if (!id) return null;
  return `${network}:${String(id)}`;
}

function pickPostType(p: any, fallbackType?: string): string | null {
  const t = (p.type || p.postType || p.mediaType || fallbackType || '') as string;
  return t ? String(t).toUpperCase() : null;
}

function pickThumbnail(p: any): string | null {
  return (
    (p.thumbnail as string) ||
    (p.thumbnailUrl as string) ||
    (p.imageUrl as string) ||
    (p.image as string) ||
    (p.mediaUrl as string) ||
    (Array.isArray(p.media) && p.media[0]?.url) ||
    null
  );
}

function pickMediaUrls(p: any): string[] {
  const urls: string[] = [];
  if (Array.isArray(p.media)) {
    for (const m of p.media) {
      if (typeof m === 'string') urls.push(m);
      else if (m?.url) urls.push(m.url);
    }
  }
  if (Array.isArray(p.mediaUrls)) {
    for (const u of p.mediaUrls) if (typeof u === 'string') urls.push(u);
  }
  if (typeof p.imageUrl === 'string') urls.push(p.imageUrl);
  if (typeof p.thumbnail === 'string') urls.push(p.thumbnail);
  if (typeof p.videoUrl === 'string') urls.push(p.videoUrl);
  // dedup
  return Array.from(new Set(urls));
}

function pickCaption(p: any): string | null {
  // Shapes: IG=content, Threads=text, TikTok=description?, LinkedIn=text
  return (p.content as string) || (p.text as string) || (p.caption as string) || (p.description as string) || (p.title as string) || null;
}

function metric(p: any, key: 'likes' | 'comments' | 'shares' | 'reach' | 'impressions' | 'views' | 'saves' | 'videoViews'): number {
  // Shapes Metricool v2 por rede:
  //   - Instagram: likes, comments, impressionsTotal, saved, shares, reach
  //   - Threads:   likes, replies (=comments), reposts+quotes+shares (=shares), views
  //   - TikTok:    likes, comments, plays/views, shares
  //   - LinkedIn:  likes/reactions, comments, impressions, shares
  //   - YouTube:   likes, comments, views, shares
  if (key === 'likes') return n(p.likes ?? p.reactions);
  if (key === 'comments') return n(p.comments ?? p.replies);
  if (key === 'shares') {
    const base = p.shares ?? p.retweets ?? 0;
    // Threads soma reposts + quotes em "shares"
    return n(base) + n(p.reposts ?? 0) + n(p.quotes ?? 0);
  }
  if (key === 'reach') return n(p.reach);
  if (key === 'impressions') return n(p.impressionsTotal ?? p.impressions);
  if (key === 'views') return n(p.views ?? p.plays);
  if (key === 'videoViews') return n(p.videoViews ?? p.views);
  if (key === 'saves') return n(p.saved ?? p.saves ?? p.savedCount);
  return 0;
}

function engagementRate(p: any): number | null {
  // Metricool v2 retorna `engagement` (já em %) — usa direto se vier
  if (typeof p.engagement === 'number') return Number(p.engagement.toFixed(3));
  if (typeof p.engagementRate === 'number') return Number(p.engagementRate.toFixed(3));
  const eng = metric(p, 'likes') + metric(p, 'comments') + metric(p, 'shares');
  const reach = metric(p, 'reach');
  const imp = metric(p, 'impressions');
  // Prefere reach > impressions, NUNCA usa views como denom (reels infla).
  const denom = Math.max(reach, imp);
  if (denom <= 0) return null;
  return Number(((eng / denom) * 100).toFixed(3));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res);

  const authHeader = req.headers.authorization;
  const isVercelCron = !!req.headers['x-vercel-cron'];
  const isManualCron = authHeader === `Bearer ${process.env.CRON_SECRET}` && !!process.env.CRON_SECRET;
  if (!isVercelCron && !isManualCron) return res.status(401).json({ error: 'Unauthorized' });

  let cfg;
  try {
    cfg = getMetricoolConfig();
  } catch (e: any) {
    return res.status(503).json({ error: 'Metricool not configured', detail: e.message });
  }

  const pool = getPool();
  const startedAt = Date.now();

  // 1. Pega clientes mapeados — ORDER BY garante ordem determinística pra rotation
  //    funcionar (cap MAX_TASKS_PER_RUN só processa 25 tasks/run; clientes seguintes
  //    rodam no próximo dia).
  const clients = await query<{ client_id: string; blog_id: string }>(
    `SELECT DISTINCT client_id, metadata->>'metricool_blog_id' AS blog_id
       FROM client_social_credentials
      WHERE metadata->>'metricool_blog_id' IS NOT NULL
        AND client_id IS NOT NULL
      ORDER BY client_id`,
  );

  if (clients.length === 0) {
    return res.status(200).json({
      ok: true,
      message: 'no metricool clients mapped',
      durationMs: Date.now() - startedAt,
    });
  }

  const now = new Date();
  const fromDate = new Date(now.getTime() - BACKFILL_DAYS * 86400_000);
  const from = fromDate.toISOString().slice(0, 19);
  const to = now.toISOString().slice(0, 19);

  let tasksRun = 0;
  let upserts = 0;
  let errors = 0;
  const events: any[] = [];

  outer: for (const c of clients) {
    for (const network of BACKFILL_NETWORKS) {
      if (tasksRun >= MAX_TASKS_PER_RUN) {
        events.push({ stop: true, reason: `cap ${MAX_TASKS_PER_RUN} tasks/run` });
        break outer;
      }
      // Delay entre tasks (skip antes da primeira) pra respeitar rate-limit
      if (tasksRun > 0) await new Promise((r) => setTimeout(r, TASK_DELAY_MS));
      tasksRun++;

      try {
        const [posts, reels, stories] = await Promise.all([
          getNetworkPosts(cfg, c.blog_id, network, from, to).catch(() => [] as any[]),
          network === 'instagram'
            ? getInstagramReels(cfg, c.blog_id, from, to).catch(() => [])
            : network === 'facebook'
              ? getFacebookReels(cfg, c.blog_id, from, to).catch(() => [])
              : Promise.resolve([] as any[]),
          network === 'instagram'
            ? getInstagramStories(cfg, c.blog_id, from, to).catch(() => [])
            : network === 'facebook'
              ? getFacebookStories(cfg, c.blog_id, from, to).catch(() => [])
              : Promise.resolve([] as any[]),
        ]);

        const tagged: Array<{ p: any; type?: string }> = [
          ...posts.map((p) => ({ p, type: undefined })),
          ...reels.map((p) => ({ p, type: 'REEL' })),
          ...stories.map((p) => ({ p, type: 'STORY' })),
        ];

        let perNetUpserts = 0;
        for (const { p, type: hintType } of tagged) {
          const postId = pickPostId(p, network);
          if (!postId) continue;
          const publishedAt = pickPublishedAt(p);

          await pool.query(
            `INSERT INTO metricool_posts
              (client_id, blog_id, network, post_id, post_type, url, caption,
               thumbnail_url, media_urls, published_at,
               likes, comments, shares, saves, reach, impressions, views,
               video_views, engagement_rate, raw_data,
               first_seen_at, last_synced_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10,
                     $11, $12, $13, $14, $15, $16, $17, $18, $19, $20::jsonb,
                     NOW(), NOW())
             ON CONFLICT (client_id, network, post_id) DO UPDATE SET
               post_type = COALESCE(EXCLUDED.post_type, metricool_posts.post_type),
               url = COALESCE(EXCLUDED.url, metricool_posts.url),
               caption = COALESCE(EXCLUDED.caption, metricool_posts.caption),
               thumbnail_url = COALESCE(EXCLUDED.thumbnail_url, metricool_posts.thumbnail_url),
               media_urls = EXCLUDED.media_urls,
               published_at = COALESCE(EXCLUDED.published_at, metricool_posts.published_at),
               likes = EXCLUDED.likes,
               comments = EXCLUDED.comments,
               shares = EXCLUDED.shares,
               saves = EXCLUDED.saves,
               reach = EXCLUDED.reach,
               impressions = EXCLUDED.impressions,
               views = EXCLUDED.views,
               video_views = EXCLUDED.video_views,
               engagement_rate = EXCLUDED.engagement_rate,
               raw_data = EXCLUDED.raw_data,
               last_synced_at = NOW()`,
            [
              c.client_id,
              c.blog_id,
              network,
              postId,
              pickPostType(p, hintType),
              (p.url as string) || (p.permalink as string) || null,
              pickCaption(p),
              pickThumbnail(p),
              JSON.stringify(pickMediaUrls(p)),
              publishedAt,
              metric(p, 'likes'),
              metric(p, 'comments'),
              metric(p, 'shares'),
              metric(p, 'saves'),
              metric(p, 'reach'),
              metric(p, 'impressions'),
              metric(p, 'views'),
              metric(p, 'videoViews'),
              engagementRate(p),
              JSON.stringify(p),
            ],
          );
          upserts++;
          perNetUpserts++;
        }

        events.push({
          client_id: c.client_id,
          network,
          posts: posts.length,
          reels: reels.length,
          stories: stories.length,
          upserts: perNetUpserts,
        });
      } catch (e: any) {
        errors++;
        events.push({ client_id: c.client_id, network, error: e.message || String(e) });
        console.warn(`[cron-metricool-backfill-posts] ${c.client_id}/${network}:`, e.message);
      }
    }
  }

  return res.status(200).json({
    ok: true,
    clients: clients.length,
    networks: BACKFILL_NETWORKS.length,
    backfillDays: BACKFILL_DAYS,
    tasksRun,
    upserts,
    errors,
    durationMs: Date.now() - startedAt,
    events: events.slice(0, 100),
  });
}
