// Adiciona comentário a uma team_task. Auth: user precisa ser membro do
// workspace. author_id é forçado pelo auth (não aceito do body).
import { z } from 'zod';
import { authedPost } from '../_lib/handler.js';
import { getPool, queryOne } from '../_lib/db.js';

const BodySchema = z.object({
  task_id: z.string().uuid(),
  content: z.string().min(1).max(5000),
  mentions: z.array(z.string().uuid()).default([]),
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
       FROM team_tasks t
       LEFT JOIN workspace_members wm
         ON wm.workspace_id = t.workspace_id AND wm.user_id = $2
      WHERE t.id = $1
        AND (
          wm.id IS NOT NULL
          OR EXISTS (SELECT 1 FROM super_admins WHERE user_id = $2)
        )
      LIMIT 1`,
    [data.task_id, user.id],
  );
  if (!access?.ok) {
    throw new Error('Tarefa não encontrada ou acesso negado');
  }

  const r = await pool.query(
    `INSERT INTO team_task_comments
       (task_id, author_id, content, mentions)
     VALUES ($1, $2, $3, $4::uuid[])
     RETURNING id, task_id, author_id, content, mentions, created_at`,
    [data.task_id, user.id, data.content, data.mentions],
  );

  return { ok: true, comment: r.rows[0], id: r.rows[0]?.id };
});
