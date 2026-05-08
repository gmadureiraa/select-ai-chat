// GET /api/radar-brief?niche=marketing — retorna o brief diário mais recente +
// o brief anterior (pra loop closure "ontem você viu, hoje virou").
//
// Reusa a tabela `daily_briefs` (mesmo Neon DB).
// Ported de radar-viral/app/api/brief/route.ts.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyCors, handlePreflight } from "../_lib/cors.js";
import { tryAuth } from "../_lib/auth.js";
import { query } from "../_lib/db.js";

interface BriefRow {
  id: string;
  niche: string;
  brief_date: string;
  narratives: unknown;
  hot_topics: unknown;
  carousel_ideas: unknown;
  cross_pollination: unknown;
  model_used: string | null;
  cost_usd: string | null;
}

function shape(r: BriefRow) {
  return {
    brief_date: r.brief_date,
    narratives: r.narratives,
    hot_topics: r.hot_topics,
    carousel_ideas: r.carousel_ideas,
    cross_pollination: r.cross_pollination,
    model_used: r.model_used,
    cost_usd: r.cost_usd ? Number(r.cost_usd) : null,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res);

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Auth opcional (free user também vê briefs globais)
  await tryAuth(req);

  const niche = (req.query.niche as string) || "marketing";

  try {
    // KAI usa viral_radar_briefs (não daily_briefs)
    const rows = await query<BriefRow>(
      `SELECT id::text, niche, brief_date::text, narratives, hot_topics,
              carousel_ideas, cross_pollination, model_used, cost_usd::text
         FROM viral_radar_briefs
        WHERE niche = $1
          AND status = 'completed'
        ORDER BY brief_date DESC, created_at DESC
        LIMIT 2`,
      [niche],
    );

    if (rows.length === 0) {
      return res.status(200).json({ brief: null, previous: null });
    }
    return res.status(200).json({
      brief: shape(rows[0]),
      previous: rows[1] ? shape(rows[1]) : null,
    });
  } catch (err: any) {
    console.error("[radar-brief] failed:", err);
    return res.status(500).json({
      error: process.env.NODE_ENV === "production" ? "Falha" : String(err),
    });
  }
}
