// Deleta um cliente. Auth: user precisa ser membro do workspace (qualquer role)
// ou super_admin. ON DELETE CASCADE remove dados dependentes (planning_items,
// client_documents, client_reference_library, etc).
//
// P0 fix audit 2026-05-17: antes useClients.ts deleteClient fazia
// supabase.from('clients').delete().eq('id', id) direto. RLS protegia 99% dos
// casos mas pool serverless rodava como `neondb_owner` que tem BYPASSRLS
// (Backend Infra audit) — qualquer leak de service-role key permitiria delete
// arbitrário. Centralizar no handler com assertClientAccess elimina o vetor.
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

  // Verifica acesso — user precisa ser membro do workspace dono OU super_admin
  const access = await queryOne<{ ok: boolean }>(
    `SELECT TRUE AS ok
       FROM clients c
       LEFT JOIN workspace_members wm
         ON wm.workspace_id = c.workspace_id AND wm.user_id = $2
      WHERE c.id = $1
        AND (
          wm.id IS NOT NULL
          OR EXISTS (SELECT 1 FROM super_admins WHERE user_id = $2)
        )
      LIMIT 1`,
    [data.id, user.id],
  );
  if (!access?.ok) {
    throw new Error('Cliente não encontrado ou acesso negado');
  }

  const r = await pool.query(
    `DELETE FROM clients WHERE id = $1 RETURNING id, name`,
    [data.id],
  );

  if (r.rows.length === 0) {
    throw new Error('Cliente não encontrado');
  }

  return { ok: true, deleted: r.rows[0], id: r.rows[0]?.id };
});
