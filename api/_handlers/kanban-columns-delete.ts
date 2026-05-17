// Deleta coluna do kanban. Antes de deletar, move planning_items órfãos pra
// coluna "idea" (column_type='idea') do mesmo workspace, espelhando a lógica
// que existia no client.
//
// Auth: user precisa ser membro do workspace dono. Tudo numa transaction
// pra atomicidade.
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

  // Resolve workspace_id da coluna + valida acesso.
  const col = await queryOne<{ workspace_id: string }>(
    `SELECT kc.workspace_id
       FROM kanban_columns kc
       LEFT JOIN workspace_members wm
         ON wm.workspace_id = kc.workspace_id AND wm.user_id = $2
      WHERE kc.id = $1
        AND (
          wm.id IS NOT NULL
          OR EXISTS (SELECT 1 FROM super_admins WHERE user_id = $2)
        )
      LIMIT 1`,
    [id, user.id],
  );
  if (!col?.workspace_id) {
    throw new Error('Coluna não encontrada ou acesso negado');
  }

  // Resolve coluna "idea" do mesmo workspace pra mover órfãos.
  const ideaCol = await queryOne<{ id: string }>(
    `SELECT id FROM kanban_columns
      WHERE workspace_id = $1 AND column_type = 'idea'
      LIMIT 1`,
    [col.workspace_id],
  );

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (ideaCol?.id) {
      // Move items órfãos pra coluna idea
      await client.query(
        `UPDATE planning_items
            SET column_id = $1, status = 'idea'
          WHERE column_id = $2`,
        [ideaCol.id, id],
      );
    }
    const r = await client.query(
      `DELETE FROM kanban_columns WHERE id = $1 RETURNING id, name`,
      [id],
    );
    await client.query('COMMIT');
    return { ok: true, deleted: r.rows[0], id: r.rows[0]?.id };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});
