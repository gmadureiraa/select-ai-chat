// Multi-method handler para `/api/data/saved` (Radar Viral bookmarks).
//
// GET    ?platform=...           → lista bookmarks do user (filtro opcional)
// POST   { platform, refId, ... } → cria bookmark
// DELETE ?platform=...&refId=... → remove bookmark
//
// Auth: JWT via Authorization header (verifyAuth).
// Persistência: tabela radar_saved_items (RLS user_id = auth.uid()).
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';
import { tryAuth } from '../_lib/auth.js';
import { getPool } from '../_lib/db.js';
import { assertClientAccess } from '../_lib/access.js';

const PostSchema = z.object({
  platform: z.string().min(1).max(40),
  refId: z.string().min(1).max(200),
  // Aceita tanto `niche` quanto `nicheSlug` (frontend Dashboard usa nicheSlug).
  niche: z.string().max(100).optional(),
  nicheSlug: z.string().max(100).optional(),
  // Aceita `notes` (legacy) e `note` (frontend).
  notes: z.string().max(4000).optional(),
  note: z.string().max(4000).optional(),
  // Campos achatados do frontend — empacotamos em ref_data jsonb.
  title: z.string().max(500).optional(),
  sourceUrl: z.string().max(2000).optional(),
  thumbnail: z.string().max(2000).optional(),
  workspaceId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  refData: z.record(z.unknown()).optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res);

  const auth = await tryAuth(req).catch(() => null);
  if (!auth) return jsonError(res, 401, 'Authentication required');

  const pool = getPool();
  const method = (req.method ?? 'GET').toUpperCase();

  if (method === 'GET') {
    const platform = (req.query.platform as string) || null;
    const niche = (req.query.niche as string) || null;
    const limit = Math.min(parseInt((req.query.limit as string) || '100', 10), 500);

    const rows = await pool.query(
      `SELECT id, platform, ref_id, ref_data, niche, notes, saved_at
         FROM radar_saved_items
        WHERE user_id = $1
          AND ($2::text IS NULL OR platform = $2)
          AND ($3::text IS NULL OR niche = $3)
        ORDER BY saved_at DESC
        LIMIT $4`,
      [auth.id, platform, niche, limit],
    );
    // Achata ref_data → top-level pra compatibilidade com `SavedItemRow` do
    // frontend (espera title/note/source_url/thumbnail/niche_slug flat).
    const items = rows.rows.map((r: any) => {
      const rd = r.ref_data ?? {};
      return {
        id: r.id,
        platform: r.platform,
        ref_id: r.ref_id,
        niche: r.niche ?? null,
        niche_slug: r.niche ?? null,
        title: rd.title ?? null,
        note: r.notes ?? rd.note ?? null,
        source_url: rd.source_url ?? rd.sourceUrl ?? null,
        thumbnail: rd.thumbnail ?? null,
        saved_at: r.saved_at,
      };
    });
    return res.status(200).json({ items, count: rows.rowCount });
  }

  if (method === 'POST') {
    const parsed = PostSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return jsonError(res, 400, parsed.error.errors.map((e) => e.message).join('; '));
    }
    const {
      platform,
      refId,
      niche,
      nicheSlug,
      notes,
      note,
      title,
      sourceUrl,
      thumbnail,
      workspaceId,
      clientId,
      refData,
    } = parsed.data;
    if (clientId) await assertClientAccess(auth.id, clientId);
    const resolvedNiche = niche ?? nicheSlug ?? null;
    const resolvedNote = note ?? notes ?? null;
    // Empacota campos flat dentro de ref_data (DB schema usa jsonb pra esses).
    const mergedRefData = {
      ...(refData ?? {}),
      ...(title !== undefined ? { title } : {}),
      ...(sourceUrl !== undefined ? { source_url: sourceUrl } : {}),
      ...(thumbnail !== undefined ? { thumbnail } : {}),
    };
    const r = await pool.query(
      `INSERT INTO radar_saved_items
         (user_id, workspace_id, client_id, platform, ref_id, ref_data, niche, notes)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
       ON CONFLICT (user_id, platform, ref_id) DO UPDATE
         SET ref_data = EXCLUDED.ref_data,
             niche = COALESCE(EXCLUDED.niche, radar_saved_items.niche),
             notes = COALESCE(EXCLUDED.notes, radar_saved_items.notes)
       RETURNING id`,
      [
        auth.id,
        workspaceId ?? null,
        clientId ?? null,
        platform,
        refId,
        JSON.stringify(mergedRefData),
        resolvedNiche,
        resolvedNote,
      ],
    );
    return res.status(200).json({ ok: true, id: r.rows[0]?.id });
  }

  if (method === 'DELETE') {
    const platform = (req.query.platform as string) || null;
    const refId = (req.query.refId as string) || null;
    if (!platform || !refId) {
      return jsonError(res, 400, 'platform e refId são obrigatórios');
    }
    const r = await pool.query(
      `DELETE FROM radar_saved_items
        WHERE user_id = $1 AND platform = $2 AND ref_id = $3
        RETURNING id`,
      [auth.id, platform, refId],
    );
    return res.status(200).json({ ok: true, removed: r.rowCount });
  }

  return jsonError(res, 405, 'Method not allowed');
}
