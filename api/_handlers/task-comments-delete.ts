// Remove comentário. Auth: user precisa ser o author OU admin/owner do workspace.
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
       FROM team_task_comments c
       JOIN team_tasks t ON t.id = c.task_id
       LEFT JOIN workspace_members wm
         ON wm.workspace_id = t.workspace_id AND wm.user_id = $2
      WHERE c.id = $1
        AND (
          c.author_id = $2
          OR (wm.id IS NOT NULL AND wm.role IN ('owner', 'admin'))
          OR EXISTS (SELECT 1 FROM super_admins WHERE user_id = $2)
        )
      LIMIT 1`,
    [data.id, user.id],
  );
  if (!access?.ok) {
    throw new Error('Comentário não encontrado ou acesso negado');
  }

  const r = await pool.query(
    `DELETE FROM team_task_comments WHERE id = $1 RETURNING id`,
    [data.id],
  );

  return { ok: true, deleted: r.rows[0], id: r.rows[0]?.id };
});
