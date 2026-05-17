// Persiste row em import_history depois de import CSV/feed processado.
// Auth: user precisa ter acesso ao cliente.
//
// P0 fix audit 2026-05-17: useKAIExecuteAction.executeUploadMetrics fazia
// supabase.from('import_history').insert sem checar client access. Mesmo com
// RLS via client_workspace_accessible, centralizar no handler garante o check
// no servidor independente de runtime DB role.
import { z } from 'zod';
import { authedPost } from '../_lib/handler.js';
import { getPool } from '../_lib/db.js';
import { assertClientAccess } from '../_lib/access.js';

const BodySchema = z.object({
  client_id: z.string().uuid(),
  platform: z.string().min(1).max(60),
  records_count: z.number().int().min(0).default(0),
  file_name: z.string().max(500).nullable().optional(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']).default('completed'),
  metadata: z.record(z.unknown()).optional(),
});

export default authedPost(async ({ body, user }) => {
  const parsed = BodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join('; '));
  }
  const data = parsed.data;
  await assertClientAccess(user.id, data.client_id);

  const pool = getPool();
  const r = await pool.query(
    `INSERT INTO import_history
       (client_id, platform, records_count, file_name, status, metadata, user_id)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
     RETURNING id, client_id, platform, records_count, status, imported_at`,
    [
      data.client_id,
      data.platform,
      data.records_count,
      data.file_name ?? null,
      data.status,
      JSON.stringify(data.metadata ?? {}),
      user.id,
    ],
  );

  return { ok: true, import: r.rows[0], id: r.rows[0]?.id };
});
