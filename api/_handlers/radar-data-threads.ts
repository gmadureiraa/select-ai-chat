// GET /api/radar-data-threads?niche=marketing&hours=168&limit=20&sort=top
//
// Lista posts virais do Threads da tabela `viral_threads_posts`
// (populada por /api/cron-scrape-threads). Default: últimos 7 dias (168h)
// ordenados por engajamento (likes + reposts + replies).
//
// Schema da tabela: ver api/_handlers/cron-scrape-threads.ts

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyCors, handlePreflight } from "../_lib/cors.js";
import { tryAuth } from "../_lib/auth.js";
import { query } from "../_lib/db.js";

interface ThreadsPostRow {
  url: string;
  author_handle: string;
  author_followers: number | null;
  text_content: string | null;
  media_urls: string[] | null;
  views: number | null;
  likes: number;
  reposts: number;
  replies: number;
  niche: string | null;
  posted_at: string | null;
  scraped_at: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res);

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  await tryAuth(req);

  const niche = (req.query.niche as string) || null;
  const limitRaw = Number(req.query.limit ?? 20);
  const limit = Math.min(60, Math.max(3, Number.isFinite(limitRaw) ? limitRaw : 20));
  const sort = (req.query.sort as string) === "recent" ? "recent" : "top";
  const hoursParam = req.query.hours as string | undefined;
  // Default: últimos 7 dias (168h). Threads tem ciclo viral mais longo que IG.
  const hours = hoursParam
    ? Math.min(720, Math.max(1, Number(hoursParam) || 168))
    : 168;

  // Defensive: se a tabela não existir (env de dev sem migração), retorna []
  // ao invés de crashear — mesmo padrão de radar-data-instagram.
  try {
    const hasTable = await query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema='public' AND table_name='viral_threads_posts'
       ) AS exists`,
    );
    if (!hasTable[0]?.exists) {
      return res.status(200).json({ posts: [] });
    }

    const baseSelect = `
      SELECT url, author_handle, author_followers, text_content, media_urls,
             views, likes, reposts, replies, niche,
             posted_at::text, scraped_at::text
        FROM viral_threads_posts
       WHERE posted_at >= NOW() - ($1 || ' hours')::interval`;

    const orderBy =
      sort === "top"
        ? "ORDER BY (COALESCE(likes,0) + COALESCE(reposts,0) + COALESCE(replies,0)) DESC NULLS LAST"
        : "ORDER BY posted_at DESC NULLS LAST";

    const rows = niche
      ? await query<ThreadsPostRow>(
          `${baseSelect}
             AND niche = $2
           ${orderBy}
           LIMIT $3`,
          [hours, niche, limit],
        )
      : await query<ThreadsPostRow>(
          `${baseSelect}
           ${orderBy}
           LIMIT $2`,
          [hours, limit],
        );

    return res.status(200).json({ posts: rows });
  } catch (err: any) {
    console.error("[radar-data-threads] failed:", err);
    return res.status(500).json({
      error: process.env.NODE_ENV === "production" ? "Falha" : String(err),
    });
  }
}
