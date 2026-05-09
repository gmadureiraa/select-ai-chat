// Cron diário 06:00 UTC: snapshot histórico de métricas Metricool por
// (client_id, network, snapshot_date). Cria a fonte de verdade local que
// sobrevive depois que a Metricool API esquece (>30-90d).
//
// Fluxo:
//   1. Lista pares (client_id, blog_id) com metricool_blog_id mapeado
//   2. Pra cada cliente, loop pelas redes suportadas:
//      - getNetworkPosts dos últimos 7d (resiliente a gaps de cron)
//      - Reels/Stories pro Instagram
//      - Agrega POSTS por dia (likes/comments/shares/reach/impressions/views/saves)
//      - Pega followers atual via getTimeline (1 ponto/dia)
//      - UPSERT (client_id, network, snapshot_date)
//   3. Idempotente — pode rodar várias vezes/dia sem duplicar
//
// Auth: x-vercel-cron OR `Authorization: Bearer ${CRON_SECRET}`.
// Limite defensivo (rate Metricool ~30 req/h): max 50 (client × redes) por execução.

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
  getTimeline,
  type MetricoolAnalyticsNetwork,
} from '../_lib/integrations/metricool.js';

const SNAPSHOT_NETWORKS: MetricoolAnalyticsNetwork[] = [
  'instagram',
  'facebook',
  // 'twitter' — analytics retorna só postsCount, snapshot diário ficaria zerado.
  //             followers de X ainda assim coletado se o cliente publicar (planning_items metrics).
  'linkedin',
  'tiktok',
  'threads',
  'youtube',
];

// network -> {metric, subject} pra timeline de followers (validado em metricool-summary.ts)
const FOLLOWER_TIMELINE: Record<string, { metric: string; subject?: string }> = {
  instagram: { metric: 'followers', subject: 'account' },
  facebook: { metric: 'pageFollows', subject: 'account' },
  youtube: { metric: 'totalSubscribers', subject: 'account' },
  threads: { metric: 'followers_count', subject: 'account' },
  linkedin: { metric: 'followers', subject: 'account' },
  tiktok: { metric: 'followers_count', subject: 'account' },
};

// Cap defensivo pro rate-limit Metricool (~30 req/h por chave).
// Cada task = até 4 calls (posts + reels + stories + timeline followers),
// com delay 2s entre tasks = max ~30 tasks/min, dentro do orçamento horário.
const MAX_TASKS_PER_RUN = 25; // (client × network)
const TASK_DELAY_MS = 2000;

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

interface DayAgg {
  posts_count: number;
  total_likes: number;
  total_comments: number;
  total_shares: number;
  total_reach: number;
  total_impressions: number;
  total_views: number;
  total_saves: number;
}

function emptyAgg(): DayAgg {
  return {
    posts_count: 0,
    total_likes: 0,
    total_comments: 0,
    total_shares: 0,
    total_reach: 0,
    total_impressions: 0,
    total_views: 0,
    total_saves: 0,
  };
}

function bucketByDay(posts: any[]): Map<string, DayAgg> {
  const buckets = new Map<string, DayAgg>();
  for (const p of posts) {
    const dateStr = (p.date || p.publishedAt || p.publishDate || p.timestamp || '') as string;
    if (!dateStr) continue;
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) continue;
    const key = localDateKey(d);
    const cur = buckets.get(key) ?? emptyAgg();
    cur.posts_count += 1;
    cur.total_likes += getMetric(p, 'likes');
    cur.total_comments += getMetric(p, 'comments');
    cur.total_shares += getMetric(p, 'shares');
    cur.total_reach += getMetric(p, 'reach');
    cur.total_impressions += getMetric(p, 'impressions');
    cur.total_views += getMetric(p, 'views');
    cur.total_saves += getMetric(p, 'saves');
    buckets.set(key, cur);
  }
  return buckets;
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

  // 1. Pega clientes com metricool_blog_id mapeado (1 row por client + blog_id único)
  //    ORDER BY garante ordem determinística pra rotation funcionar (cap silencioso).
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
  // 7d window: cobre gaps caso o cron pule um dia (Vercel cron resiliência)
  const fromDate = new Date(now.getTime() - 7 * 86400_000);
  const from = fromDate.toISOString().slice(0, 19);
  const to = now.toISOString().slice(0, 19);
  const todayKey = localDateKey(now);

  let tasksRun = 0;
  let upserts = 0;
  let errors = 0;
  const events: any[] = [];

  outer: for (const c of clients) {
    for (const network of SNAPSHOT_NETWORKS) {
      if (tasksRun >= MAX_TASKS_PER_RUN) {
        events.push({ stop: true, reason: `cap ${MAX_TASKS_PER_RUN} tasks/run`, remaining: clients.length });
        break outer;
      }
      // Delay entre tasks (skip antes da primeira) pra respeitar rate-limit
      if (tasksRun > 0) await new Promise((r) => setTimeout(r, TASK_DELAY_MS));
      tasksRun++;

      try {
        // Posts da rede + reels/stories (IG/FB) — flags rastreiam quem falhou
        // pra distinguir "API caiu" de "0 posts reais" no raw_data.
        const apiErrors: string[] = [];
        const [posts, reels, stories] = await Promise.all([
          getNetworkPosts(cfg, c.blog_id, network, from, to).catch((e) => {
            apiErrors.push(`posts:${e?.status ?? 'err'}`);
            return [] as any[];
          }),
          network === 'instagram'
            ? getInstagramReels(cfg, c.blog_id, from, to).catch((e) => {
                apiErrors.push(`reels:${e?.status ?? 'err'}`);
                return [];
              })
            : network === 'facebook'
              ? getFacebookReels(cfg, c.blog_id, from, to).catch((e) => {
                  apiErrors.push(`reels:${e?.status ?? 'err'}`);
                  return [];
                })
              : Promise.resolve([] as any[]),
          network === 'instagram'
            ? getInstagramStories(cfg, c.blog_id, from, to).catch((e) => {
                apiErrors.push(`stories:${e?.status ?? 'err'}`);
                return [];
              })
            : network === 'facebook'
              ? getFacebookStories(cfg, c.blog_id, from, to).catch((e) => {
                  apiErrors.push(`stories:${e?.status ?? 'err'}`);
                  return [];
                })
              : Promise.resolve([] as any[]),
        ]);

        const allContent = [...posts, ...reels, ...stories];
        const buckets = bucketByDay(allContent);

        // Followers timeline — 1 ponto por dia, mas usamos só o último (current)
        let followersToday: number | null = null;
        const tlCfg = FOLLOWER_TIMELINE[network];
        if (tlCfg) {
          try {
            const tl = (await getTimeline(
              cfg,
              c.blog_id,
              network,
              tlCfg.metric,
              from,
              to,
              undefined,            // timezone
              tlCfg.subject,        // 'account' — obrigatório pra Metricool aceitar
            )) as any[];
            if (Array.isArray(tl) && tl.length > 0) {
              const last = tl[tl.length - 1];
              followersToday = n(last?.value ?? last?.total ?? last?.followers, 0);
              if (followersToday === 0) followersToday = null;
            }
          } catch {
            // ignore — followers fica null
          }
        }

        // Garante que pelo menos HOJE tem snapshot (mesmo que sem posts)
        if (!buckets.has(todayKey)) buckets.set(todayKey, emptyAgg());

        for (const [dateKey, agg] of buckets) {
          const eng = agg.total_likes + agg.total_comments + agg.total_shares;
          const denom = Math.max(agg.total_reach, agg.total_impressions);
          const avgEng = denom > 0 ? Number(((eng / denom) * 100).toFixed(3)) : 0;

          // Followers só guardamos no snapshot HOJE (timeline retorna ~1 ponto/dia
          // mas Metricool não dá histórico real — mantemos o atual em cada dia
          // pra não ficar null em backfills futuros)
          const followersForDay = dateKey === todayKey ? followersToday : null;

          await pool.query(
            `INSERT INTO metricool_daily_snapshots
              (client_id, blog_id, network, snapshot_date, followers,
               posts_count, total_likes, total_comments, total_shares,
               total_reach, total_impressions, total_views, total_saves,
               avg_engagement_rate, raw_data)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb)
            ON CONFLICT (client_id, network, snapshot_date)
            DO UPDATE SET
              followers = COALESCE(EXCLUDED.followers, metricool_daily_snapshots.followers),
              posts_count = EXCLUDED.posts_count,
              total_likes = EXCLUDED.total_likes,
              total_comments = EXCLUDED.total_comments,
              total_shares = EXCLUDED.total_shares,
              total_reach = EXCLUDED.total_reach,
              total_impressions = EXCLUDED.total_impressions,
              total_views = EXCLUDED.total_views,
              total_saves = EXCLUDED.total_saves,
              avg_engagement_rate = EXCLUDED.avg_engagement_rate,
              raw_data = EXCLUDED.raw_data`,
            [
              c.client_id,
              c.blog_id,
              network,
              dateKey,
              followersForDay,
              agg.posts_count,
              agg.total_likes,
              agg.total_comments,
              agg.total_shares,
              agg.total_reach,
              agg.total_impressions,
              agg.total_views,
              agg.total_saves,
              avgEng,
              JSON.stringify({
                source: 'cron-metricool-snapshot',
                fetched_at: now.toISOString(),
                window_from: from,
                window_to: to,
                api_failed: apiErrors.length > 0 ? apiErrors : undefined,
              }),
            ],
          );
          upserts++;
        }

        events.push({
          client_id: c.client_id,
          network,
          days: buckets.size,
          followers: followersToday,
        });
      } catch (e: any) {
        errors++;
        events.push({ client_id: c.client_id, network, error: e.message || String(e) });
        console.warn(`[cron-metricool-snapshot] ${c.client_id}/${network}:`, e.message);
      }
    }
  }

  return res.status(200).json({
    ok: true,
    clients: clients.length,
    networks: SNAPSHOT_NETWORKS.length,
    tasksRun,
    upserts,
    errors,
    durationMs: Date.now() - startedAt,
    events: events.slice(0, 100), // truncate pra resposta não explodir
  });
}
