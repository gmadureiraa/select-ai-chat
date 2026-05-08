// GET /api/radar-admin-stats — payload do admin Radar Viral.
// Auth: requer email admin.
//
// Ported de radar-viral/app/api/admin/stats/route.ts.
//
// IMPORTANTE: muitas tabelas do Radar v1 (`saved_items`, `cron_run_log`,
// `tracked_sources`, `instagram_scrape_runs`, `ai_usage_log`,
// `newsletter_articles`, `user_profiles`, `user_subscriptions_radar`) ainda
// não foram migradas pra KAI. Cada query roda isolada — se uma falhar o
// campo cai pra zero/empty. Tabelas que existem em KAI:
//   viral_news_articles, viral_radar_briefs, viral_tiktok_posts,
//   viral_threads_posts, viral_twitter_posts, viral_linkedin_posts,
//   viral_tracked_sources, instagram_posts (KAI client-scoped), videos (TBD).

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyCors, handlePreflight } from "../_lib/cors.js";
import { verifyAuth } from "../_lib/auth.js";
import { query } from "../_lib/db.js";

const ADMIN_EMAILS = new Set([
  "gf.madureira@hotmail.com",
  "gf.madureiraa@gmail.com",
]);

interface NumRow { n: number }
interface FloatRow { n: number }

async function safeCount(sql: string): Promise<number> {
  try {
    const rows = await query<NumRow>(sql);
    return rows[0]?.n ?? 0;
  } catch {
    return 0;
  }
}

async function safeFloat(sql: string): Promise<number> {
  try {
    const rows = await query<FloatRow>(sql);
    return rows[0]?.n ?? 0;
  } catch {
    return 0;
  }
}

async function safeRows<T>(sql: string): Promise<T[]> {
  try {
    return await query<T>(sql);
  } catch {
    return [];
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res);

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Auth: precisa email admin
  let user;
  try {
    user = await verifyAuth(req);
  } catch (e: any) {
    return res.status(401).json({ error: e.message || "Authentication required" });
  }
  if (!user.email || !ADMIN_EMAILS.has(user.email.toLowerCase().trim())) {
    return res.status(403).json({ error: "Acesso restrito — admin apenas." });
  }

  try {
    // ── Summary ─────────────────────────────────────────────────────
    const [
      totalUsers,
      totalProfiles,
      activeSubs,
      totalIg,
      totalYt,
      totalNews,
      totalNl,
      ig30d,
      videos30d,
      news30d,
      newsletters30d,
      briefs30d,
      costGemini30d,
      costApify30d,
      cronRuns30d,
    ] = await Promise.all([
      safeCount(`SELECT COUNT(DISTINCT owner_id)::int AS n FROM workspaces`),
      safeCount(`SELECT COUNT(*)::int AS n FROM workspace_members`),
      safeCount(
        `SELECT COUNT(*)::int AS n FROM workspace_subscriptions ws
          JOIN subscription_plans sp ON sp.id = ws.plan_id
          WHERE ws.status::text = 'active' AND sp.type::text IN ('pro','enterprise','starter')`,
      ),
      safeCount(`SELECT COUNT(*)::int AS n FROM instagram_posts`),
      safeCount(`SELECT COUNT(*)::int AS n FROM videos`),
      safeCount(`SELECT COUNT(*)::int AS n FROM viral_news_articles`),
      safeCount(`SELECT COUNT(*)::int AS n FROM newsletter_articles`),
      safeCount(`SELECT COUNT(*)::int AS n FROM instagram_posts WHERE scraped_at >= NOW() - INTERVAL '30 days'`),
      safeCount(`SELECT COUNT(*)::int AS n FROM videos WHERE first_seen_at >= NOW() - INTERVAL '30 days'`),
      safeCount(`SELECT COUNT(*)::int AS n FROM viral_news_articles WHERE scraped_at >= NOW() - INTERVAL '30 days'`),
      safeCount(`SELECT COUNT(*)::int AS n FROM newsletter_articles WHERE fetched_at >= NOW() - INTERVAL '30 days'`),
      safeCount(`SELECT COUNT(*)::int AS n FROM viral_radar_briefs WHERE created_at >= NOW() - INTERVAL '30 days'`),
      safeFloat(`SELECT COALESCE(SUM(cost_usd), 0)::float AS n FROM ai_usage_log WHERE created_at >= NOW() - INTERVAL '30 days'`),
      safeFloat(`SELECT COALESCE(SUM(cost_usd), 0)::float AS n FROM instagram_scrape_runs WHERE ran_at >= NOW() - INTERVAL '30 days'`),
      safeCount(`SELECT COUNT(*)::int AS n FROM cron_run_log WHERE ran_at >= NOW() - INTERVAL '30 days'`),
    ]);

    const totalCost30d = costGemini30d + costApify30d;

    // ── Plan counts ─────────────────────────────────────────────────
    const planCounts: Record<string, number> = { free: 0, pro: 0, max: 0 };
    try {
      const rows = await query<{ plan: string; n: number }>(
        `SELECT sp.type::text AS plan, COUNT(*)::int AS n
           FROM workspace_subscriptions ws
           JOIN subscription_plans sp ON sp.id = ws.plan_id
          WHERE ws.status::text = 'active'
          GROUP BY sp.type`,
      );
      for (const r of rows) planCounts[r.plan] = r.n;
    } catch {
      // ignore
    }

    // ── Daily series 30d ────────────────────────────────────────────
    const dailySeries = await safeRows<{
      day: string;
      ig_posts: number;
      yt_videos: number;
      news: number;
      newsletters: number;
      briefs: number;
      cost: number;
    }>(`
      WITH days AS (
        SELECT (CURRENT_DATE - i)::date AS day
          FROM generate_series(0, 29) AS i
      ),
      news AS (
        SELECT date_trunc('day', scraped_at)::date AS day, COUNT(*)::int AS n
          FROM viral_news_articles
         WHERE scraped_at >= CURRENT_DATE - INTERVAL '30 days'
         GROUP BY 1
      ),
      briefs AS (
        SELECT date_trunc('day', created_at)::date AS day, COUNT(*)::int AS n,
               COALESCE(SUM(cost_usd), 0)::float AS c
          FROM viral_radar_briefs
         WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
         GROUP BY 1
      )
      SELECT d.day::text AS day,
             0::int AS ig_posts,
             0::int AS yt_videos,
             COALESCE(news.n, 0)::int AS news,
             0::int AS newsletters,
             COALESCE(briefs.n, 0)::int AS briefs,
             COALESCE(briefs.c, 0)::float AS cost
        FROM days d
        LEFT JOIN news ON news.day = d.day
        LEFT JOIN briefs ON briefs.day = d.day
       ORDER BY d.day ASC
    `);

    // ── Sources breakdown ──────────────────────────────────────────
    const sources = await safeRows<{
      platform: string;
      niche: string;
      total: number;
      active: number;
      per_user: number;
      global: number;
    }>(`
      SELECT source_type AS platform,
             COALESCE(niche, 'unknown') AS niche,
             COUNT(*)::int AS total,
             SUM(CASE WHEN is_active THEN 1 ELSE 0 END)::int AS active,
             SUM(CASE WHEN client_id IS NOT NULL OR workspace_id IS NOT NULL THEN 1 ELSE 0 END)::int AS per_user,
             SUM(CASE WHEN client_id IS NULL AND workspace_id IS NULL THEN 1 ELSE 0 END)::int AS global
        FROM viral_tracked_sources
       GROUP BY source_type, niche
       ORDER BY source_type, niche
    `);

    // ── Top users (top 50) — usa workspace_members (KAI) ──────────
    const users = await safeRows<{
      user_id: string;
      email: string | null;
      display_name: string | null;
      role: string | null;
      status: string | null;
      last_login_at: string | null;
      niche: string | null;
      saved_count: number;
      plan: string | null;
      sub_status: string | null;
      current_period_end: string | null;
      stripe_customer_id: string | null;
    }>(`
      SELECT w.owner_id::text AS user_id,
             NULL::text AS email,
             w.name AS display_name,
             'owner'::text AS role,
             'active'::text AS status,
             NULL::text AS last_login_at,
             NULL::text AS niche,
             0::int AS saved_count,
             sp.type::text AS plan,
             ws.status::text AS sub_status,
             ws.current_period_end::text,
             ws.stripe_customer_id
        FROM workspaces w
        LEFT JOIN workspace_subscriptions ws ON ws.workspace_id = w.id
        LEFT JOIN subscription_plans sp ON sp.id = ws.plan_id
       ORDER BY w.created_at DESC NULLS LAST
       LIMIT 50
    `);

    // ── Subscriptions Pro+ ─────────────────────────────────────────
    const subscriptionsList = await safeRows<{
      user_id: string;
      email: string | null;
      plan: string;
      status: string;
      current_period_end: string | null;
      cancel_at_period_end: boolean;
      created_at: string;
    }>(`
      SELECT w.owner_id::text AS user_id,
             NULL::text AS email,
             sp.type::text AS plan,
             ws.status::text AS status,
             ws.current_period_end::text,
             ws.cancel_at_period_end,
             ws.updated_at::text AS created_at
        FROM workspace_subscriptions ws
        JOIN workspaces w ON w.id = ws.workspace_id
        JOIN subscription_plans sp ON sp.id = ws.plan_id
       WHERE sp.type::text IN ('pro','enterprise','starter')
       ORDER BY ws.updated_at DESC
       LIMIT 50
    `);

    const activeSubsList = subscriptionsList.filter((s) => s.status === "active");

    // ── Cron runs ──────────────────────────────────────────────────
    const cronRuns = await safeRows<{
      id: number;
      user_id: string | null;
      cron_type: string;
      niche_id: number | null;
      posts_added: number | null;
      status: string;
      error_msg: string | null;
      ran_at: string;
    }>(`
      SELECT id, user_id, cron_type, niche_id, posts_added, status,
             error_msg, ran_at::text
        FROM cron_run_log
       ORDER BY ran_at DESC
       LIMIT 50
    `);

    return res.status(200).json({
      summary: {
        totalUsers,
        totalProfiles,
        activeSubs,
        totalIgPosts: totalIg,
        totalVideos: totalYt,
        totalNews,
        totalNewsletters: totalNl,
        ig30d,
        videos30d,
        news30d,
        newsletters30d,
        briefs30d,
        costGemini30d,
        costApify30d,
        totalCost30d,
        cronRuns30d,
      },
      planCounts,
      dailySeries,
      sources,
      users,
      subscriptions: {
        activeCount: activeSubsList.length,
        mrrBrl: 0,
        mrrUsd: 0,
        list: subscriptionsList,
      },
      cronRuns,
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[radar-admin-stats] failed:", err);
    return res.status(500).json({
      error: process.env.NODE_ENV === "production" ? "Falha" : String(err),
    });
  }
}
