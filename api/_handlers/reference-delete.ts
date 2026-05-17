// Remove row de client_reference_library. Auth: user precisa ter acesso ao
// cliente dono.
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

  const access = await queryOne<{ ok: boolean; client_id: string }>(
    `SELECT TRUE AS ok, r.client_id
       FROM client_reference_library r
       JOIN clients c ON c.id = r.client_id
       LEFT JOIN workspace_members wm
         ON wm.workspace_id = c.workspace_id AND wm.user_id = $2
      WHERE r.id = $1
        AND (
          wm.id IS NOT NULL
          OR EXISTS (SELECT 1 FROM super_admins WHERE user_id = $2)
        )
      LIMIT 1`,
    [data.id, user.id],
  );
  if (!access?.ok) {
    throw new Error('Reference não encontrada ou acesso negado');
  }

  const r = await pool.query(
    `DELETE FROM client_reference_library WHERE id = $1
     RETURNING id, client_id, title`,
    [data.id],
  );

  return { ok: true, deleted: r.rows[0], id: r.rows[0]?.id };
});
