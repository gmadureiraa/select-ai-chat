// Adiciona comentário a um planning_item + dispara notificações pra users
// mencionados (@user). Auth: user precisa ter acesso ao planning_item via
// workspace membership. user_id é forçado pelo auth.
//
// P0 fix audit 2026-05-17: usePlanningComments fazia 2 inserts (comment +
// notifications) direto via supabase.from. Centralizar pra atomic + auth.
import { z } from 'zod';
import { authedPost } from '../_lib/handler.js';
import { getPool, queryOne } from '../_lib/db.js';

const BodySchema = z.object({
  planning_item_id: z.string().uuid(),
  content: z.string().min(1).max(10_000),
  // user ids extraídos do parseMentions no client (já filtrado pra mention type='user')
  user_mentions: z.array(z.string().uuid()).default([]),
});

export default authedPost(async ({ body, user }) => {
  const parsed = BodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join('; '));
  }
  const data = parsed.data;
  const pool = getPool();

  // Resolve workspace_id do planning_item + valida acesso
  const item = await queryOne<{ workspace_id: string }>(
    `SELECT pi.workspace_id
       FROM planning_items pi
       LEFT JOIN workspace_members wm
         ON wm.workspace_id = pi.workspace_id AND wm.user_id = $2
      WHERE pi.id = $1
        AND (
          wm.id IS NOT NULL
          OR EXISTS (SELECT 1 FROM super_admins WHERE user_id = $2)
        )
      LIMIT 1`,
    [data.planning_item_id, user.id],
  );
  if (!item?.workspace_id) {
    throw new Error('Planning item não encontrado ou acesso negado');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const cRes = await client.query(
      `INSERT INTO planning_item_comments
         (planning_item_id, user_id, content)
       VALUES ($1, $2, $3)
       RETURNING id, planning_item_id, user_id, content, created_at`,
      [data.planning_item_id, user.id, data.content],
    );
    const comment = cRes.rows[0];

    // Cria notifications pra users mencionados (exceto self)
    const targets = data.user_mentions.filter((m) => m !== user.id);
    if (targets.length > 0) {
      // Resolve nome do author pro message
      const authorRow = await client.query(
        `SELECT full_name, email FROM profiles WHERE id = $1`,
        [user.id],
      );
      const authorName =
        authorRow.rows[0]?.full_name ||
        authorRow.rows[0]?.email?.split('@')[0] ||
        'Alguém';

      const metadata = JSON.stringify({
        comment_id: comment.id,
        planning_item_id: data.planning_item_id,
      });

      // Bulk insert
      for (const targetId of targets) {
        await client.query(
          `INSERT INTO notifications
             (user_id, workspace_id, type, title, message,
              entity_type, entity_id, metadata)
           VALUES ($1, $2, 'mention', $3, $4, 'planning_item', $5, $6::jsonb)`,
          [
            targetId,
            item.workspace_id,
            'Você foi mencionado em um comentário',
            `${authorName} mencionou você em um comentário`,
            data.planning_item_id,
            metadata,
          ],
        );
      }
    }
    await client.query('COMMIT');
    return { ok: true, comment, id: comment.id };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});
