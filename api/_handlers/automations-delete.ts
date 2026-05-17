// Deleta uma planning_automation. Auth: user precisa ser owner/admin do
// workspace dono (ou super_admin).
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
       FROM planning_automations a
       LEFT JOIN workspace_members wm
         ON wm.workspace_id = a.workspace_id
        AND wm.user_id = $2
        AND wm.role IN ('owner', 'admin')
      WHERE a.id = $1
        AND (
          wm.id IS NOT NULL
          OR EXISTS (SELECT 1 FROM super_admins WHERE user_id = $2)
        )
      LIMIT 1`,
    [data.id, user.id],
  );
  if (!access?.ok) {
    throw new Error('Automação não encontrada ou sem permissão (precisa ser admin)');
  }

  const r = await pool.query(
    `DELETE FROM planning_automations WHERE id = $1
     RETURNING id, name, trigger_type`,
    [data.id],
  );

  return { ok: true, deleted: r.rows[0], id: r.rows[0]?.id };
});
