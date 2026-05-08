// POST /api/client-add-source
//
// Adiciona uma fonte (source) per-client em viral_tracked_sources.
//
// Auth: Bearer JWT obrigatório. Caller precisa ser workspace_member do
//       workspace dono do client_id (ou super_admin).
//
// Body:
//   {
//     client_id: string (uuid),
//     source_type: 'rss' | 'instagram' | 'tiktok' | 'youtube' |
//                  'twitter' | 'threads' | 'linkedin' | 'newsletter',
//     source_url: string,
//     source_name?: string,
//     category?: string,
//     niche?: string,
//   }
//
// Resposta: { ok: true, source: { ... } }
//
// Phase E (Radar per-client). Fontes per-client são lidas pelos
// cron-scrape-* quando recebem ?client_id=<uuid>.

import { z } from 'zod';
import { authedPost } from '../_lib/handler.js';
import { query, queryOne, insertRow } from '../_lib/db.js';

const SourceTypeEnum = z.enum([
  'rss',
  'instagram',
  'tiktok',
  'youtube',
  'twitter',
  'threads',
  'linkedin',
  'newsletter',
]);

const BodySchema = z.object({
  client_id: z.string().uuid('client_id deve ser um UUID válido'),
  source_type: SourceTypeEnum,
  source_url: z.string().min(1, 'source_url é obrigatório').max(2048),
  source_name: z.string().max(200).optional().nullable(),
  category: z.string().max(80).optional().nullable(),
  niche: z.string().max(80).optional().nullable(),
});

interface InsertedSource {
  id: string;
  client_id: string | null;
  workspace_id: string | null;
  source_type: string;
  source_url: string;
  source_name: string | null;
  category: string | null;
  niche: string | null;
  is_active: boolean;
  last_scraped_at: string | null;
  created_at: string;
}

export default authedPost(async ({ user, body }) => {
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid input: ${issues}`);
  }
  const data = parsed.data;

  // Resolve workspace + verify access (workspace_member OR super_admin)
  const access = await queryOne<{ workspace_id: string }>(
    `SELECT c.workspace_id
       FROM clients c
       LEFT JOIN workspace_members wm
         ON wm.workspace_id = c.workspace_id AND wm.user_id = $2
      WHERE c.id = $1
        AND (
          wm.id IS NOT NULL
          OR EXISTS (
            SELECT 1 FROM super_admins sa WHERE sa.user_id = $2
          )
        )
      LIMIT 1`,
    [data.client_id, user.id],
  );

  if (!access) {
    throw new Error('Sem acesso a este cliente');
  }

  // Idempotency: detect already-existing source with same URL+type+client_id
  const existing = await queryOne<InsertedSource>(
    `SELECT id, client_id, workspace_id, source_type, source_url, source_name,
            category, niche, is_active, last_scraped_at, created_at
       FROM viral_tracked_sources
      WHERE client_id = $1
        AND source_type = $2
        AND lower(source_url) = lower($3)
      LIMIT 1`,
    [data.client_id, data.source_type, data.source_url.trim()],
  ).catch(() => null);

  if (existing) {
    // Reactivate if soft-deleted, but otherwise return existing.
    if (!existing.is_active) {
      await query(
        `UPDATE viral_tracked_sources SET is_active = true WHERE id = $1`,
        [existing.id],
      ).catch(() => null);
      existing.is_active = true;
    }
    return { ok: true, source: existing, deduped: true };
  }

  const source = await insertRow<InsertedSource>('viral_tracked_sources', {
    client_id: data.client_id,
    workspace_id: access.workspace_id,
    source_type: data.source_type,
    source_url: data.source_url.trim(),
    source_name: data.source_name?.trim() || null,
    category: data.category?.trim() || null,
    niche: data.niche?.trim() || null,
    is_active: true,
  });

  return { ok: true, source };
});
