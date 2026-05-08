// Cria cliente novo no workspace do user. Retorna o cliente criado.
import { z } from 'zod';
import { authedPost } from '../_lib/handler.js';
import { getPool, queryOne } from '../_lib/db.js';

const BodySchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  context_notes: z.string().max(20000).optional(),
  identity_guide: z.string().max(50000).optional(),
  avatar_url: z.string().url().nullable().optional(),
  social_media: z.record(z.unknown()).optional(),
  tags: z.union([z.array(z.string()), z.record(z.unknown())]).optional(),
  workspace_id: z.string().uuid().optional(),
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
    throw new Error('Sem workspace pra criar cliente');
  } else {
    // Garante que o user pertence ao workspace
    const member = await queryOne<{ id: string }>(
      `SELECT id FROM workspace_members
        WHERE workspace_id = $1 AND user_id = $2 LIMIT 1`,
      [workspaceId, user.id],
    );
    if (!member) {
      const isSuper = await queryOne<{ id: string }>(
        `SELECT user_id AS id FROM super_admins WHERE user_id = $1 LIMIT 1`,
        [user.id],
      );
      if (!isSuper) throw new Error('Você não pertence a esse workspace');
    }
  }

  const r = await pool.query(
    `INSERT INTO clients
       (workspace_id, name, description, context_notes, identity_guide,
        avatar_url, social_media, tags, user_id, created_by)
     VALUES ($1, $2, $3, $4, $5,
             $6, $7::jsonb, $8::jsonb, $9, $10)
     RETURNING id, name, description, avatar_url, created_at`,
    [
      workspaceId,
      data.name,
      data.description ?? null,
      data.context_notes ?? null,
      data.identity_guide ?? null,
      data.avatar_url ?? null,
      JSON.stringify(data.social_media ?? {}),
      JSON.stringify(data.tags ?? {}),
      user.id,
      user.id,
    ],
  );

  return { ok: true, client: r.rows[0], id: r.rows[0]?.id };
});
