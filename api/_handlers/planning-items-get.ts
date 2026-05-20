// Busca UM planning_item por id (com auth de workspace). Usado pelo
// PlanningBoard pra abrir um card via ?openItem=<id> mesmo quando ele está fora
// do filtro de cliente/status atual (senão `items.find` não acha e o dialog
// nunca abre). 2026-05-20.
import { z } from 'zod';
import { authedPost } from '../_lib/handler.js';
import { queryOne } from '../_lib/db.js';

const BodySchema = z.object({
  id: z.string().uuid(),
});

export default authedPost(async ({ body, user }) => {
  const parsed = BodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join('; '));
  }
  const { id } = parsed.data;

  const item = await queryOne<Record<string, unknown>>(
    `SELECT pi.*
       FROM planning_items pi
       LEFT JOIN workspace_members wm
         ON wm.workspace_id = pi.workspace_id AND wm.user_id = $2
      WHERE pi.id = $1
        AND (
          wm.id IS NOT NULL
          OR EXISTS (SELECT 1 FROM super_admins WHERE user_id = $2)
        )
      LIMIT 1`,
    [id, user.id],
  );
  if (!item) {
    throw new Error('Item não encontrado ou acesso negado');
  }
  return { ok: true, item };
});
