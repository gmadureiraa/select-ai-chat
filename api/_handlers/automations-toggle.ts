// Pausa/ativa uma planning_automation. Verifica acesso via workspace_members.
import { z } from 'zod';
import { authedPost } from '../_lib/handler.js';
import { getPool, queryOne } from '../_lib/db.js';

const BodySchema = z.object({
  automation_id: z.string().uuid(),
  enabled: z.boolean(),
});

export default authedPost(async ({ body, user }) => {
  const parsed = BodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join('; '));
  }
  const data = parsed.data;
  const pool = getPool();

  // Verifica acesso (workspace owner/admin OR super_admin) — pause/resume é
  // ação privilegiada porque controla execução automática de IA + custos.
  const access = await queryOne<{ ok: boolean; workspace_id: string; name: string }>(
    `SELECT TRUE AS ok, pa.workspace_id, pa.name
       FROM planning_automations pa
       LEFT JOIN workspace_members wm
         ON wm.workspace_id = pa.workspace_id
        AND wm.user_id = $2
        AND wm.role IN ('owner', 'admin')
      WHERE pa.id = $1
        AND (
          wm.id IS NOT NULL
          OR EXISTS (SELECT 1 FROM super_admins WHERE user_id = $2)
        )
      LIMIT 1`,
    [data.automation_id, user.id],
  );
  if (!access?.ok) {
    throw new Error('Automation não encontrada ou acesso negado');
  }

  const r = await pool.query(
    `UPDATE planning_automations
        SET is_active = $1,
            updated_at = NOW()
      WHERE id = $2
      RETURNING id, name, is_active, updated_at`,
    [data.enabled, data.automation_id],
  );

  return { ok: true, automation: r.rows[0], id: r.rows[0]?.id };
});
