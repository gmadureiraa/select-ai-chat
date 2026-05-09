// Atualiza um ai_agent. Auth: super_admin OR owner/admin do workspace.
// Cobre skill_id/knowledge_base/sub_agents/model/is_active/description.
//
// Uso: chamado pelo AiAgentEditor.tsx (admin tab).
import { z } from 'zod';
import { authedPost } from '../_lib/handler.js';
import { getPool, queryOne } from '../_lib/db.js';

const BodySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  skill_id: z.string().max(120).nullable().optional(),
  knowledge_base: z.record(z.unknown()).optional(),
  sub_agents: z.record(z.unknown()).optional(),
  model: z.string().max(80).nullable().optional(),
  is_active: z.boolean().optional(),
});

const JSONB_FIELDS = new Set(['knowledge_base', 'sub_agents']);

export default authedPost(async ({ body, user }) => {
  const parsed = BodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join('; '));
  }
  const data = parsed.data;
  const pool = getPool();

  const access = await queryOne<{ ok: boolean }>(
    `SELECT TRUE AS ok
       FROM ai_agents a
       LEFT JOIN workspace_members wm
         ON wm.workspace_id = a.workspace_id
        AND wm.user_id = $2
        AND wm.role IN ('owner', 'admin')
      WHERE a.id = $1
        AND (
          wm.id IS NOT NULL
          OR EXISTS (SELECT 1 FROM super_admins WHERE user_id = $2)
        )
      LIMIT 1`,
    [data.id, user.id],
  );
  if (!access?.ok) {
    throw new Error('Agent não encontrado ou acesso negado');
  }

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
    `UPDATE ai_agents SET ${updates.join(', ')}
      WHERE id = $${idIdx}
      RETURNING id, workspace_id, name, description, skill_id, knowledge_base,
                sub_agents, model, is_active, created_at, updated_at`,
    params,
  );

  return { ok: true, agent: r.rows[0], id: r.rows[0]?.id };
});
