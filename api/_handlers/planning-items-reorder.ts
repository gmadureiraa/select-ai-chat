// Batch reorder de planning_items (drag & drop). Cada update muda column_id,
// position e opcionalmente status. Auth: user precisa ter acesso a TODOS os
// items (verifica em batch).
//
// P0 fix audit 2026-05-17: usePlanningItems.reorderItems fazia Promise.all
// de N supabase.from('planning_items').update direto. Sem assertClientAccess.
import { z } from 'zod';
import { authedPost } from '../_lib/handler.js';
import { getPool, query } from '../_lib/db.js';

const UpdateSchema = z.object({
  id: z.string().uuid(),
  column_id: z.string().uuid(),
  position: z.number().int().min(0),
  status: z
    .enum(['idea', 'pending_approval', 'draft', 'review', 'approved', 'scheduled', 'published'])
    .optional(),
});

const BodySchema = z.object({
  updates: z.array(UpdateSchema).min(1).max(500),
});

export default authedPost(async ({ body, user }) => {
  const parsed = BodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join('; '));
  }
  const { updates } = parsed.data;
  const pool = getPool();

  // Validação em batch: todos os items precisam estar em workspaces que o user
  // é membro OU o user é super_admin. 1 query só, retorna count das válidas.
  const ids = updates.map((u) => u.id);
  const accessRows = await query<{ id: string }>(
    `SELECT pi.id
       FROM planning_items pi
       LEFT JOIN workspace_members wm
         ON wm.workspace_id = pi.workspace_id AND wm.user_id = $2
      WHERE pi.id = ANY($1::uuid[])
        AND (
          wm.id IS NOT NULL
          OR EXISTS (SELECT 1 FROM super_admins WHERE user_id = $2)
        )`,
    [ids, user.id],
  );
  if (accessRows.length !== ids.length) {
    throw new Error(
      `Acesso negado a ${ids.length - accessRows.length} item(s) do batch`,
    );
  }

  // Aplica updates em transaction.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const u of updates) {
      const cols: string[] = ['column_id = $1', 'position = $2'];
      const params: any[] = [u.column_id, u.position];
      if (u.status) {
        params.push(u.status);
        cols.push(`status = $${params.length}`);
      }
      params.push(u.id);
      const idIdx = params.length;
      await client.query(
        `UPDATE planning_items SET ${cols.join(', ')}, updated_at = NOW()
          WHERE id = $${idIdx}`,
        params,
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return { ok: true, updated: updates.length };
});
