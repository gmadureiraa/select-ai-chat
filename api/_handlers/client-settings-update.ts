// Atualiza preferências/settings do cliente. Aceita um objeto chave/valor
// (settings) que é gravado em client_preferences via upsert.
//
// Cada par (preference_type, client_id) é único — o upsert atualiza
// preference_value quando o type já existe.
import { z } from 'zod';
import { authedPost } from '../_lib/handler.js';
import { getPool, queryOne } from '../_lib/db.js';

const BodySchema = z.object({
  client_id: z.string().uuid(),
  settings: z.record(z.union([z.string(), z.number(), z.boolean(), z.record(z.unknown()), z.array(z.unknown())])),
});

export default authedPost(async ({ body, user }) => {
  const parsed = BodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join('; '));
  }
  const data = parsed.data;
  const pool = getPool();

  // Verifica acesso ao cliente
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

  const updated: Array<{ key: string; value: string }> = [];

  for (const [key, rawValue] of Object.entries(data.settings)) {
    const value = typeof rawValue === 'string' ? rawValue : JSON.stringify(rawValue);
    // Upsert manual: tentar UPDATE primeiro, INSERT se não existir.
    const upd = await pool.query(
      `UPDATE client_preferences
          SET preference_value = $1, updated_at = NOW()
        WHERE client_id = $2 AND preference_type = $3
       RETURNING id`,
      [value, data.client_id, key],
    );
    if (upd.rowCount === 0) {
      await pool.query(
        `INSERT INTO client_preferences (client_id, preference_type, preference_value, confidence)
         VALUES ($1, $2, $3, 1.0)`,
        [data.client_id, key, value],
      );
    }
    updated.push({ key, value });
  }

  return { ok: true, client_id: data.client_id, updated };
});
