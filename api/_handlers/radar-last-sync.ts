// GET /api/radar-last-sync — timestamps das últimas ingestões.
//
// Lê apenas MAX(...) — barato. Usado pelo Dashboard pra mostrar
// "atualizado há X" e dar confiança que o radar tá fresco.
// Ported de radar-viral/app/api/last-sync/route.ts.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyCors, handlePreflight } from "../_lib/cors.js";
import { query } from "../_lib/db.js";

interface MaxRow {
  ts: string | null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res);

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Tabelas existentes em KAI: viral_news_articles, instagram_posts (KAI-scoped),
  // viral_radar_briefs. Vídeos do YT ainda não tem tabela própria (TBD).
  // Cada query roda isolada — se uma falhar, os outros campos continuam preenchidos.
  const safeMax = async (sql: string): Promise<string | null> => {
    try {
      const rows = await query<MaxRow>(sql);
      return rows[0]?.ts ?? null;
    } catch (err) {
      console.warn("[radar-last-sync] query failed (table missing?):", String(err).slice(0, 200));
      return null;
    }
  };

  try {
    const [news, ig, videos, brief] = await Promise.all([
      safeMax(`SELECT MAX(scraped_at)::text AS ts FROM viral_news_articles`),
      safeMax(`SELECT MAX(scraped_at)::text AS ts FROM instagram_posts`),
      safeMax(`SELECT MAX(last_seen_at)::text AS ts FROM videos`),
      safeMax(`SELECT MAX(created_at)::text AS ts FROM viral_radar_briefs`),
    ]);

    const lastSync = {
      news,
      instagram: ig,
      youtube: videos,
      brief,
    };

    const candidates = [lastSync.news, lastSync.instagram, lastSync.youtube]
      .filter((x): x is string => Boolean(x))
      .sort();
    const latest = candidates.length > 0 ? candidates[candidates.length - 1] : null;

    return res.status(200).json({ ...lastSync, latest });
  } catch (err: any) {
    console.error("[radar-last-sync] failed:", err);
    return res.status(500).json({
      error: process.env.NODE_ENV === "production" ? "Falha" : String(err),
    });
  }
}
