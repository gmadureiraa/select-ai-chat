// Atualiza um ai_workflow (Madureira-style). Auth: super_admin OR
// owner/admin do workspace dono do workflow. Cobre name/description/cron/
// is_active/config jsonb. Cada campo é opcional — só atualiza o que vier.
//
// Uso: chamado pelo AiWorkflowEditor.tsx (admin tab).
import { z } from 'zod';
import { authedPost } from '../_lib/handler.js';
import { getPool, queryOne } from '../_lib/db.js';

const BodySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  schedule_cron: z.string().min(5).max(120).optional(),
  is_active: z.boolean().optional(),
  config: z.record(z.unknown()).optional(),
});

const JSONB_FIELDS = new Set(['config']);

export default authedPost(async ({ body, user }) => {
  const parsed = BodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join('; '));
  }
  const data = parsed.data;
  const pool = getPool();

  // Verifica acesso (workspace owner/admin OR super_admin)
  const access = await queryOne<{ ok: boolean; workspace_id: string }>(
    `SELECT TRUE AS ok, w.workspace_id
       FROM ai_workflows w
       LEFT JOIN workspace_members wm
         ON wm.workspace_id = w.workspace_id
        AND wm.user_id = $2
        AND wm.role IN ('owner', 'admin')
      WHERE w.id = $1
        AND (
          wm.id IS NOT NULL
          OR EXISTS (SELECT 1 FROM super_admins WHERE user_id = $2)
        )
      LIMIT 1`,
    [data.id, user.id],
  );
  if (!access?.ok) {
    throw new Error('Workflow não encontrado ou acesso negado');
  }

  // Validação leve do cron — 5 segmentos separados por espaço
  if (data.schedule_cron !== undefined) {
    const parts = data.schedule_cron.trim().split(/\s+/);
    if (parts.length < 5) {
      throw new Error('schedule_cron inválido — esperado 5 segmentos (min hour dom month dow)');
    }
  }

  // Monta SET clause dinâmico
  const updates: string[] = [];
  const params: any[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (key === 'id') continue;
    if (value === undefined) continue;
    params.push(JSONB_FIELDS.has(key) ? JSON.stringify(value) : value);
    const cast = JSONB_FIELDS.has(key) ? '::jsonb' : '';
    updates.push(`"${key}" = $${params.length}${cast}`);
  }

  if (updates.length === 0) {
    throw new Error('Nada pra atualizar — passe ao menos um campo');
  }

  updates.push(`updated_at = NOW()`);
  params.push(data.id);
  const idIdx = params.length;

  const r = await pool.query(
    `UPDATE ai_workflows SET ${updates.join(', ')}
      WHERE id = $${idIdx}
      RETURNING id, workspace_id, agent_id, name, description, schedule_cron, config, is_active,
                last_run_at, next_run_at, created_at, updated_at`,
    params,
  );

  return { ok: true, workflow: r.rows[0], id: r.rows[0]?.id };
});
