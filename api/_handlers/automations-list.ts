// Lista planning_automations do workspace do user (ou de um workspace específico).
// Aceita filtros opcionais por status (active/all/paused), platform e client_id.
import { z } from 'zod';
import { authedPost } from '../_lib/handler.js';
import { query, queryOne } from '../_lib/db.js';

const BodySchema = z.object({
  status: z.enum(['active', 'paused', 'all']).optional(),
  platform: z.string().max(40).optional(),
  client_id: z.string().uuid().optional(),
  workspace_id: z.string().uuid().optional(),
  limit: z.number().int().positive().max(100).default(50),
});

export default authedPost(async ({ body, user }) => {
  const parsed = BodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join('; '));
  }
  const data = parsed.data;

  // Resolve workspace
  let workspaceId = data.workspace_id ?? null;
  if (!workspaceId) {
    const w = await queryOne<{ workspace_id: string }>(
      `SELECT workspace_id FROM workspace_members
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 1`,
      [user.id],
    );
    workspaceId = w?.workspace_id ?? null;
  }
  if (!workspaceId) {
    throw new Error('Sem workspace associado ao user');
  }

  const where: string[] = ['workspace_id = $1'];
  const params: any[] = [workspaceId];

  if (data.status === 'active') where.push('is_active = true');
  if (data.status === 'paused') where.push('is_active = false');
  if (data.platform) {
    params.push(data.platform);
    where.push(`(platform = $${params.length} OR $${params.length} = ANY(platforms))`);
  }
  if (data.client_id) {
    params.push(data.client_id);
    where.push(`client_id = $${params.length}`);
  }

  params.push(data.limit);
  const limitIdx = params.length;

  const rows = await query<any>(
    `SELECT id, name, is_active, trigger_type, trigger_config,
            client_id, platform, platforms, content_type,
            auto_publish, status_after_generation,
            auto_generate_image, auto_generate_content,
            target_column_id, last_triggered_at, items_created,
            created_at, updated_at
       FROM planning_automations
      WHERE ${where.join(' AND ')}
      ORDER BY is_active DESC, last_triggered_at DESC NULLS LAST, created_at DESC
      LIMIT $${limitIdx}`,
    params,
  );

  return { ok: true, automations: rows, count: rows.length };
});
