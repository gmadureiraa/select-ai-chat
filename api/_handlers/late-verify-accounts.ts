// Migrated from supabase/functions/late-verify-accounts/index.ts
// @deprecated 2026-05-08: use `postiz-integrations` (POST com clientId verifica e atualiza).
import { authedPost } from '../_lib/handler.js';
import { getPool, query } from '../_lib/db.js';

const LATE_API_BASE = 'https://getlate.dev/api/v1';

interface VerifyResult {
  platform: string;
  status: 'valid' | 'invalid' | 'deleted' | 'error';
  message?: string;
}

interface LateAccount {
  _id: string;
  platform: string;
  username?: string;
  displayName?: string;
  status?: string;
  connected?: boolean;
}

export default authedPost(async ({ body }) => {
  const lateApiKey = process.env.LATE_API_KEY;
  if (!lateApiKey) throw new Error('LATE_API_KEY não configurada');
  const { clientId } = body;
  if (!clientId) throw new Error('clientId é obrigatório');

  const credentials = await query<any>(
    `SELECT id, platform, metadata, account_name, is_valid
       FROM client_social_credentials
      WHERE client_id = $1 AND platform != 'late_profile'`,
    [clientId]
  );

  const profileAccounts: Map<string, any[]> = new Map();
  for (const credential of credentials || []) {
    const meta = credential.metadata as any;
    const lateProfileId = meta?.late_profile_id;
    if (lateProfileId) {
      if (!profileAccounts.has(lateProfileId)) profileAccounts.set(lateProfileId, []);
      profileAccounts.get(lateProfileId)!.push(credential);
    }
  }

  const results: VerifyResult[] = [];
  const pool = getPool();

  for (const [profileId, profileCredentials] of profileAccounts) {
    try {
      const r = await fetch(`${LATE_API_BASE}/accounts?profileId=${profileId}`, {
        headers: { Authorization: `Bearer ${lateApiKey}`, 'Content-Type': 'application/json' },
      });
      if (r.status === 404) {
        for (const credential of profileCredentials) {
          await pool.query(`DELETE FROM client_social_credentials WHERE id = $1`, [credential.id]);
          results.push({ platform: credential.platform, status: 'deleted', message: 'Conta removida (perfil não existe mais)' });
        }
        continue;
      }
      if (!r.ok) {
        for (const credential of profileCredentials) {
          results.push({ platform: credential.platform, status: 'error', message: `Erro: ${r.status}` });
        }
        continue;
      }
      const data = await r.json();
      const lateAccounts: LateAccount[] = data.accounts || [];

      for (const credential of profileCredentials) {
        const meta = credential.metadata as any;
        const lateAccountId = meta?.late_account_id;
        if (!lateAccountId) continue;
        const matching = lateAccounts.find((a) => a._id === lateAccountId);
        if (!matching) {
          await pool.query(`DELETE FROM client_social_credentials WHERE id = $1`, [credential.id]);
          results.push({ platform: credential.platform, status: 'deleted', message: 'Conta removida' });
        } else {
          const isExplicitlyDisconnected =
            matching.status === 'disconnected' || matching.status === 'expired' || matching.status === 'revoked' || matching.connected === false;
          const isConnected = !isExplicitlyDisconnected;
          if (credential.is_valid !== isConnected) {
            await pool.query(
              `UPDATE client_social_credentials
                  SET is_valid = $1, last_validated_at = NOW(), validation_error = $2, account_name = $3
                WHERE id = $4`,
              [
                isConnected,
                isConnected ? null : 'Conta desconectada no Late API',
                matching.displayName || matching.username || credential.account_name,
                credential.id,
              ]
            );
          }
          results.push({ platform: credential.platform, status: isConnected ? 'valid' : 'invalid', message: isConnected ? 'Conta válida' : 'Conta desconectada' });
        }
      }
    } catch (err) {
      for (const credential of profileCredentials) {
        results.push({ platform: credential.platform, status: 'error', message: err instanceof Error ? err.message : 'Erro' });
      }
    }
  }

  for (const credential of credentials || []) {
    const meta = credential.metadata as any;
    if (!meta?.late_profile_id) {
      if (meta?.late_account_id) {
        results.push({ platform: credential.platform, status: 'error', message: 'Credencial incompleta - reconecte' });
      }
    }
  }

  return {
    success: true,
    clientId,
    results,
    deletedCount: results.filter((r) => r.status === 'deleted').length,
    invalidCount: results.filter((r) => r.status === 'invalid').length,
  };
});
