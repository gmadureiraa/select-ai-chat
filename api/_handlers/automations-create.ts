// Cria planning_automations. Endpoint dedicado pra ferramenta createAutomation
// do KAI Chat. Triggers suportados: schedule (cron-like via {type, days, time}),
// rss ({url, last_guid?}), webhook (placeholder, ainda sem dispatcher).
import { z } from 'zod';
import { authedPost } from '../_lib/handler.js';
import { getPool, queryOne } from '../_lib/db.js';
import { assertWorkspaceAccess, assertClientAccess } from '../_lib/access.js';

const ScheduleSchema = z
  .object({
    type: z.enum(['daily', 'weekly', 'monthly']).optional(),
    days: z.array(z.number().int()).optional(),
    time: z.string().optional(),
    cron: z.string().optional(),
  })
  .partial();

const RSSConfigSchema = z
  .object({
    url: z.string().url(),
    last_guid: z.string().optional(),
  })
  .partial();

const WebhookConfigSchema = z
  .object({
    secret: z.string().optional(),
  })
  .partial();

const TriggerConfigSchema = z.union([
  ScheduleSchema,
  RSSConfigSchema,
  WebhookConfigSchema,
  z.record(z.unknown()),
]);

const BodySchema = z.object({
  name: z.string().min(1).max(200),
  trigger_type: z.enum(['schedule', 'rss', 'webhook']),
  trigger_config: TriggerConfigSchema.default({}),
  client_id: z.string().uuid().nullable().optional(),
  workspace_id: z.string().uuid().optional(),
  target_column_id: z.string().uuid().nullable().optional(),
  platform: z.string().max(40).optional(),
  platforms: z.array(z.string()).optional(),
  content_type: z.string().max(40).default('social_post'),
  prompt_template: z.string().max(20000).optional(),
  auto_generate_content: z.boolean().default(true),
  auto_generate_image: z.boolean().default(false),
  image_prompt_template: z.string().max(5000).optional(),
  image_style: z
    .enum(['photographic', 'illustration', 'minimalist', 'vibrant'])
    .nullable()
    .optional(),
  auto_publish: z.boolean().default(false),
  status_after_generation: z.enum(['idea', 'draft', 'approved']).default('idea'),
  is_active: z.boolean().default(true),
});

export default authedPost(async ({ body, user }) => {
  const parsed = BodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join('; '));
  }
  const data = parsed.data;
  const pool = getPool();

  // Resolve workspace.
  // SECURITY: workspace_id explícito DEVE ser validado (assertWorkspaceAccess).
  // Sem isso, qualquer user logado podia criar planning_automation em workspace
  // alheio, drenando custos/triggando crons cross-tenant.
  let workspaceId = data.workspace_id ?? null;
  if (workspaceId) {
    // Automation requer role admin/owner (mesmo padrão do toggle/delete).
    await assertWorkspaceAccess(user.id, workspaceId, ['owner', 'admin']);
  }

  // client_id explícito → checa acesso e deriva workspace dele.
  if (data.client_id) {
    const access = await assertClientAccess(user.id, data.client_id);
    if (workspaceId && access.workspaceId !== workspaceId) {
      throw new Error('client_id não pertence ao workspace alvo');
    }
    workspaceId = workspaceId ?? access.workspaceId;
  }

  // Fallback: usa workspace mais recente do user (precisa ser admin/owner).
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
    throw new Error('Sem workspace associado pra criar automation (precisa ser admin/owner)');
  }

  // target_column_id deve estar no workspace alvo (evita IDOR cross-workspace).
  if (data.target_column_id) {
    const col = await queryOne<{ workspace_id: string }>(
      `SELECT workspace_id FROM kanban_columns WHERE id = $1 LIMIT 1`,
      [data.target_column_id],
    );
    if (!col || col.workspace_id !== workspaceId) {
      throw new Error('target_column_id não pertence ao workspace');
    }
  }

  // Resolve target column (default = is_default true OR primeira coluna)
  let columnId = data.target_column_id ?? null;
  if (!columnId) {
    const col = await queryOne<{ id: string }>(
      `SELECT id FROM kanban_columns
         WHERE workspace_id = $1
         ORDER BY (is_default IS TRUE) DESC, position ASC
         LIMIT 1`,
      [workspaceId],
    );
    columnId = col?.id ?? null;
  }

  const r = await pool.query(
    `INSERT INTO planning_automations
       (workspace_id, client_id, name, is_active,
        trigger_type, trigger_config,
        target_column_id, platform, content_type,
        auto_generate_content, prompt_template,
        auto_publish, status_after_generation,
        auto_generate_image, image_prompt_template, image_style,
        platforms, created_by)
     VALUES ($1, $2, $3, $4,
             $5, $6::jsonb,
             $7, $8, $9,
             $10, $11,
             $12, $13,
             $14, $15, $16,
             $17::text[], $18)
     RETURNING id, name, trigger_type, is_active, created_at`,
    [
      workspaceId,
      data.client_id ?? null,
      data.name,
      data.is_active,
      data.trigger_type,
      JSON.stringify(data.trigger_config ?? {}),
      columnId,
      data.platform ?? null,
      data.content_type,
      data.auto_generate_content,
      data.prompt_template ?? null,
      data.auto_publish,
      data.status_after_generation,
      data.auto_generate_image,
      data.image_prompt_template ?? null,
      data.image_style ?? null,
      data.platforms ?? null,
      user.id,
    ],
  );

  return { ok: true, automation: r.rows[0], id: r.rows[0]?.id };
});
