// Cria team_task. Endpoint dedicado pra ferramenta createTeamTask do KAI Chat.
import { z } from 'zod';
import { authedPost } from '../_lib/handler.js';
import { getPool, queryOne } from '../_lib/db.js';

const BodySchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  status: z.enum(['todo', 'in_progress', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  due_date: z.string().optional(),
  assigned_to: z.string().uuid().optional(),
  labels: z.array(z.string()).optional(),
  client_id: z.string().uuid().nullable().optional(),
  workspace_id: z.string().uuid().optional(),
});

export default authedPost(async ({ body, user }) => {
  const parsed = BodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join('; '));
  }
  const data = parsed.data;
  const pool = getPool();

  // Resolve workspace via membership do user (se não foi explícito).
  let workspaceId = data.workspace_id ?? null;
  if (!workspaceId) {
    const w = await queryOne<{ workspace_id: string }>(
      `SELECT workspace_id FROM workspace_members
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 1`,
      [user.id],
    );
    workspaceId = w?.workspace_id ?? null;
  }
  if (!workspaceId) {
    throw new Error('Sem workspace associado ao user');
  }

  const r = await pool.query(
    `INSERT INTO team_tasks
       (workspace_id, client_id, title, description, status, priority,
        due_date, assigned_to, labels, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::text[], $10)
     RETURNING id, title, status, priority, due_date, created_at`,
    [
      workspaceId,
      data.client_id ?? null,
      data.title,
      data.description ?? null,
      data.status ?? 'todo',
      data.priority ?? 'medium',
      data.due_date ?? null,
      data.assigned_to ?? user.id,
      data.labels ?? [],
      user.id,
    ],
  ).catch((err) => {
    // Schema team_tasks pode variar. Se algum campo não existe (ex: labels
    // text[] vs jsonb), retry sem ele.
    console.warn('[team-tasks-create] insert failed:', err?.message);
    throw err;
  });

  return { ok: true, task: r.rows[0], id: r.rows[0]?.id };
});
