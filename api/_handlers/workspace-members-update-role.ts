// Atualiza role de um membro do workspace. Auth: owner do workspace (admin
// não pode promover/rebaixar outros admins/owners). Não pode rebaixar o
// último owner.
import { z } from 'zod';
import { authedPost } from '../_lib/handler.js';
import { getPool, queryOne } from '../_lib/db.js';

const BodySchema = z.object({
  workspace_id: z.string().uuid(),
  user_id: z.string().uuid().optional(),
  member_id: z.string().uuid().optional(),
  role: z.enum(['owner', 'admin', 'member']),
});

export default authedPost(async ({ body, user }) => {
  const parsed = BodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join('; '));
  }
  const data = parsed.data;
  if (!data.user_id && !data.member_id) {
    throw new Error('Passe user_id ou member_id');
  }
  const pool = getPool();

  // Verifica que é owner (ou super_admin)
  const access = await queryOne<{ ok: boolean }>(
    `SELECT TRUE AS ok
       FROM workspace_members
      WHERE workspace_id = $1
        AND user_id = $2
        AND role = 'owner'
      UNION ALL
      SELECT TRUE AS ok
       FROM super_admins WHERE user_id = $2
      LIMIT 1`,
    [data.workspace_id, user.id],
  );
  if (!access?.ok) {
    throw new Error('Sem permissão (só owner pode mudar roles)');
  }

  // Descobre o member alvo
  const target = await queryOne<{ id: string; user_id: string; role: string }>(
    data.member_id
      ? `SELECT id, user_id, role FROM workspace_members WHERE id = $1 AND workspace_id = $2`
      : `SELECT id, user_id, role FROM workspace_members WHERE workspace_id = $2 AND user_id = $1`,
    data.member_id ? [data.member_id, data.workspace_id] : [data.user_id, data.workspace_id],
  );
  if (!target) {
    throw new Error('Membro não encontrado nesse workspace');
  }

  // Se vai rebaixar um owner, garantir que não é o último
  if (target.role === 'owner' && data.role !== 'owner') {
    const ownerCount = await queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count FROM workspace_members
        WHERE workspace_id = $1 AND role = 'owner'`,
      [data.workspace_id],
    );
    if (Number(ownerCount?.count ?? 0) <= 1) {
      throw new Error('Não pode rebaixar o último owner do workspace');
    }
  }

  const r = await pool.query(
    `UPDATE workspace_members SET role = $1
      WHERE id = $2
      RETURNING id, workspace_id, user_id, role`,
    [data.role, target.id],
  );

  return { ok: true, member: r.rows[0], id: r.rows[0]?.id };
});
