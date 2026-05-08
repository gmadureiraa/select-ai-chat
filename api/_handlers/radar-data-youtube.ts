// GET /api/radar-data-youtube?niche=marketing&days=7&limit=60
//
// Lista vídeos recentes da tabela `videos` (populada por cron RSS).
// Filtro por nicho via catálogo curado (handles inline aqui pra evitar
// dependência do módulo React do front).
// Ported de radar-viral/app/api/data/videos/route.ts.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyCors, handlePreflight } from "../_lib/cors.js";
import { tryAuth } from "../_lib/auth.js";
import { query } from "../_lib/db.js";

interface VideoRow {
  video_id: string;
  channel_id: string;
  channel_name: string;
  channel_handle: string | null;
  country: string | null;
  category: string | null;
  title: string;
  thumbnail_url: string;
  published_at: string;
  link: string;
  first_seen_at: string;
  last_seen_at: string;
}

// Handles curados por nicho — espelha lib/sources-curated.ts (lowercased).
// Mantenha sincronizado quando atualizar a curadoria.
const CURATED_YT_HANDLES: Record<string, string[]> = {
  crypto: [
    "@coinbureau", "@bankless", "@intothecryptoverse", "@altcoindaily",
    "@thecryptolark", "@cryptobanter", "@digitalassetnews", "@bitboycrypto",
    "@andreijikh", "@grahamstephan", "@anthonypompliano", "@whiteboardcrypto",
    "@augustobackes",
  ],
  marketing: [
    "@alexhormozi", "@garyvee", "@neilpatel", "@ahrefscom", "@incomeschool",
    "@fellipetoledo", "@colinandsamir",
  ],
  ai: [
    "@matthew_berman", "@aijasonz", "@aiexplained-official", "@wesroth",
    "@fireship", "@lexfridman", "@dwarkeshpatel", "@allaboutai",
    "@samwitteveenai", "@mreflow",
  ],
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res);

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  await tryAuth(req);

  const niche = req.query.niche as string | undefined;
  const daysRaw = Number(req.query.days ?? 7);
  const hoursParam = req.query.hours as string | undefined;
  const hours = hoursParam ? Math.min(720, Math.max(1, Number(hoursParam) || 0)) : null;
  const limitRaw = Number(req.query.limit ?? 60);
  const days = Math.min(60, Math.max(1, Number.isFinite(daysRaw) ? daysRaw : 7));
  const limit = Math.min(120, Math.max(3, Number.isFinite(limitRaw) ? limitRaw : 60));
  const intervalUnit = hours ? "hours" : "days";
  const intervalQty = hours ?? days;

  let handleFilter: string[] | null = null;
  if (niche) {
    const handles = CURATED_YT_HANDLES[niche];
    if (handles) handleFilter = handles.map((h) => h.toLowerCase());
  }

  try {
    // Tabela `videos` é específica do Radar Viral v1 e ainda não foi migrada
    // pra KAI. Se não existir, retorna [] sem crashear.
    const hasVideos = await query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema='public' AND table_name='videos'
       ) AS exists`,
    );
    if (!hasVideos[0]?.exists) {
      return res.status(200).json({ videos: [] });
    }

    const baseSelect = `
      SELECT video_id, channel_id, channel_name, channel_handle, country,
             category, title, thumbnail_url, published_at::text, link,
             first_seen_at::text, last_seen_at::text
        FROM videos
       WHERE published_at >= NOW() - ($1 || ' ' || $2)::interval`;

    const rows = handleFilter
      ? await query<VideoRow>(
          `${baseSelect}
             AND lower(channel_handle) = ANY($3)
           ORDER BY published_at DESC NULLS LAST
           LIMIT $4`,
          [intervalQty, intervalUnit, handleFilter, limit],
        )
      : await query<VideoRow>(
          `${baseSelect}
           ORDER BY published_at DESC NULLS LAST
           LIMIT $3`,
          [intervalQty, intervalUnit, limit],
        );

    return res.status(200).json({ videos: rows });
  } catch (err: any) {
    console.error("[radar-data-youtube] failed:", err);
    return res.status(500).json({
      error: process.env.NODE_ENV === "production" ? "Falha" : String(err),
    });
  }
}
