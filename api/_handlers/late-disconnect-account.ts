// Migrated from supabase/functions/late-disconnect-account/index.ts
// @deprecated 2026-05-08: Postiz tem deleteIntegration via `postiz-integrations` (mode TBD)
// e `client_social_credentials` é deletado direto pelo handler de UI. Fallback durante migração.
import { authedPost } from '../_lib/handler.js';
import { getPool, queryOne } from '../_lib/db.js';
import { assertClientAccess } from '../_lib/access.js';

const LATE_API_BASE = 'https://getlate.dev/api/v1';

export default authedPost(async ({ body, user }) => {
  const lateApiKey = process.env.LATE_API_KEY;
  if (!lateApiKey) throw new Error('LATE_API_KEY não configurada');

  const { clientId, platform } = body;
  if (!clientId || !platform) throw new Error('clientId e platform são obrigatórios');
  await assertClientAccess(user.id, clientId);

  const credential = await queryOne<any>(
    `SELECT id, metadata FROM client_social_credentials WHERE client_id = $1 AND platform = $2 LIMIT 1`,
    [clientId, platform]
  );
  if (!credential) {
    return { success: true, message: 'Nenhuma credencial encontrada' };
  }
  const metadata = credential.metadata as Record<string, unknown> | null;
  const lateAccountId = metadata?.late_account_id as string | undefined;
  const lateProfileId = metadata?.late_profile_id as string | undefined;

  if (lateAccountId) {
    try {
      const r = await fetch(`${LATE_API_BASE}/accounts/${lateAccountId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${lateApiKey}`, 'Content-Type': 'application/json' },
      });
      if (!r.ok && r.status !== 404) console.error('Late API delete error', await r.text());
    } catch (e) {
      console.error('Late API delete failed', e);
    }
  } else if (lateProfileId) {
    try {
      const r = await fetch(`${LATE_API_BASE}/profiles/${lateProfileId}/disconnect`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${lateApiKey}`, 'Content-Type': 'application/json' },
      });
      if (!r.ok && r.status !== 404) console.error('Late API disconnect error', await r.text());
    } catch (e) {
      console.error('Late API disconnect failed', e);
    }
  }

  await getPool().query(`DELETE FROM client_social_credentials WHERE id = $1`, [credential.id]);
  return { success: true, platform, deletedFromLate: !!(lateAccountId || lateProfileId) };
});
