// GET /api/data/newsletters?niche=...&limit=100
// Retorna newsletters curadas pra exibir na view Newsletters do Radar.
//
// Fallback: se tabela radar_newsletters_curated estiver vazia pro nicho,
// puxa as últimas N entries de viral_news_articles com category=newsletter
// como reuso oportunista.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';
import { tryAuth } from '../_lib/auth.js';
import { getPool } from '../_lib/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res, req);

  const auth = await tryAuth(req).catch(() => null);
  if (!auth) return jsonError(res, 401, 'Authentication required');

  if ((req.method ?? 'GET').toUpperCase() !== 'GET') {
    return jsonError(res, 405, 'Method not allowed');
  }

  const niche = (req.query.niche as string) || null;
  const limit = Math.min(parseInt((req.query.limit as string) || '100', 10), 500);
  const pool = getPool();

  const rows = await pool.query(
    `SELECT id, niche, title, source, content, url, thumbnail_url,
            published_at, language, metadata
       FROM radar_newsletters_curated
      WHERE is_active = true
        AND ($1::text IS NULL OR niche = $1)
      ORDER BY published_at DESC NULLS LAST, created_at DESC
      LIMIT $2`,
    [niche, limit],
  );

  // Fallback: se vazio, sintetiza de viral_news_articles
  if (rows.rowCount === 0) {
    try {
      const fallback = await pool.query(
        `SELECT id, niche, title, source_name as source, summary as content, url,
                thumbnail_url, published_at, language, metadata
           FROM viral_news_articles
          WHERE ($1::text IS NULL OR niche = $1)
            AND (category = 'newsletter' OR source_name ILIKE '%newsletter%')
          ORDER BY published_at DESC NULLS LAST
          LIMIT $2`,
        [niche, limit],
      );
      return res.status(200).json({
        items: fallback.rows,
        count: fallback.rowCount,
        source: 'fallback',
      });
    } catch {
      return res.status(200).json({ items: [], count: 0, source: 'empty' });
    }
  }

  return res.status(200).json({
    items: rows.rows,
    count: rows.rowCount,
    source: 'curated',
  });
}
