// Deleta item de checklist. Auth: user precisa ser membro do workspace.
import { z } from 'zod';
import { authedPost } from '../_lib/handler.js';
import { getPool, queryOne } from '../_lib/db.js';

const BodySchema = z.object({
  id: z.string().uuid(),
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

  const r = await pool.query(
    `DELETE FROM team_task_checklist_items WHERE id = $1
     RETURNING id`,
    [data.id],
  );

  return { ok: true, deleted: r.rows[0], id: r.rows[0]?.id };
});
