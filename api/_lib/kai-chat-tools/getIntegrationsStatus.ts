/**
 * Tool `getIntegrationsStatus` — quais integrações de plataforma estão conectadas
 * pro cliente (Instagram, LinkedIn, Twitter, YouTube via Metricool/Postiz/Late
 * ou OAuth direto).
 *
 * Use quando o user perguntar "que contas o cliente tem conectadas?",
 * "tem Instagram ligado?", "preciso conectar LinkedIn?", "status das
 * integrações".
 *
 * Lê `client_social_credentials` que armazena tanto OAuth tokens diretos quanto
 * IDs externos (metricool_blog_id, postiz_integration_id) no JSONB metadata.
 */
import type { RegisteredTool } from './types.js';
import { query, queryOne } from '../db.js';
import { assertToolClientAccess } from './tool-access.js';

interface GetIntegrationsStatusArgs {
  client_id?: string;
}

interface IntegrationOut {
  platform: string;
  isValid: boolean;
  accountName: string | null;
  accountId: string | null;
  provider: string | null;
  hasMetricool: boolean;
  hasPostiz: boolean;
  hasOAuth: boolean;
  lastValidatedAt: string | null;
  validationError: string | null;
  expiresAt: string | null;
}

interface GetIntegrationsStatusData {
  clientId: string;
  clientName: string | null;
  integrations: IntegrationOut[];
  count: number;
  connectedPlatforms: string[];
  missingPlatforms: string[];
}

const KNOWN_PLATFORMS = [
  'instagram',
  'linkedin',
  'twitter',
  'facebook',
  'tiktok',
  'youtube',
  'threads',
];

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

export const getIntegrationsStatusTool: RegisteredTool<
  GetIntegrationsStatusArgs,
  GetIntegrationsStatusData
> = {
  definition: {
    name: 'getIntegrationsStatus',
    description:
      "Lista status das integrações de plataforma conectadas pro cliente (Instagram, LinkedIn, Twitter, YouTube, etc) — via Metricool, Postiz, ou OAuth direto. Use quando o user perguntar 'que contas estão conectadas?', 'tem IG ligado?', 'preciso conectar LinkedIn?', 'quais integrações estão válidas?'.",
    parameters: {
      type: 'object',
      properties: {
        client_id: {
          type: 'string',
          description: 'UUID do cliente. Default: cliente atual.',
        },
      },
      required: [],
    },
  },

  handler: async (args, ctx) => {
    const clientId = String(args.client_id ?? ctx.clientId ?? '').trim();
    if (!clientId) {
      return { ok: false, error: 'client_id obrigatório (nenhum cliente selecionado).' };
    }

    // SECURITY: client_social_credentials guarda OAuth tokens, account IDs,
    // expires_at — vazar isso facilita takeover de contas sociais. Exigir
    // que o user tenha acesso ao cliente antes de listar.
    const guard = await assertToolClientAccess(ctx, clientId);
    if (!guard.ok) return { ok: false, error: guard.error };

    try {
      const c = await queryOne<{ name: string | null }>(
        `SELECT name FROM clients WHERE id = $1 LIMIT 1`,
        [clientId],
      );
      if (!c) return { ok: false, error: 'Cliente não encontrado.' };

      const rows = await query<{
        platform: string;
        is_valid: boolean | null;
        account_name: string | null;
        account_id: string | null;
        last_validated_at: string | null;
        validation_error: string | null;
        expires_at: string | null;
        oauth_access_token: string | null;
        access_token: string | null;
        metadata: unknown;
      }>(
        `SELECT platform, is_valid, account_name, account_id,
                last_validated_at, validation_error, expires_at,
                oauth_access_token, access_token, metadata
           FROM client_social_credentials
          WHERE client_id = $1
          ORDER BY platform ASC, last_validated_at DESC NULLS LAST`,
        [clientId],
      );

      const integrations: IntegrationOut[] = rows.map((r) => {
        const meta = isPlainObject(r.metadata) ? r.metadata : {};
        const provider =
          typeof meta.provider === 'string' ? meta.provider : null;
        const hasMetricool = typeof meta.metricool_blog_id === 'string' && !!meta.metricool_blog_id;
        const hasPostiz =
          typeof meta.postiz_integration_id === 'string' && !!meta.postiz_integration_id;
        const hasOAuth = !!r.oauth_access_token || !!r.access_token;
        return {
          platform: String(r.platform ?? 'unknown'),
          isValid: !!r.is_valid,
          accountName: r.account_name ?? null,
          accountId: r.account_id ?? null,
          provider,
          hasMetricool,
          hasPostiz,
          hasOAuth,
          lastValidatedAt: r.last_validated_at ?? null,
          validationError: r.validation_error ?? null,
          expiresAt: r.expires_at ?? null,
        };
      });

      const connectedPlatforms = Array.from(
        new Set(integrations.filter((i) => i.isValid).map((i) => i.platform)),
      );
      const missingPlatforms = KNOWN_PLATFORMS.filter(
        (p) => !connectedPlatforms.includes(p),
      );

      console.log(
        `[getIntegrationsStatus] client=${clientId} integrations=${integrations.length} connected=${connectedPlatforms.length} missing=${missingPlatforms.length}`,
      );

      return {
        ok: true,
        data: {
          clientId,
          clientName: c.name ?? null,
          integrations,
          count: integrations.length,
          connectedPlatforms,
          missingPlatforms,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[getIntegrationsStatus] error:', err);
      return { ok: false, error: message };
    }
  },
};
