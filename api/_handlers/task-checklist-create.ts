// Adiciona item a um checklist de team_task. Auth: user precisa ser membro
// do workspace dono da task.
//
// P0 fix audit 2026-05-17: useTaskChecklist fazia supabase.from(...).insert
// direto. RLS protegia via is_workspace_member(team_task_workspace(task_id))
// mas centralizar fortalece quando neondb_owner pool tem BYPASSRLS.
import { z } from 'zod';
import { authedPost } from '../_lib/handler.js';
import { getPool, queryOne } from '../_lib/db.js';

const BodySchema = z.object({
  task_id: z.string().uuid(),
  content: z.string().min(1).max(2000),
  position: z.number().int().min(0).default(0),
});

export default authedPost(async ({ body, user }) => {
  const parsed = BodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join('; '));
  }
  const data = parsed.data;
  const pool = getPool();

  // Verifica acesso — user precisa ser membro do workspace dono da task.
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
    `INSERT INTO team_task_checklist_items
       (task_id, content, position, created_by)
     VALUES ($1, $2, $3, $4)
     RETURNING id, task_id, content, is_done, position, created_at`,
    [data.task_id, data.content, data.position, user.id],
  );

  return { ok: true, item: r.rows[0], id: r.rows[0]?.id };
});
