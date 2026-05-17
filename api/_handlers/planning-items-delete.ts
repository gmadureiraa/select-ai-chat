// Deleta um planning_item (rascunho/conteúdo). Auth: user precisa ter
// acesso ao cliente dono do item.
//
// Sinaliza no response se o item já tinha sido publicado (was_published),
// pra UI mostrar warning.
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

  // Verifica acesso (via workspace_members do cliente do item ou super_admin)
  const item = await queryOne<{
    id: string;
    title: string;
    status: string;
    client_id: string;
    published_at: string | null;
  }>(
    `SELECT p.id, p.title, p.status, p.client_id, p.published_at
       FROM planning_items p
       JOIN clients c ON c.id = p.client_id
       LEFT JOIN workspace_members wm
         ON wm.workspace_id = c.workspace_id AND wm.user_id = $2
      WHERE p.id = $1
        AND (
          wm.id IS NOT NULL
          OR EXISTS (SELECT 1 FROM super_admins WHERE user_id = $2)
        )
      LIMIT 1`,
    [data.id, user.id],
  );
  if (!item) {
    throw new Error('Item não encontrado ou acesso negado');
  }

  const wasPublished = item.status === 'published' || !!item.published_at;

  const r = await pool.query(
    `DELETE FROM planning_items WHERE id = $1
     RETURNING id, title, status, client_id`,
    [data.id],
  );

  return {
    ok: true,
    deleted: r.rows[0],
    was_published: wasPublished,
    id: r.rows[0]?.id,
  };
});
