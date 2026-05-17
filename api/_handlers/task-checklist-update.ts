// Atualiza item de checklist (content e/ou is_done). Auth: user precisa ser
// membro do workspace dono da task.
import { z } from 'zod';
import { authedPost } from '../_lib/handler.js';
import { getPool, queryOne } from '../_lib/db.js';

const BodySchema = z.object({
  id: z.string().uuid(),
  content: z.string().min(1).max(2000).optional(),
  is_done: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
});

export default authedPost(async ({ body, user }) => {
  const parsed = BodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join('; '));
  }
  const data = parsed.data;
  const pool = getPool();

  const access = await queryOne<{ ok: boolean }>(
    `SELECT TRUE AS ok
       FROM team_task_checklist_items ci
       JOIN team_tasks t ON t.id = ci.task_id
       LEFT JOIN workspace_members wm
         ON wm.workspace_id = t.workspace_id AND wm.user_id = $2
      WHERE ci.id = $1
        AND (
          wm.id IS NOT NULL
          OR EXISTS (SELECT 1 FROM super_admins WHERE user_id = $2)
        )
      LIMIT 1`,
    [data.id, user.id],
  );
  if (!access?.ok) {
    throw new Error('Item não encontrado ou acesso negado');
  }

  const updates: string[] = [];
  const params: any[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (key === 'id') continue;
    if (value === undefined) continue;
    params.push(value);
    updates.push(`"${key}" = $${params.length}`);
  }

  if (updates.length === 0) {
    throw new Error('Nada pra atualizar — passe ao menos um campo');
  }

  updates.push(`updated_at = NOW()`);
  params.push(data.id);
  const idIdx = params.length;

  const r = await pool.query(
    `UPDATE team_task_checklist_items SET ${updates.join(', ')}
      WHERE id = $${idIdx}
      RETURNING id, task_id, content, is_done, position, updated_at`,
    params,
  );

  if (r.rows.length === 0) {
    throw new Error('Item não encontrado');
  }
  return { ok: true, item: r.rows[0], id: r.rows[0]?.id };
});
