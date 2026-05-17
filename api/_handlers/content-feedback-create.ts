// Persiste feedback do user em uma message do KAI Chat (approved/regenerated/etc).
// Auth: user precisa ter acesso ao cliente alvo (assertClientAccess). user_id é
// forçado pelo auth (não aceito do body) pra evitar spoofing.
//
// P0 fix audit 2026-05-17: antes MessageFeedback.tsx fazia
// supabase.from('content_feedback').insert direto com user_id=auth.user.id.
// RLS protegia via auth.uid() = user_id mas (a) depende de RLS perfeito no
// PostgREST/Data API e (b) qualquer write futuro com schema diferente fica
// frágil. Centralizar.
import { z } from 'zod';
import { authedPost } from '../_lib/handler.js';
import { getPool } from '../_lib/db.js';
import { assertClientAccess } from '../_lib/access.js';

const BodySchema = z.object({
  client_id: z.string().uuid(),
  message_id: z.string().uuid().nullable().optional(),
  format_type: z.string().max(60).nullable().optional(),
  feedback_type: z.enum(['approved', 'edited', 'regenerated', 'saved_to_library']),
  original_content: z.string().max(50_000).nullable().optional(),
  edited_content: z.string().max(50_000).nullable().optional(),
  edit_distance: z.number().int().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export default authedPost(async ({ body, user }) => {
  const parsed = BodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join('; '));
  }
  const data = parsed.data;
  await assertClientAccess(user.id, data.client_id);

  const pool = getPool();
  const r = await pool.query(
    `INSERT INTO content_feedback
       (client_id, message_id, user_id, format_type, feedback_type,
        original_content, edited_content, edit_distance, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
     RETURNING id, feedback_type, created_at`,
    [
      data.client_id,
      data.message_id ?? null,
      user.id,
      data.format_type ?? null,
      data.feedback_type,
      data.original_content ?? null,
      data.edited_content ?? null,
      data.edit_distance ?? null,
      JSON.stringify(data.metadata ?? {}),
    ],
  );

  return { ok: true, feedback: r.rows[0], id: r.rows[0]?.id };
});
