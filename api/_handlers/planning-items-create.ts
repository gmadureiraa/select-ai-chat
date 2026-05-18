// Cria um planning_item no kanban do workspace. Versão mais flexível que
// save-as-planning-item (que assume source viral 'sv'/'reels'/'radar').
// Usado pelo KAI Chat actions e CrossAppActions quando salvando ideias.
//
// Auth: assertClientAccess se client_id presente; assertWorkspaceAccess sempre.
import { z } from 'zod';
import { authedPost } from '../_lib/handler.js';
import { getPool, queryOne } from '../_lib/db.js';
import {
  assertClientAccess,
  assertColumnInWorkspace,
  assertWorkspaceAccess,
} from '../_lib/access.js';

const BodySchema = z.object({
  // Permite restore com id preservado (undo flow). Se omitido, o DB gera.
  id: z.string().uuid().optional(),
  workspace_id: z.string().uuid(),
  client_id: z.string().uuid().nullable().optional(),
  column_id: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(500),
  content: z.string().max(50_000).nullable().optional(),
  description: z.string().max(10_000).nullable().optional(),
  content_type: z.string().max(60).optional(),
  platform: z.string().max(60).nullable().optional(),
  status: z
    .enum([
      'idea', 'pending_approval', 'draft', 'review', 'approved', 'scheduled', 'published',
      'publishing', 'failed', 'todo',
    ])
    .optional(),
  scheduled_at: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  published_at: z.string().nullable().optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  position: z.number().int().min(0).optional(),
  labels: z.array(z.unknown()).optional(),
  media_urls: z.array(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  recurrence_type: z.string().max(40).nullable().optional(),
  recurrence_days: z.unknown().nullable().optional(),
  recurrence_time: z.string().max(20).nullable().optional(),
  recurrence_end_date: z.string().nullable().optional(),
  is_recurrence_template: z.boolean().nullable().optional(),
  external_post_id: z.string().max(200).nullable().optional(),
  error_message: z.string().max(2000).nullable().optional(),
  retry_count: z.number().int().min(0).nullable().optional(),
  added_to_library: z.boolean().nullable().optional(),
  content_library_id: z.string().uuid().nullable().optional(),
  created_by: z.string().uuid().nullable().optional(),
});

export default authedPost(async ({ body, user }) => {
  const parsed = BodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join('; '));
  }
  const data = parsed.data;

  await assertWorkspaceAccess(user.id, data.workspace_id);
  if (data.client_id) {
    const access = await assertClientAccess(user.id, data.client_id);
    if (access.workspaceId !== data.workspace_id) {
      throw new Error('client_id não pertence ao workspace alvo');
    }
  }
  // Sec2: defesa em profundidade — column_id também precisa ser do mesmo workspace.
  if (data.column_id) {
    await assertColumnInWorkspace(data.column_id, data.workspace_id);
  }

  const pool = getPool();

  // Se column_id não foi passado, pega primeira coluna do workspace.
  let columnId = data.column_id ?? null;
  if (!columnId) {
    const col = await queryOne<{ id: string }>(
      `SELECT id FROM kanban_columns
        WHERE workspace_id = $1
        ORDER BY position ASC LIMIT 1`,
      [data.workspace_id],
    );
    columnId = col?.id ?? null;
  }

  // Monta INSERT dinâmico (suporta restore com id preservado)
  const JSONB_KEYS = new Set(['labels', 'media_urls', 'metadata', 'recurrence_days']);
  const cols: string[] = [];
  const params: any[] = [];
  const placeholders: string[] = [];

  const fields: Array<[string, any]> = [
    ['id', data.id],
    ['workspace_id', data.workspace_id],
    ['client_id', data.client_id ?? null],
    ['column_id', columnId],
    ['title', data.title],
    ['content', data.content ?? null],
    ['description', data.description ?? null],
    ['content_type', data.content_type ?? 'social_post'],
    ['platform', data.platform ?? null],
    ['status', data.status ?? 'idea'],
    ['scheduled_at', data.scheduled_at ?? null],
    ['due_date', data.due_date ?? null],
    ['published_at', data.published_at ?? null],
    ['assigned_to', data.assigned_to ?? null],
    ['priority', data.priority ?? 'medium'],
    ['position', data.position ?? 0],
    ['labels', data.labels ?? []],
    ['media_urls', data.media_urls ?? []],
    ['metadata', data.metadata ?? {}],
    ['recurrence_type', data.recurrence_type ?? null],
    ['recurrence_days', data.recurrence_days ?? null],
    ['recurrence_time', data.recurrence_time ?? null],
    ['recurrence_end_date', data.recurrence_end_date ?? null],
    ['is_recurrence_template', data.is_recurrence_template ?? false],
    ['external_post_id', data.external_post_id ?? null],
    ['error_message', data.error_message ?? null],
    ['retry_count', data.retry_count ?? 0],
    ['added_to_library', data.added_to_library ?? false],
    ['content_library_id', data.content_library_id ?? null],
    // created_by sempre forçado pelo auth (ignora se vier do body, exceto
    // restore que pode preservar o original — só super_admin valida tho).
    ['created_by', data.created_by ?? user.id],
  ];

  for (const [key, value] of fields) {
    if (value === undefined) continue;
    cols.push(`"${key}"`);
    params.push(JSONB_KEYS.has(key) ? JSON.stringify(value) : value);
    const cast = JSONB_KEYS.has(key) ? '::jsonb' : '';
    placeholders.push(`$${params.length}${cast}`);
  }

  const r = await pool.query(
    `INSERT INTO planning_items (${cols.join(', ')})
     VALUES (${placeholders.join(', ')})
     RETURNING id, workspace_id, client_id, column_id, title, status, created_at`,
    params,
  );

  return { ok: true, item: r.rows[0], id: r.rows[0]?.id };
});
