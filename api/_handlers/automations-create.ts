// Cria planning_automations. Endpoint dedicado pra ferramenta createAutomation
// do KAI Chat. Triggers suportados: schedule (cron-like via {type, days, time}),
// rss ({url, last_guid?}), webhook (placeholder, ainda sem dispatcher).
import { z } from 'zod';
import { authedPost } from '../_lib/handler.js';
import { getPool, queryOne } from '../_lib/db.js';

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

  // Resolve workspace
  let workspaceId = data.workspace_id ?? null;
  if (!workspaceId) {
    if (data.client_id) {
      const c = await queryOne<{ workspace_id: string }>(
        `SELECT workspace_id FROM clients WHERE id = $1 LIMIT 1`,
        [data.client_id],
      );
      workspaceId = c?.workspace_id ?? null;
    }
  }
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
    throw new Error('Sem workspace associado pra criar automation');
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
