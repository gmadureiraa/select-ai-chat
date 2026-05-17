// Atualiza uma row de client_reference_library (title, content, source_url,
// thumbnail_url, metadata, reference_type). Auth: user precisa ter acesso ao
// cliente dono da reference.
import { z } from 'zod';
import { authedPost } from '../_lib/handler.js';
import { getPool, queryOne } from '../_lib/db.js';

const BodySchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  content: z.string().max(20000).optional(),
  source_url: z.string().url().max(500).nullable().optional(),
  thumbnail_url: z.string().url().max(500).nullable().optional(),
  reference_type: z.string().max(60).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const JSONB_FIELDS = new Set(['metadata']);

export default authedPost(async ({ body, user }) => {
  const parsed = BodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join('; '));
  }
  const data = parsed.data;
  const pool = getPool();

  // SECURITY: sanitizar metadata contra prototype pollution antes de gravar.
  if (data.metadata) {
    const stripPollutionKeys = (val: unknown): unknown => {
      if (Array.isArray(val)) return val.map(stripPollutionKeys);
      if (!val || typeof val !== 'object') return val;
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
        if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
        out[k] = stripPollutionKeys(v);
      }
      return out;
    };
    data.metadata = stripPollutionKeys(data.metadata) as Record<string, unknown>;
  }

  // Verifica acesso (workspace_members do cliente dono ou super_admin)
  const access = await queryOne<{ ok: boolean }>(
    `SELECT TRUE AS ok
       FROM client_reference_library r
       JOIN clients c ON c.id = r.client_id
       LEFT JOIN workspace_members wm
         ON wm.workspace_id = c.workspace_id AND wm.user_id = $2
      WHERE r.id = $1
        AND (
          wm.id IS NOT NULL
          OR EXISTS (SELECT 1 FROM super_admins WHERE user_id = $2)
        )
      LIMIT 1`,
    [data.id, user.id],
  );
  if (!access?.ok) {
    throw new Error('Reference não encontrada ou acesso negado');
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
    `UPDATE client_reference_library SET ${updates.join(', ')}
      WHERE id = $${idIdx}
      RETURNING id, client_id, title, reference_type, source_url, updated_at`,
    params,
  );

  if (r.rows.length === 0) {
    throw new Error('Reference não encontrada');
  }

  return { ok: true, reference: r.rows[0], id: r.rows[0]?.id };
});
