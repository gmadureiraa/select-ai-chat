// Atualiza um planning_item. Suporta todos os campos editáveis (title,
// content, recurrence_*, status, etc). Auth: user precisa ser membro do
// workspace dono.
//
// P0 fix audit 2026-05-17: usePlanningItems.updateItem/moveToColumn/
// addToLibrary/scheduleItem/retryPublication faziam supabase.from(...).update
// direto. Centralizar.
import { z } from 'zod';
import { authedPost } from '../_lib/handler.js';
import { getPool, queryOne } from '../_lib/db.js';
import { assertColumnInWorkspace } from '../_lib/access.js';

const BodySchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(500).optional(),
  content: z.string().max(50_000).nullable().optional(),
  description: z.string().max(10_000).nullable().optional(),
  content_type: z.string().max(60).optional(),
  platform: z.string().max(60).nullable().optional(),
  status: z
    .enum([
      'idea', 'pending_approval', 'draft', 'review', 'approved', 'scheduled', 'published',
      'publishing', 'failed', 'todo',
    ])
    .optional(),
  scheduled_at: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  published_at: z.string().nullable().optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  position: z.number().int().min(0).optional(),
  column_id: z.string().uuid().nullable().optional(),
  client_id: z.string().uuid().nullable().optional(),
  labels: z.array(z.unknown()).optional(),
  media_urls: z.array(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  recurrence_type: z.string().max(40).nullable().optional(),
  recurrence_days: z.unknown().nullable().optional(),
  recurrence_time: z.string().max(20).nullable().optional(),
  recurrence_end_date: z.string().nullable().optional(),
  is_recurrence_template: z.boolean().nullable().optional(),
  external_post_id: z.string().max(200).nullable().optional(),
  error_message: z.string().max(2000).nullable().optional(),
  retry_count: z.number().int().min(0).nullable().optional(),
  added_to_library: z.boolean().nullable().optional(),
  content_library_id: z.string().uuid().nullable().optional(),
});

// 2026-05-19 fix: recurrence_days é text[] (não jsonb).
const JSONB_KEYS = new Set(['labels', 'media_urls', 'metadata']);
const TEXT_ARRAY_KEYS = new Set(['recurrence_days']);

export default authedPost(async ({ body, user }) => {
  const parsed = BodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join('; '));
  }
  const data = parsed.data;
  const pool = getPool();

  // Verifica acesso — item precisa estar em workspace que o user é membro,
  // ou user é super_admin.
  const access = await queryOne<{ workspace_id: string }>(
    `SELECT pi.workspace_id
       FROM planning_items pi
       LEFT JOIN workspace_members wm
         ON wm.workspace_id = pi.workspace_id AND wm.user_id = $2
      WHERE pi.id = $1
        AND (
          wm.id IS NOT NULL
          OR EXISTS (SELECT 1 FROM super_admins WHERE user_id = $2)
        )
      LIMIT 1`,
    [data.id, user.id],
  );
  if (!access) {
    throw new Error('Item não encontrado ou acesso negado');
  }

  // Sec2: se vai mover pra coluna nova, valida que coluna é do mesmo workspace.
  if (data.column_id) {
    await assertColumnInWorkspace(data.column_id, access.workspace_id);
  }

  if (data.client_id) {
    const client = await queryOne<{ id: string }>(
      `SELECT id FROM clients WHERE id = $1 AND workspace_id = $2 LIMIT 1`,
      [data.client_id, access.workspace_id],
    );
    if (!client) {
      throw new Error('client_id não pertence ao workspace do item');
    }
  }

  const updates: string[] = [];
  const params: unknown[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (key === 'id') continue;
    if (value === undefined) continue;
    if (JSONB_KEYS.has(key)) {
      params.push(JSON.stringify(value));
      updates.push(`"${key}" = $${params.length}::jsonb`);
    } else if (TEXT_ARRAY_KEYS.has(key)) {
      const arr = value === null ? null : (Array.isArray(value) ? value.map(String) : [String(value)]);
      params.push(arr);
      updates.push(`"${key}" = $${params.length}::text[]`);
    } else {
      params.push(value);
      updates.push(`"${key}" = $${params.length}`);
    }
  }

  if (updates.length === 0) {
    throw new Error('Nada pra atualizar — passe ao menos um campo');
  }

  updates.push(`updated_at = NOW()`);
  params.push(data.id);
  const idIdx = params.length;

  const r = await pool.query(
    `UPDATE planning_items SET ${updates.join(', ')}
      WHERE id = $${idIdx}
      RETURNING id, title, status, column_id, position, scheduled_at, updated_at`,
    params,
  );

  if (r.rows.length === 0) {
    throw new Error('Item não encontrado');
  }
  return { ok: true, item: r.rows[0], id: r.rows[0]?.id };
});
