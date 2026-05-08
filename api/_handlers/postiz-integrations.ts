// Postiz integrations handler — substitui late-verify-accounts.
//
// Funções:
//   1. Lista todas integrations da conta Postiz (GET /integrations).
//   2. Cruza com `client_social_credentials` do clientId informado.
//   3. Marca como invalid (`is_valid=false`) qualquer credencial cuja integration
//      não exista mais ou esteja `disabled=true` no Postiz.
//   4. Retorna shape compatível com late-verify-accounts:
//        { success, clientId, results: [{ platform, status, message }], deletedCount, invalidCount }
//
// Também expõe `mode='list'` pra apenas listar integrations sem cruzar com client (útil pra
// telas de "linkar manualmente integration X ao cliente Y").
import { authedPost } from '../_lib/handler.js';
import { getPool, query } from '../_lib/db.js';
import {
  getPostizConfig,
  listIntegrations,
  POSTIZ_PLATFORM_MAP,
  type PostizIntegration,
} from '../_lib/integrations/postiz.js';

interface VerifyResult {
  platform: string;
  status: 'valid' | 'invalid' | 'deleted' | 'error';
  message?: string;
}

export default authedPost(async ({ body }) => {
  const cfg = getPostizConfig();
  const { clientId, mode = 'verify' } = body;

  // Mode 'list': apenas listar integrations.
  if (mode === 'list') {
    const integrations = await listIntegrations(cfg);
    return {
      success: true,
      integrations: integrations.map((i) => ({
        id: i.id,
        name: i.name,
        identifier: i.identifier,
        picture: i.picture,
        disabled: !!i.disabled,
        profile: i.profile,
      })),
    };
  }

  if (!clientId) throw new Error('clientId é obrigatório');

  const integrations = await listIntegrations(cfg);
  const integrationsById = new Map<string, PostizIntegration>();
  for (const i of integrations) integrationsById.set(i.id, i);

  const credentials = await query<any>(
    `SELECT id, platform, metadata, account_name, is_valid, account_id
       FROM client_social_credentials
      WHERE client_id = $1 AND platform != 'late_profile' AND platform != 'postiz_profile'`,
    [clientId],
  );

  const results: VerifyResult[] = [];
  const pool = getPool();

  for (const cred of credentials || []) {
    const meta = (cred.metadata as any) || {};
    const integrationId =
      meta.postiz_integration_id ||
      meta.late_account_id ||
      cred.account_id;

    if (!integrationId) {
      results.push({
        platform: cred.platform,
        status: 'error',
        message: 'Sem integration_id (reconecte)',
      });
      continue;
    }

    const integration = integrationsById.get(integrationId);
    if (!integration) {
      // Integration sumiu do Postiz — derruba credencial localmente.
      await pool.query(`DELETE FROM client_social_credentials WHERE id = $1`, [cred.id]);
      results.push({
        platform: cred.platform,
        status: 'deleted',
        message: 'Conta removida (não existe mais no Postiz)',
      });
      continue;
    }

    const isValid = !integration.disabled;
    const expectedIdentifier = POSTIZ_PLATFORM_MAP[cred.platform]?.identifier || cred.platform;
    const platformMatches = integration.identifier?.toLowerCase() === expectedIdentifier.toLowerCase();

    if (!platformMatches) {
      results.push({
        platform: cred.platform,
        status: 'error',
        message: `Integration mapeada pra plataforma errada (esperava ${expectedIdentifier}, é ${integration.identifier})`,
      });
      continue;
    }

    if (cred.is_valid !== isValid) {
      await pool.query(
        `UPDATE client_social_credentials
            SET is_valid = $1, last_validated_at = NOW(), validation_error = $2, account_name = $3
          WHERE id = $4`,
        [
          isValid,
          isValid ? null : 'Conta desativada no Postiz',
          integration.name || integration.profile || cred.account_name,
          cred.id,
        ],
      );
    }

    results.push({
      platform: cred.platform,
      status: isValid ? 'valid' : 'invalid',
      message: isValid ? 'Conta válida' : 'Conta desativada',
    });
  }

  return {
    success: true,
    clientId,
    results,
    deletedCount: results.filter((r) => r.status === 'deleted').length,
    invalidCount: results.filter((r) => r.status === 'invalid').length,
  };
});
