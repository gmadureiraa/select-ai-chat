// Atualiza campos do cliente (description, context_notes, identity_guide,
// avatar_url, social_media, voice_profile, content_guidelines, tags).
// Cada campo é opcional — só atualiza o que foi enviado.
import { z } from 'zod';
import { authedPost } from '../_lib/handler.js';
import { getPool, queryOne } from '../_lib/db.js';

const BodySchema = z.object({
  client_id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  context_notes: z.string().max(20000).nullable().optional(),
  identity_guide: z.string().max(50000).nullable().optional(),
  content_guidelines: z.string().max(20000).nullable().optional(),
  avatar_url: z.string().url().nullable().optional(),
  social_media: z.record(z.unknown()).optional(),
  voice_profile: z.record(z.unknown()).nullable().optional(),
  // brand_assets armazena logos/colors/fonts (shape new + legacy — ver
  // src/hooks/useBrandAssets.ts pro tipo completo). Aceitamos record solto
  // pra nao quebrar com schema fragmentado documentado no audit.
  brand_assets: z.record(z.unknown()).nullable().optional(),
  // ai_analysis = resultado completo de analyze-client-onboarding.
  ai_analysis: z.record(z.unknown()).nullable().optional(),
  tags: z.union([z.array(z.string()), z.record(z.unknown())]).optional(),
});

const JSONB_FIELDS = new Set([
  'social_media',
  'voice_profile',
  'tags',
  'brand_assets',
  'ai_analysis',
]);

export default authedPost(async ({ body, user }) => {
  const parsed = BodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join('; '));
  }
  const data = parsed.data;
  const pool = getPool();

  // Verifica acesso
  const access = await queryOne<{ ok: boolean }>(
    `SELECT TRUE AS ok
       FROM clients c
       LEFT JOIN workspace_members wm
         ON wm.workspace_id = c.workspace_id AND wm.user_id = $2
      WHERE c.id = $1
        AND (
          wm.id IS NOT NULL
          OR EXISTS (SELECT 1 FROM super_admins WHERE user_id = $2)
        )
      LIMIT 1`,
    [data.client_id, user.id],
  );
  if (!access?.ok) {
    throw new Error('Cliente não encontrado ou acesso negado');
  }

  // Monta SET clause dinâmico
  const updates: string[] = [];
  const params: any[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (key === 'client_id') continue;
    if (value === undefined) continue;
    params.push(JSONB_FIELDS.has(key) ? JSON.stringify(value) : value);
    const cast = JSONB_FIELDS.has(key) ? '::jsonb' : '';
    updates.push(`"${key}" = $${params.length}${cast}`);
  }

  if (updates.length === 0) {
    throw new Error('Nada pra atualizar — passe ao menos um campo');
  }

  updates.push(`updated_at = NOW()`);
  params.push(data.client_id);
  const idIdx = params.length;

  const r = await pool.query(
    `UPDATE clients SET ${updates.join(', ')}
      WHERE id = $${idIdx}
      RETURNING id, name, description, updated_at`,
    params,
  );

  return { ok: true, client: r.rows[0], id: r.rows[0]?.id };
});
