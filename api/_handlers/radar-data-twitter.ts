// GET /api/radar-data-twitter?niche=marketing&hours=168&limit=20&sort=top
//
// Lista posts virais do X (Twitter) da tabela `viral_twitter_posts`
// (populada por /api/cron-scrape-twitter). Default: últimos 7 dias (168h)
// ordenados por engajamento (likes + retweets + replies + bookmarks).
//
// Schema da tabela: ver api/_handlers/cron-scrape-twitter.ts

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyCors, handlePreflight } from "../_lib/cors.js";
import { tryAuth } from "../_lib/auth.js";
import { query } from "../_lib/db.js";

interface TwitterPostRow {
  tweet_id: string;
  url: string;
  author_handle: string;
  author_name: string | null;
  author_followers: number | null;
  author_verified: boolean | null;
  text_content: string | null;
  media_urls: string[] | null;
  is_thread: boolean;
  thread_tweets: unknown;
  views: number;
  likes: number;
  retweets: number;
  replies: number;
  bookmarks: number;
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
  const hours = hoursParam
    ? Math.min(720, Math.max(1, Number(hoursParam) || 168))
    : 168;

  try {
    const hasTable = await query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema='public' AND table_name='viral_twitter_posts'
       ) AS exists`,
    );
    if (!hasTable[0]?.exists) {
      return res.status(200).json({ posts: [] });
    }

    const baseSelect = `
      SELECT tweet_id, url, author_handle, author_name, author_followers,
             author_verified, text_content, media_urls,
             is_thread, thread_tweets,
             views, likes, retweets, replies, bookmarks,
             niche, posted_at::text, scraped_at::text
        FROM viral_twitter_posts
       WHERE posted_at >= NOW() - ($1 || ' hours')::interval`;

    // Engajamento ponderado (likes + retweets*2 + replies + bookmarks)
    // — retweet vale mais porque é amplificação real do alcance.
    const orderBy =
      sort === "top"
        ? `ORDER BY (
             COALESCE(likes,0)
             + COALESCE(retweets,0)*2
             + COALESCE(replies,0)
             + COALESCE(bookmarks,0)
           ) DESC NULLS LAST`
        : "ORDER BY posted_at DESC NULLS LAST";

    const rows = niche
      ? await query<TwitterPostRow>(
          `${baseSelect}
             AND niche = $2
           ${orderBy}
           LIMIT $3`,
          [hours, niche, limit],
        )
      : await query<TwitterPostRow>(
          `${baseSelect}
           ${orderBy}
           LIMIT $2`,
          [hours, limit],
        );

    return res.status(200).json({ posts: rows });
  } catch (err: any) {
    console.error("[radar-data-twitter] failed:", err);
    return res.status(500).json({
      error: process.env.NODE_ENV === "production" ? "Falha" : String(err),
    });
  }
}
