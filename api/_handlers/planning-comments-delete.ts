// Remove comentário de planning_item. Auth: user precisa ser o author OU
// admin/owner do workspace.
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
  const { id } = parsed.data;
  const pool = getPool();

  const access = await queryOne<{ ok: boolean }>(
    `SELECT TRUE AS ok
       FROM planning_item_comments c
       JOIN planning_items pi ON pi.id = c.planning_item_id
       LEFT JOIN workspace_members wm
         ON wm.workspace_id = pi.workspace_id AND wm.user_id = $2
      WHERE c.id = $1
        AND (
          c.user_id = $2
          OR (wm.id IS NOT NULL AND wm.role IN ('owner', 'admin'))
          OR EXISTS (SELECT 1 FROM super_admins WHERE user_id = $2)
        )
      LIMIT 1`,
    [id, user.id],
  );
  if (!access?.ok) {
    throw new Error('Comentário não encontrado ou acesso negado');
  }

  const r = await pool.query(
    `DELETE FROM planning_item_comments WHERE id = $1 RETURNING id`,
    [id],
  );
  return { ok: true, deleted: r.rows[0], id: r.rows[0]?.id };
});
