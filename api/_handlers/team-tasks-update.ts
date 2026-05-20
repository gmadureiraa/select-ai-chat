// Atualiza team_task. Endpoint dedicado pra ferramenta editTask do KAI Chat.
// Cada campo é opcional — só atualiza o que vier.
import { z } from 'zod';
import { authedPost } from '../_lib/handler.js';
import { getPool, queryOne } from '../_lib/db.js';

const BodySchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  status: z.enum(['todo', 'in_progress', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  due_date: z.string().nullable().optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  // Multi-responsável (migration 0051). assigned_to = "primary" (= assignees[0]).
  assignees: z.array(z.string().uuid()).optional(),
  labels: z.array(z.string()).optional(),
});

export default authedPost(async ({ body, user }) => {
  const parsed = BodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join('; '));
  }
  const data = parsed.data;
  const pool = getPool();

  // Verifica acesso — task precisa estar num workspace do user (owner/admin/member)
  // ou user precisa ser super_admin.
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
    [data.id, user.id],
  );
  if (!access?.ok) {
    throw new Error('Tarefa não encontrada ou acesso negado');
  }

  // 2026-05-19 (migration 0051): sync assignees[] <-> assigned_to (primary).
  // Quando assignees vier → assigned_to = assignees[0]. Quando só assigned_to
  // vier (legacy caller) → assignees = [assigned_to]. Mutamos `data` pra que o
  // loop abaixo grave ambas as colunas.
  const dataAny = data as Record<string, unknown>;
  if (data.assignees !== undefined) {
    dataAny.assigned_to = data.assignees[0] ?? null;
  } else if (data.assigned_to !== undefined && data.assigned_to !== null) {
    dataAny.assignees = [data.assigned_to];
  }

  // 2026-05-19 fix: team_tasks.labels é JSONB (não text[]). Bug paralelo ao
  // team-tasks-create. Schema confirmado via information_schema.
  // assignees é uuid[] — cast ::uuid[] (NÃO confundir com labels JSONB).
  const updates: string[] = [];
  const params: any[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (key === 'id') continue;
    if (value === undefined) continue;
    if (key === 'labels') {
      params.push(JSON.stringify(value));
      updates.push(`"${key}" = $${params.length}::jsonb`);
    } else if (key === 'assignees') {
      const arr = value === null ? null : (Array.isArray(value) ? value.map(String) : [String(value)]);
      params.push(arr);
      updates.push(`"${key}" = $${params.length}::uuid[]`);
    } else {
      params.push(value);
      updates.push(`"${key}" = $${params.length}`);
    }
  }

  if (updates.length === 0) {
    throw new Error('Nada pra atualizar — passe ao menos um campo');
  }

  // Se status virou 'done', marcar completed_at; se saiu de 'done', limpa.
  if (data.status === 'done') {
    updates.push(`completed_at = NOW()`);
  } else if (data.status) {
    updates.push(`completed_at = NULL`);
  }

  updates.push(`updated_at = NOW()`);
  params.push(data.id);
  const idIdx = params.length;

  const r = await pool.query(
    `UPDATE team_tasks SET ${updates.join(', ')}
      WHERE id = $${idIdx}
      RETURNING id, title, description, status, priority, due_date, assigned_to, assignees, labels, updated_at`,
    params,
  );

  if (r.rows.length === 0) {
    throw new Error('Tarefa não encontrada');
  }

  return { ok: true, task: r.rows[0], id: r.rows[0]?.id };
});
