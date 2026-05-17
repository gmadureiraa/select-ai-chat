// Cria coluna custom no kanban do workspace. Auth: user precisa ser membro
// (qualquer role) do workspace.
//
// P0 fix audit 2026-05-17: usePlanningColumns fazia supabase.from(...).insert
// direto. Centralizar pra evitar dependência total de RLS no pool serverless.
import { z } from 'zod';
import { authedPost } from '../_lib/handler.js';
import { getPool } from '../_lib/db.js';
import { assertWorkspaceAccess } from '../_lib/access.js';

const BodySchema = z.object({
  workspace_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  position: z.number().int().min(0).default(0),
  color: z.string().max(30).default('gray'),
  column_type: z
    .enum(['idea', 'draft', 'review', 'approved', 'scheduled', 'published', 'custom'])
    .default('custom'),
});

export default authedPost(async ({ body, user }) => {
  const parsed = BodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join('; '));
  }
  const data = parsed.data;
  await assertWorkspaceAccess(user.id, data.workspace_id);

  const pool = getPool();
  const r = await pool.query(
    `INSERT INTO kanban_columns
       (workspace_id, name, position, color, column_type, is_default)
     VALUES ($1, $2, $3, $4, $5, FALSE)
     RETURNING id, workspace_id, name, position, color, column_type, is_default, created_at`,
    [data.workspace_id, data.name.trim(), data.position, data.color, data.column_type],
  );

  return { ok: true, column: r.rows[0], id: r.rows[0]?.id };
});
