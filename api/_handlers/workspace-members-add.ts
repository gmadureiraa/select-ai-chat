// Adiciona membro ao workspace via invite (cria workspace_invites + dispara
// email se RESEND_API_KEY configurado). Auth: só owner/admin do workspace.
//
// Uso: chamado pela tool addWorkspaceMember do KAI Chat e pelo dashboard
// admin do workspace.
import { z } from 'zod';
import { authedPost } from '../_lib/handler.js';
import { getPool, queryOne } from '../_lib/db.js';

const BodySchema = z.object({
  workspace_id: z.string().uuid().optional(),
  email: z.string().email(),
  role: z.enum(['owner', 'admin', 'member']).default('member'),
  expires_in_days: z.number().int().min(1).max(60).optional(),
});

export default authedPost(async ({ body, user }) => {
  const parsed = BodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join('; '));
  }
  const data = parsed.data;
  const pool = getPool();

  // Resolve workspace via membership do user (se não foi explícito)
  let workspaceId = data.workspace_id ?? null;
  if (!workspaceId) {
    const w = await queryOne<{ workspace_id: string }>(
      `SELECT workspace_id FROM workspace_members
        WHERE user_id = $1 AND role IN ('owner', 'admin')
        ORDER BY created_at DESC
        LIMIT 1`,
      [user.id],
    );
    workspaceId = w?.workspace_id ?? null;
  }
  if (!workspaceId) {
    throw new Error('Sem workspace associado ou sem permissão de admin');
  }

  // Verifica que é owner/admin do workspace (ou super_admin).
  const access = await queryOne<{ ok: boolean }>(
    `SELECT TRUE AS ok
       FROM workspace_members
      WHERE workspace_id = $1
        AND user_id = $2
        AND role IN ('owner', 'admin')
      UNION ALL
      SELECT TRUE AS ok
       FROM super_admins WHERE user_id = $2
      LIMIT 1`,
    [workspaceId, user.id],
  );
  if (!access?.ok) {
    throw new Error('Sem permissão (precisa ser owner/admin do workspace)');
  }

  const expiresDays = data.expires_in_days ?? 7;

  // Cria invite (upsert por workspace_id + email).
  const r = await pool.query(
    `INSERT INTO workspace_invites (workspace_id, email, role, invited_by, expires_at)
     VALUES ($1, $2, $3, $4, NOW() + ($5 || ' days')::interval)
     ON CONFLICT (workspace_id, email)
     DO UPDATE SET role = EXCLUDED.role,
                   invited_by = EXCLUDED.invited_by,
                   expires_at = EXCLUDED.expires_at,
                   accepted_at = NULL
     RETURNING id, workspace_id, email, role, expires_at, created_at`,
    [workspaceId, data.email.toLowerCase(), data.role, user.id, String(expiresDays)],
  );

  return { ok: true, invite: r.rows[0], id: r.rows[0]?.id };
});
