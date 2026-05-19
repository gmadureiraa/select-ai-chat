// Unified "Save to Planning" endpoint shared by SV / Reels / Radar.
// Creates a planning_items row scoped to a workspace+client and (optionally)
// links it back to a viral_carousels / viral_reels row.
import { z } from 'zod';
import { authedPost } from '../_lib/handler.js';
import { query, queryOne, insertRow } from '../_lib/db.js';
import { assertClientAccess, assertWorkspaceAccess } from '../_lib/access.js';

const BodySchema = z.object({
  client_id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  source: z.enum(['sv', 'reels', 'radar']),
  title: z.string().min(1),
  content: z.string().optional(),
  description: z.string().optional(),
  content_type: z
    .enum([
      'carousel',
      'reel_script',
      'static_image',
      'thread',
      'social_post',
      'newsletter',
      'other',
    ])
    .optional(),
  platform: z.string().optional(),
  status: z
    .enum(['idea', 'pending_approval', 'draft', 'review', 'approved', 'scheduled', 'published'])
    .optional(),
  scheduled_at: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  link_to: z
    .object({
      viral_carousel_id: z.string().uuid().optional(),
      viral_reel_id: z.string().uuid().optional(),
    })
    .optional(),
});
type PlanningItemRow = { id: string };

export default authedPost(async ({ user, body, res }) => {
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({
      error: `Invalid input: ${parsed.error.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ')}`,
    });
    return;
  }
  const { client_id, workspace_id, source, link_to, ...rest } = parsed.data;
  // P0 fix audit 2026-05-16: aceitava (client_id, workspace_id) arbitrários
  // e inseria planning_item naquele workspace alheio.
  await assertWorkspaceAccess(user.id, workspace_id);
  const clientAccess = await assertClientAccess(user.id, client_id);
  if (clientAccess.workspaceId !== workspace_id) {
    throw new Error('client_id não pertence ao workspace_id informado');
  }

  if (link_to?.viral_carousel_id) {
    const linkedCarousel = await queryOne<{ id: string }>(
      `SELECT id
         FROM viral_carousels
        WHERE id = $1
          AND client_id = $2
          AND workspace_id = $3
        LIMIT 1`,
      [link_to.viral_carousel_id, client_id, workspace_id],
    );
    if (!linkedCarousel) {
      throw new Error('viral_carousel_id não pertence ao cliente/workspace informado');
    }
  }

  if (link_to?.viral_reel_id) {
    const linkedReel = await queryOne<{ id: string }>(
      `SELECT id
         FROM viral_reels
        WHERE id = $1
          AND client_id = $2
          AND workspace_id = $3
        LIMIT 1`,
      [link_to.viral_reel_id, client_id, workspace_id],
    );
    if (!linkedReel) {
      throw new Error('viral_reel_id não pertence ao cliente/workspace informado');
    }
  }

  // Default content_type per source
  const defaultType =
    source === 'sv'
      ? 'carousel'
      : source === 'reels'
      ? 'reel_script'
      : 'other';
  const defaultStatus =
    rest.status || (source === 'radar' ? 'idea' : 'draft');

  const metadata: Record<string, unknown> = {
    ...(rest.metadata || {}),
    source,
    ...(link_to?.viral_carousel_id && {
      viral_carousel_id: link_to.viral_carousel_id,
    }),
    ...(link_to?.viral_reel_id && {
      viral_reel_id: link_to.viral_reel_id,
    }),
  };

  // Pega a primeira coluna do kanban do workspace pra cair como "draft" no quadro
  const firstColumn = await queryOne<{ id: string }>(
    `SELECT id FROM kanban_columns WHERE workspace_id = $1 ORDER BY position ASC LIMIT 1`,
    [workspace_id]
  );

  const item = await insertRow<PlanningItemRow>('planning_items', {
    workspace_id,
    client_id,
    column_id: firstColumn?.id ?? null,
    title: rest.title,
    content: rest.content ?? null,
    description: rest.description ?? null,
    content_type: rest.content_type || defaultType,
    platform: rest.platform ?? null,
    status: defaultStatus,
    scheduled_at: rest.scheduled_at ?? null,
    metadata: JSON.stringify(metadata),
    created_by: user.id,
  });

  // If linked to a viral_carousel, set the FK on viral_carousels
  if (link_to?.viral_carousel_id) {
    const updated = await query<{ id: string }>(
      `UPDATE viral_carousels
          SET planning_item_id = $1
        WHERE id = $2
          AND client_id = $3
          AND workspace_id = $4
        RETURNING id`,
      [item.id, link_to.viral_carousel_id, client_id, workspace_id]
    );
    if (updated.length !== 1) throw new Error('Falha ao vincular carrossel ao planejamento');
  }

  // If linked to a viral_reel, set the FK on viral_reels
  if (link_to?.viral_reel_id) {
    const updated = await query<{ id: string }>(
      `UPDATE viral_reels
          SET planning_item_id = $1
        WHERE id = $2
          AND client_id = $3
          AND workspace_id = $4
        RETURNING id`,
      [item.id, link_to.viral_reel_id, client_id, workspace_id]
    );
    if (updated.length !== 1) throw new Error('Falha ao vincular reel ao planejamento');
  }

  return { ok: true, planning_item: item };
});
