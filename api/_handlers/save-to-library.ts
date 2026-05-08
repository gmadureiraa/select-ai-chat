// Salva item na biblioteca do cliente. Destinos:
//   - references → client_reference_library (refs externas / inspiração)
//   - content    → client_content_library (conteúdo próprio do cliente)
//
// Mapeia format → content_type apropriado.
import { z } from 'zod';
import { authedPost } from '../_lib/handler.js';
import { getPool, queryOne } from '../_lib/db.js';

const BodySchema = z.object({
  client_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  content: z.string().max(10000).optional(),
  source_url: z.string().url().max(500).optional(),
  thumbnail_url: z.string().url().max(500).optional(),
  format: z
    .enum(['carousel', 'reel', 'static', 'tweet', 'thread', 'newsletter', 'article', 'email'])
    .optional(),
  destination: z.enum(['references', 'content']).optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const FORMAT_TO_CONTENT_TYPE: Record<string, string> = {
  carousel: 'carousel',
  reel: 'reel_script',
  static: 'static_image',
  tweet: 'tweet',
  thread: 'thread',
  newsletter: 'newsletter',
  article: 'blog_post',
  email: 'newsletter',
};

export default authedPost(async ({ body, user }) => {
  const parsed = BodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join('; '));
  }
  const data = parsed.data;
  const pool = getPool();

  // Verifica acesso ao cliente
  const access = await queryOne<{ ok: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM clients c
       JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
       WHERE c.id = $1 AND wm.user_id = $2
     ) OR EXISTS (
       SELECT 1 FROM super_admins WHERE user_id = $2
     ) AS ok`,
    [data.client_id, user.id],
  );
  if (!access?.ok) {
    throw new Error('Acesso negado a esse cliente');
  }

  const dest = data.destination ?? 'references';
  const fmt = data.format ?? 'static';
  const contentType = FORMAT_TO_CONTENT_TYPE[fmt] ?? 'other';

  const meta = {
    format: fmt,
    source: 'kai-chat',
    tags: data.tags ?? [],
    ...(data.metadata ?? {}),
  };

  if (dest === 'content') {
    const r = await pool.query(
      `INSERT INTO client_content_library
         (client_id, title, content_type, content, thumbnail_url, content_url, metadata)
       VALUES ($1, $2, $3::content_type, $4, $5, $6, $7::jsonb)
       RETURNING id, title, content_type, created_at`,
      [
        data.client_id,
        data.title,
        contentType,
        data.content ?? '',
        data.thumbnail_url ?? null,
        data.source_url ?? null,
        JSON.stringify(meta),
      ],
    );
    return { ok: true, item: r.rows[0], id: r.rows[0]?.id, destination: 'content' };
  }

  // destination = references
  const r = await pool.query(
    `INSERT INTO client_reference_library
       (client_id, title, reference_type, content, source_url, thumbnail_url, metadata)
     VALUES ($1, $2, 'inspiration', $3, $4, $5, $6::jsonb)
     RETURNING id, title, reference_type, created_at`,
    [
      data.client_id,
      data.title,
      data.content ?? '',
      data.source_url ?? null,
      data.thumbnail_url ?? null,
      JSON.stringify(meta),
    ],
  );
  return { ok: true, item: r.rows[0], id: r.rows[0]?.id, destination: 'references' };
});
