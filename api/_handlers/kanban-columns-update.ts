// Atualiza coluna do kanban (rename, recolor, mover position). Suporta batch
// update via `updates` array (usado pelo reorderColumns pra mover N colunas).
// Auth: user precisa ser membro do workspace dono das colunas.
import { z } from 'zod';
import { authedPost } from '../_lib/handler.js';
import { getPool, queryOne } from '../_lib/db.js';

const SingleSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  position: z.number().int().min(0).optional(),
  color: z.string().max(30).optional(),
});

const BodySchema = z.union([
  SingleSchema,
  z.object({ updates: z.array(SingleSchema).min(1).max(50) }),
]);

async function assertColumnAccess(userId: string, columnId: string): Promise<void> {
  const access = await queryOne<{ ok: boolean }>(
    `SELECT TRUE AS ok
       FROM kanban_columns kc
       LEFT JOIN workspace_members wm
         ON wm.workspace_id = kc.workspace_id AND wm.user_id = $2
      WHERE kc.id = $1
        AND (
          wm.id IS NOT NULL
          OR EXISTS (SELECT 1 FROM super_admins WHERE user_id = $2)
        )
      LIMIT 1`,
    [columnId, userId],
  );
  if (!access?.ok) {
    throw new Error('Coluna não encontrada ou acesso negado');
  }
}

async function applyUpdate(
  pool: ReturnType<typeof getPool>,
  data: z.infer<typeof SingleSchema>,
) {
  const updates: string[] = [];
  const params: any[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (key === 'id') continue;
    if (value === undefined) continue;
    params.push(typeof value === 'string' ? value.trim() : value);
    updates.push(`"${key}" = $${params.length}`);
  }
  if (updates.length === 0) {
    throw new Error('Nada pra atualizar — passe ao menos um campo');
  }
  updates.push(`updated_at = NOW()`);
  params.push(data.id);
  const idIdx = params.length;
  const r = await pool.query(
    `UPDATE kanban_columns SET ${updates.join(', ')}
      WHERE id = $${idIdx}
      RETURNING id, name, position, color, column_type, updated_at`,
    params,
  );
  if (r.rows.length === 0) throw new Error('Coluna não encontrada');
  return r.rows[0];
}

export default authedPost(async ({ body, user }) => {
  const parsed = BodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join('; '));
  }
  const pool = getPool();

  const data: any = parsed.data;
  if (Array.isArray(data.updates)) {
    // Batch reorder
    const results: any[] = [];
    for (const u of data.updates) {
      await assertColumnAccess(user.id, u.id);
      const row = await applyUpdate(pool, u);
      results.push(row);
    }
    return { ok: true, columns: results };
  }

  await assertColumnAccess(user.id, data.id);
  const row = await applyUpdate(pool, data);
  return { ok: true, column: row, id: row?.id };
});
