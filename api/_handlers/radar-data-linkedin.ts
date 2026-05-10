// GET /api/radar-data-linkedin?niche=marketing&hours=168&limit=20&sort=top
//
// Lista posts virais do LinkedIn da tabela `viral_linkedin_posts`
// (populada por /api/cron-scrape-linkedin). Default: últimos 7 dias (168h)
// ordenados por engajamento (reactions + comments + shares).
//
// Schema da tabela: ver api/_handlers/cron-scrape-linkedin.ts

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyCors, handlePreflight } from "../_lib/cors.js";
import { tryAuth } from "../_lib/auth.js";
import { query } from "../_lib/db.js";

interface LinkedInPostRow {
  post_id: string;
  url: string;
  author_handle: string | null;
  author_name: string | null;
  author_headline: string | null;
  author_followers: number | null;
  text_content: string | null;
  media_urls: string[] | null;
  post_type: string | null;
  reactions: number | null;
  likes: number;
  comments: number;
  shares: number;
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
  // LinkedIn tem ciclo de viralização ainda mais lento (B2B). 7 dias default.
  const hours = hoursParam
    ? Math.min(720, Math.max(1, Number(hoursParam) || 168))
    : 168;

  try {
    const hasTable = await query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema='public' AND table_name='viral_linkedin_posts'
       ) AS exists`,
    );
    if (!hasTable[0]?.exists) {
      return res.status(200).json({ posts: [] });
    }

    const baseSelect = `
      SELECT post_id, url, author_handle, author_name, author_headline,
             author_followers, text_content, media_urls, post_type,
             reactions, likes, comments, shares, niche,
             posted_at::text, scraped_at::text
        FROM viral_linkedin_posts
       WHERE posted_at >= NOW() - ($1 || ' hours')::interval`;

    // Engajamento total: reactions é o número agregado de "curtir/celebrar/etc".
    // Comments contam mais (sinal de discussão real) e shares amplificam alcance.
    const orderBy =
      sort === "top"
        ? `ORDER BY (
             COALESCE(reactions, likes, 0)
             + COALESCE(comments,0)*2
             + COALESCE(shares,0)*3
           ) DESC NULLS LAST`
        : "ORDER BY posted_at DESC NULLS LAST";

    const rows = niche
      ? await query<LinkedInPostRow>(
          `${baseSelect}
             AND niche = $2
           ${orderBy}
           LIMIT $3`,
          [hours, niche, limit],
        )
      : await query<LinkedInPostRow>(
          `${baseSelect}
           ${orderBy}
           LIMIT $2`,
          [hours, limit],
        );

    return res.status(200).json({ posts: rows });
  } catch (err: any) {
    console.error("[radar-data-linkedin] failed:", err);
    return res.status(500).json({
      error: process.env.NODE_ENV === "production" ? "Falha" : String(err),
    });
  }
}
