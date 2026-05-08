// Migrated from supabase/functions/late-oauth-start/index.ts
import { authedPost } from '../_lib/handler.js';
import { getPool, queryOne, query } from '../_lib/db.js';

const LATE_API_BASE = 'https://getlate.dev/api';

export default authedPost(async ({ user, body, req }) => {
  const { clientId, platform } = body;
  if (!clientId || !platform) throw new Error('Missing clientId or platform');

  const LATE_API_KEY = process.env.LATE_API_KEY;
  if (!LATE_API_KEY) throw new Error('LATE_API_KEY not configured');

  const pool = getPool();
  const clientData = await queryOne<any>(`SELECT name FROM clients WHERE id = $1`, [clientId]);
  const clientName = clientData?.name || String(clientId).substring(0, 8);

  const clientProfile = await queryOne<any>(
    `SELECT metadata, account_id FROM client_social_credentials WHERE client_id = $1 AND platform = 'late_profile' LIMIT 1`,
    [clientId]
  );
  let profileId: string | undefined = (clientProfile?.metadata as any)?.late_profile_id || clientProfile?.account_id;

  if (profileId) {
    const checkResp = await fetch(`${LATE_API_BASE}/v1/profiles/${profileId}`, {
      headers: { Authorization: `Bearer ${LATE_API_KEY}` },
    });
    if (checkResp.status === 404) {
      await pool.query(`DELETE FROM client_social_credentials WHERE client_id = $1 AND platform = 'late_profile'`, [clientId]);
      await pool.query(`DELETE FROM client_social_credentials WHERE client_id = $1 AND platform != 'late_profile'`, [clientId]);
      profileId = undefined;
    }
  }

  if (!profileId) {
    let existingProfiles: Array<{ _id: string; name: string }> = [];
    const listResp = await fetch(`${LATE_API_BASE}/v1/profiles`, {
      headers: { Authorization: `Bearer ${LATE_API_KEY}` },
    });
    if (listResp.ok) {
      const pd = await listResp.json();
      existingProfiles = pd.profiles || [];
    }
    const legacyName = `kai-${String(clientId).substring(0, 8)}`;
    const existing = existingProfiles.find((p) => p.name === clientName || p.name === legacyName);
    if (existing) {
      profileId = existing._id;
    } else {
      const cr = await fetch(`${LATE_API_BASE}/v1/profiles`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${LATE_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: clientName }),
      });
      if (cr.ok) {
        const np = await cr.json();
        profileId = np.profile?._id;
      } else {
        const errText = await cr.text();
        if (errText.includes('Profile limit') && existingProfiles.length > 0) {
          const assigned = await query<any>(`SELECT metadata FROM client_social_credentials WHERE platform = 'late_profile'`);
          const assignedIds = new Set(assigned.map((p) => (p.metadata as any)?.late_profile_id).filter(Boolean));
          const unassigned = existingProfiles.find((p) => !assignedIds.has(p._id));
          if (unassigned) profileId = unassigned._id;
          else throw new Error('Limite de perfis atingido. Considere fazer upgrade do plano Late API.');
        } else {
          throw new Error('Falha ao criar perfil para o cliente: ' + errText.substring(0, 200));
        }
      }
    }
    if (profileId) {
      await pool.query(
        `INSERT INTO client_social_credentials (client_id, platform, account_id, account_name, metadata, is_valid)
         VALUES ($1, 'late_profile', $2, $3, $4::jsonb, TRUE)
         ON CONFLICT (client_id, platform) DO UPDATE SET
           account_id = EXCLUDED.account_id, account_name = EXCLUDED.account_name,
           metadata = EXCLUDED.metadata, is_valid = TRUE`,
        [clientId, profileId, clientName, JSON.stringify({ late_profile_id: profileId, created_for_client: true })]
      );
    }
  }

  const attempt = await queryOne<any>(
    `INSERT INTO oauth_connection_attempts (client_id, platform, profile_id, created_by, expires_at)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '10 minutes')
     RETURNING *`,
    [clientId, platform, profileId, user.id]
  );

  // Build callback URL — fallback to current host
  const host = (req.headers['x-forwarded-host'] || req.headers.host) as string;
  const proto = (req.headers['x-forwarded-proto'] || 'https') as string;
  const callbackBase = process.env.LATE_OAUTH_CALLBACK_BASE || `${proto}://${host}`;
  const callbackUrl = `${callbackBase}/api/late-oauth-callback?attemptId=${attempt.id}`;

  const connectUrl = new URL(`${LATE_API_BASE}/v1/connect/${platform}`);
  connectUrl.searchParams.set('profileId', profileId!);
  connectUrl.searchParams.set('redirect_url', callbackUrl);

  const lateResponse = await fetch(connectUrl.toString(), {
    headers: { Authorization: `Bearer ${LATE_API_KEY}` },
  });
  if (!lateResponse.ok) {
    const errText = await lateResponse.text();
    await pool.query(`UPDATE oauth_connection_attempts SET error_message = $1 WHERE id = $2`, [errText.substring(0, 500), attempt.id]);
    throw new Error('Falha ao iniciar conexão OAuth: ' + errText.substring(0, 200));
  }
  const lateData = await lateResponse.json();
  return { authUrl: lateData.authUrl, profileId, attemptId: attempt.id };
});
