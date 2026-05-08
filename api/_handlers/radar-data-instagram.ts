// GET /api/radar-data-instagram?niche=marketing&limit=60&hours=&sort=recent|top
//
// Lista posts do IG do nicho. Tabela `instagram_posts` populada por
// /api/cron-scrape-instagram.
// Ported de radar-viral/app/api/data/instagram/posts/route.ts.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyCors, handlePreflight } from "../_lib/cors.js";
import { tryAuth } from "../_lib/auth.js";
import { query } from "../_lib/db.js";

interface InstagramPostRow {
  shortcode: string;
  account_handle: string;
  niche: string;
  type: string | null;
  caption: string | null;
  display_url: string | null;
  child_urls: string[] | null;
  video_url: string | null;
  likes: number;
  comments: number;
  views: number;
  hashtags: string[] | null;
  mentions: string[] | null;
  posted_at: string | null;
  scraped_at: string;
  transcribed_at?: string | null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res);

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  await tryAuth(req);

  const niche = (req.query.niche as string) || "marketing";
  const limitRaw = Number(req.query.limit ?? 60);
  const limit = Math.min(120, Math.max(3, Number.isFinite(limitRaw) ? limitRaw : 60));
  const sort = (req.query.sort as string) === "top" ? "top" : "recent";
  const hoursParam = req.query.hours as string | undefined;
  const hours = hoursParam ? Math.min(720, Math.max(1, Number(hoursParam) || 0)) : null;

  // KAI's instagram_posts é client-scoped (schema diferente do radar:
  // não tem shortcode/account_handle/niche). Pra evitar crash quando o
  // schema do radar não estiver migrado, faz introspection rápida e cai
  // em [] se faltar coluna.
  try {
    const hasNiche = await query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema='public'
           AND table_name='instagram_posts'
           AND column_name='niche'
       ) AS exists`,
    );
    if (!hasNiche[0]?.exists) {
      return res.status(200).json({ posts: [] });
    }

    let rows: InstagramPostRow[];
    const baseSelect = `
      SELECT shortcode, account_handle, niche, type, caption, display_url,
             child_urls, video_url, likes, comments, views,
             hashtags, mentions, posted_at::text, scraped_at::text,
             transcribed_at::text
        FROM instagram_posts
       WHERE niche = $1`;

    if (sort === "top" && hours) {
      rows = await query<InstagramPostRow>(
        `${baseSelect}
           AND posted_at >= NOW() - ($2 || ' hours')::interval
         ORDER BY likes DESC NULLS LAST
         LIMIT $3`,
        [niche, hours, limit],
      );
    } else if (sort === "top") {
      rows = await query<InstagramPostRow>(
        `${baseSelect}
         ORDER BY likes DESC NULLS LAST
         LIMIT $2`,
        [niche, limit],
      );
    } else if (hours) {
      rows = await query<InstagramPostRow>(
        `${baseSelect}
           AND posted_at >= NOW() - ($2 || ' hours')::interval
         ORDER BY posted_at DESC NULLS LAST
         LIMIT $3`,
        [niche, hours, limit],
      );
    } else {
      rows = await query<InstagramPostRow>(
        `${baseSelect}
         ORDER BY posted_at DESC NULLS LAST
         LIMIT $2`,
        [niche, limit],
      );
    }
    return res.status(200).json({ posts: rows });
  } catch (err: any) {
    console.error("[radar-data-instagram] failed:", err);
    return res.status(500).json({
      error: process.env.NODE_ENV === "production" ? "Falha" : String(err),
    });
  }
}
