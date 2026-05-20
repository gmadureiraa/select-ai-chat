// Cria team_task. Endpoint dedicado pra ferramenta createTeamTask do KAI Chat.
import { z } from 'zod';
import { authedPost } from '../_lib/handler.js';
import { getPool, queryOne } from '../_lib/db.js';
import { assertWorkspaceAccess, assertClientAccess } from '../_lib/access.js';

const BodySchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  status: z.enum(['todo', 'in_progress', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  due_date: z.string().optional(),
  assigned_to: z.string().uuid().optional(),
  // Multi-responsável (migration 0051). assigned_to = "primary" (= assignees[0]).
  assignees: z.array(z.string().uuid()).optional(),
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

  // Resolve workspace.
  // SECURITY: se workspace_id é explícito, valida que o user é membro.
  // Sem essa checagem, qualquer user logado podia criar tarefas em workspaces
  // alheios passando o UUID conhecido.
  let workspaceId = data.workspace_id ?? null;
  if (workspaceId) {
    await assertWorkspaceAccess(user.id, workspaceId);
  } else {
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

  // Se client_id foi passado, garantir que pertence ao workspace E que o user
  // tem acesso ao cliente. Sem essa checagem, podia mapear task pra cliente
  // de outro workspace (vazaria via getRecentActivity).
  if (data.client_id) {
    const access = await assertClientAccess(user.id, data.client_id);
    if (access.workspaceId !== workspaceId) {
      throw new Error('client_id não pertence ao workspace alvo');
    }
  }

  // 2026-05-19 (migration 0051): multi-responsável. assignees é uuid[] (NÃO
  // confundir com labels que é JSONB). Sync assigned_to = assignees[0] (primary).
  // - assignees vier → assigned_to = assignees[0].
  // - só assigned_to vier (ou default user.id) → assignees = [assigned_to].
  const assignedTo = data.assignees !== undefined
    ? (data.assignees[0] ?? null)
    : (data.assigned_to ?? user.id);
  const assignees = data.assignees !== undefined
    ? data.assignees
    : (assignedTo ? [assignedTo] : []);

  // 2026-05-19 fix: team_tasks.labels é JSONB (não text[]). Bug anterior
  // crashava criar tarefa com "column labels is of type jsonb but expression
  // is of type text[]". Schema confirmado via information_schema.
  const r = await pool.query(
    `INSERT INTO team_tasks
       (workspace_id, client_id, title, description, status, priority,
        due_date, assigned_to, assignees, labels, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::uuid[], $10::jsonb, $11)
     RETURNING id, title, status, priority, due_date, created_at`,
    [
      workspaceId,
      data.client_id ?? null,
      data.title,
      data.description ?? null,
      data.status ?? 'todo',
      data.priority ?? 'medium',
      data.due_date ?? null,
      assignedTo,
      assignees,
      JSON.stringify(data.labels ?? []),
      user.id,
    ],
  );

  return { ok: true, task: r.rows[0], id: r.rows[0]?.id };
});
