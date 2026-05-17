// Cria um planning_item no kanban do workspace. Versão mais flexível que
// save-as-planning-item (que assume source viral 'sv'/'reels'/'radar').
// Usado pelo KAI Chat actions e CrossAppActions quando salvando ideias.
//
// Auth: assertClientAccess se client_id presente; assertWorkspaceAccess sempre.
import { z } from 'zod';
import { authedPost } from '../_lib/handler.js';
import { getPool, queryOne } from '../_lib/db.js';
import { assertClientAccess, assertWorkspaceAccess } from '../_lib/access.js';

const BodySchema = z.object({
  workspace_id: z.string().uuid(),
  client_id: z.string().uuid().nullable().optional(),
  column_id: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(500),
  content: z.string().max(50_000).nullable().optional(),
  description: z.string().max(10_000).nullable().optional(),
  content_type: z.string().max(60).optional(),
  platform: z.string().max(60).nullable().optional(),
  status: z
    .enum(['idea', 'draft', 'review', 'approved', 'scheduled', 'published', 'todo'])
    .optional(),
  scheduled_at: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export default authedPost(async ({ body, user }) => {
  const parsed = BodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join('; '));
  }
  const data = parsed.data;

  await assertWorkspaceAccess(user.id, data.workspace_id);
  if (data.client_id) {
    const access = await assertClientAccess(user.id, data.client_id);
    if (access.workspaceId !== data.workspace_id) {
      throw new Error('client_id não pertence ao workspace alvo');
    }
  }

  const pool = getPool();

  // Se column_id não foi passado, pega primeira coluna do workspace.
  let columnId = data.column_id ?? null;
  if (!columnId) {
    const col = await queryOne<{ id: string }>(
      `SELECT id FROM kanban_columns
        WHERE workspace_id = $1
        ORDER BY position ASC LIMIT 1`,
      [data.workspace_id],
    );
    columnId = col?.id ?? null;
  }

  const r = await pool.query(
    `INSERT INTO planning_items
       (workspace_id, client_id, column_id, title, content, description,
        content_type, platform, status, scheduled_at, due_date, assigned_to,
        priority, metadata, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15)
     RETURNING id, workspace_id, client_id, column_id, title, status, created_at`,
    [
      data.workspace_id,
      data.client_id ?? null,
      columnId,
      data.title,
      data.content ?? null,
      data.description ?? null,
      data.content_type ?? null,
      data.platform ?? null,
      data.status ?? 'idea',
      data.scheduled_at ?? null,
      data.due_date ?? null,
      data.assigned_to ?? null,
      data.priority ?? 'medium',
      JSON.stringify(data.metadata ?? {}),
      user.id,
    ],
  );

  return { ok: true, item: r.rows[0], id: r.rows[0]?.id };
});
