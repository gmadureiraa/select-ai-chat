// late-create-brand
//
// Cria um "profile" (= brand / cliente) no Late/Zernio programaticamente.
// Antes, admin tinha que abrir https://app.getlate.dev manualmente e criar
// um profile à mão antes de poder conectar contas sociais via OAuth.
//
// Pattern de storage segue o canônico do codebase (mesmo que late-oauth-start,
// late-inbox, late-analytics, late-disconnect-account leem):
//
//   client_social_credentials (
//     client_id   = <clientId>,
//     platform    = 'late_profile',
//     account_id  = <profileId Late>,
//     account_name = <client.name>,
//     metadata    = { late_profile_id, late_profile_created_at, created_for_client: true }
//   )
//
// IMPORTANTE: o handler late-oauth-start já faz lazy-create do profile na
// primeira vez que user clica "Conectar nova rede". Este handler aqui é pra
// quando admin quer criar o profile EXPLICITAMENTE via UI antes de conectar
// (ou pra backfill em batch via scripts/backfill-late-profiles.ts).
//
// Base API: https://getlate.dev/api/v1 (Late.ai, rebrand do Zernio)
import { authedPost } from '../_lib/handler.js';
import { getPool, queryOne } from '../_lib/db.js';
import { assertClientAccess } from '../_lib/access.js';

const LATE_API_BASE = 'https://getlate.dev/api';

export default authedPost(async ({ body, user }) => {
  const { clientId, name: nameOverride, timezone: timezoneOverride, force } = body || {};

  if (!clientId) throw new Error('clientId é obrigatório');
  await assertClientAccess(user.id, clientId);

  const LATE_API_KEY = process.env.LATE_API_KEY;
  if (!LATE_API_KEY) throw new Error('LATE_API_KEY não configurada');

  const pool = getPool();

  // 1) Resolve nome do cliente
  const client = await queryOne<{ name: string }>(
    `SELECT name FROM clients WHERE id = $1`,
    [clientId],
  );
  if (!client) throw new Error('Cliente não encontrado');
  const profileName = (nameOverride && String(nameOverride).trim()) || client.name;
  const timezone = (timezoneOverride && String(timezoneOverride).trim()) || 'America/Sao_Paulo';

  // 2) Checa se já existe profile pra esse cliente
  const existing = await queryOne<{ metadata: any; account_id: string | null }>(
    `SELECT metadata, account_id FROM client_social_credentials
      WHERE client_id = $1 AND platform = 'late_profile' LIMIT 1`,
    [clientId],
  );
  const existingProfileId: string | undefined =
    (existing?.metadata as any)?.late_profile_id || existing?.account_id || undefined;

  if (existingProfileId && !force) {
    // Verifica se ainda existe no Late
    const checkResp = await fetch(`${LATE_API_BASE}/v1/profiles/${existingProfileId}`, {
      headers: { Authorization: `Bearer ${LATE_API_KEY}` },
    });
    if (checkResp.ok) {
      return {
        ok: true,
        profileId: existingProfileId,
        name: profileName,
        already_existed: true,
      };
    }
    // Se 404 no Late, continua e cria novo
    if (checkResp.status !== 404) {
      const t = await checkResp.text();
      throw new Error(`Falha ao validar profile existente (HTTP ${checkResp.status}): ${t.substring(0, 200)}`);
    }
    // 404 — apaga credential local stale
    await pool.query(
      `DELETE FROM client_social_credentials WHERE client_id = $1 AND platform = 'late_profile'`,
      [clientId],
    );
  }

  // 3) Lista profiles no Late pra evitar duplicar por nome (idempotência soft)
  let profileId: string | undefined;
  const listResp = await fetch(`${LATE_API_BASE}/v1/profiles`, {
    headers: { Authorization: `Bearer ${LATE_API_KEY}` },
  });
  let existingProfiles: Array<{ _id: string; name: string }> = [];
  if (listResp.ok) {
    const pd = await listResp.json();
    existingProfiles = pd.profiles || [];
  }
  const legacyName = `kai-${String(clientId).substring(0, 8)}`;
  const matched = existingProfiles.find((p) => p.name === profileName || p.name === legacyName);
  if (matched && !force) {
    profileId = matched._id;
  }

  // 4) Cria de fato se não achou
  if (!profileId) {
    const createResp = await fetch(`${LATE_API_BASE}/v1/profiles`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LATE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      // Late aceita { name, timezone, color, description } (timezone documentado
      // como opcional — IANA tz string, default UTC).
      body: JSON.stringify({ name: profileName, timezone }),
    });
    if (!createResp.ok) {
      const errText = await createResp.text();
      // Tratamento amigável pra "Profile limit" (plano Late atingiu cap)
      if (errText.includes('Profile limit') && existingProfiles.length > 0) {
        throw new Error(
          'Limite de perfis atingido no plano Late. Considere fazer upgrade ou liberar slot.',
        );
      }
      throw new Error('Falha ao criar profile no Late: ' + errText.substring(0, 200));
    }
    const created = await createResp.json();
    profileId = created.profile?._id || created._id;
    if (!profileId) {
      throw new Error('Late retornou OK mas sem profile._id: ' + JSON.stringify(created).substring(0, 200));
    }
  }

  // 5) Persiste em client_social_credentials (pattern canônico)
  const now = new Date().toISOString();
  await pool.query(
    `INSERT INTO client_social_credentials
       (client_id, platform, account_id, account_name, metadata, is_valid)
     VALUES ($1, 'late_profile', $2, $3, $4::jsonb, TRUE)
     ON CONFLICT (client_id, platform) DO UPDATE SET
       account_id = EXCLUDED.account_id,
       account_name = EXCLUDED.account_name,
       metadata = EXCLUDED.metadata,
       is_valid = TRUE,
       updated_at = NOW()`,
    [
      clientId,
      profileId,
      profileName,
      JSON.stringify({
        late_profile_id: profileId,
        late_profile_created_at: now,
        created_for_client: true,
        created_via: 'late-create-brand',
      }),
    ],
  );

  return {
    ok: true,
    profileId,
    name: profileName,
    timezone,
    already_existed: false,
  };
});
