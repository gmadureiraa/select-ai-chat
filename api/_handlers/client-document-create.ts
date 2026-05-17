// Cria row em client_documents pra um cliente. Usado depois de upload pro
// Vercel Blob/Supabase Storage — o caller já tem `file_path` resolvido.
// Auth: user precisa ter acesso ao cliente (assertClientAccess).
//
// P0 fix audit 2026-05-17: antes ClientCreationWizardSimplified.tsx fazia
// supabase.from('client_documents').insert direto, bypassando assertClientAccess.
// Qualquer user logado podia inserir document row apontando pra clientId alheio
// (cross-tenant data injection).
//
// Schema (migration 20251129070223 + 20251204145704):
//   id, client_id, name, file_path, file_type (NOT NULL), extracted_content,
//   created_at. Sem created_by nem metadata — manter strict.
import { z } from 'zod';
import { authedPost } from '../_lib/handler.js';
import { getPool } from '../_lib/db.js';
import { assertClientAccess } from '../_lib/access.js';

const BodySchema = z.object({
  client_id: z.string().uuid(),
  name: z.string().min(1).max(500),
  file_type: z.string().min(1).max(200),
  file_path: z.string().min(1).max(2000),
  extracted_content: z.string().max(500_000).nullable().optional(),
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
    `INSERT INTO client_documents
       (client_id, name, file_type, file_path, extracted_content)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, client_id, name, file_type, file_path, created_at`,
    [
      data.client_id,
      data.name,
      data.file_type,
      data.file_path,
      data.extracted_content ?? null,
    ],
  );

  return { ok: true, document: r.rows[0], id: r.rows[0]?.id };
});
