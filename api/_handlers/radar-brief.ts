// GET /api/radar-brief?niche=marketing — retorna o brief diário mais recente +
// o brief anterior (pra loop closure "ontem você viu, hoje virou").
//
// Reusa a tabela `daily_briefs` (mesmo Neon DB).
// Ported de radar-viral/app/api/brief/route.ts.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyCors, handlePreflight } from "../_lib/cors.js";
import { tryAuth } from "../_lib/auth.js";
import { query } from "../_lib/db.js";
import { assertClientAccess } from "../_lib/access.js";

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
  const authedUser = await tryAuth(req);

  const niche = (req.query.niche as string) || "marketing";
  const clientId = (req.query.clientId as string) || null;

  // Se passou clientId E user logado, garantir acesso (defesa IDOR).
  // Brief sem clientId é global (free), permitido pra qualquer um.
  if (authedUser && clientId) {
    await assertClientAccess(authedUser.id, clientId);
  }

  try {
    // Status canônico do brief é 'done' (writer trigger checa 'done').
    // Aceita também 'ready'/'completed' por retrocompat com cron-generate-daily-brief
    // antigo, e suporta filtro opcional por clientId quando o KAI passa o cliente atual.
    // 1. Tenta primeiro com clientId + niche exato (ideal: cliente tem brief
    //    custom no nicho selecionado). 2. Fallback: clientId sem filtro de niche.
    //    3. Último fallback: brief global mais recente desse niche.
    const baseSelect = `SELECT id::text, niche, brief_date::text, narratives, hot_topics,
              carousel_ideas, cross_pollination, model_used, cost_usd::text
         FROM viral_radar_briefs
        WHERE status IN ('done', 'ready', 'completed')`;

    let rows: BriefRow[] = [];
    if (clientId) {
      // Tentativa 1: clientId + niche
      rows = await query<BriefRow>(
        `${baseSelect}
          AND client_id = $1
          AND niche = $2
        ORDER BY brief_date DESC, created_at DESC
        LIMIT 2`,
        [clientId, niche],
      );
      if (rows.length === 0) {
        // Tentativa 2: clientId sem niche (cron pode ter gravado niche='general')
        rows = await query<BriefRow>(
          `${baseSelect}
            AND client_id = $1
          ORDER BY brief_date DESC, created_at DESC
          LIMIT 2`,
          [clientId],
        );
      }
    }
    if (rows.length === 0) {
      // Tentativa 3: brief global mais recente desse niche (sem cliente)
      rows = await query<BriefRow>(
        `${baseSelect}
          AND niche = $1
        ORDER BY brief_date DESC, created_at DESC
        LIMIT 2`,
        [niche],
      );
    }

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
