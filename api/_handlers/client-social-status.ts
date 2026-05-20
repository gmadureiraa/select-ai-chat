// Lê o profile Late/Zernio + todas as credenciais sociais de um cliente, via
// pool server-side (service-role) pra NÃO depender de RLS/Data API no browser.
// Sintoma que motivou (2026-05-20): Defiverso tinha profile + 5 redes válidas
// no banco, mas a UI lia via supabase.from no browser e a RLS escondia linhas
// (profile aparecia como "não criado", contagem de plataformas errada).
// Auth: user precisa ser membro do workspace dono do cliente (ou super_admin).
import { z } from 'zod';
import { authedPost } from '../_lib/handler.js';
import { query, queryOne } from '../_lib/db.js';

const BodySchema = z.object({
  client_id: z.string().uuid(),
});

type CredRow = {
  id: string;
  client_id: string;
  platform: string;
  is_valid: boolean | null;
  last_validated_at: string | null;
  validation_error: string | null;
  account_name: string | null;
  account_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
};

export default authedPost(async ({ body, user }) => {
  const parsed = BodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join('; '));
  }
  const { client_id } = parsed.data;

  const access = await queryOne<{ workspace_id: string }>(
    `SELECT c.workspace_id
       FROM clients c
       LEFT JOIN workspace_members wm
         ON wm.workspace_id = c.workspace_id AND wm.user_id = $2
      WHERE c.id = $1
        AND (
          wm.id IS NOT NULL
          OR EXISTS (SELECT 1 FROM super_admins WHERE user_id = $2)
        )
      LIMIT 1`,
    [client_id, user.id],
  );
  if (!access) {
    throw new Error('Cliente não encontrado ou acesso negado');
  }

  const rows = await query<CredRow>(
    `SELECT id, client_id, platform, is_valid, last_validated_at, validation_error,
            account_name, account_id, metadata, created_at, updated_at
       FROM client_social_credentials
      WHERE client_id = $1
      ORDER BY created_at ASC`,
    [client_id],
  );

  const profileRow = rows.find((r) => r.platform === 'late_profile') || null;
  const credentials = rows.filter((r) => r.platform !== 'late_profile');

  const profile = profileRow
    ? {
        profileId:
          ((profileRow.metadata?.late_profile_id as string) ||
            profileRow.account_id ||
            null),
        profileName: profileRow.account_name || null,
        createdAt: (profileRow.metadata?.late_profile_created_at as string) || null,
        isValid: Boolean(profileRow.is_valid),
      }
    : null;

  return { ok: true, profile, credentials };
});
