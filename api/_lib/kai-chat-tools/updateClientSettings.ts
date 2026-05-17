/**
 * Tool `updateClientSettings` — atualiza preferências/settings genéricos do
 * cliente em `client_preferences`. Cada par (preference_type, client_id) é
 * único — o handler faz upsert.
 *
 * Diferente de updateClient (que mexe em campos estruturados da row de
 * clients), aqui é um key/value bag pra flags variadas (notifications,
 * defaults, toggles, etc).
 */
import { newActionCardId, type KAIActionCard } from './kai-stream.js';
import type { RegisteredTool } from './types.js';
import { buildToolFetchHeaders } from './internal-headers.js';

interface UpdateClientSettingsArgs {
  client_id?: string;
  settings: Record<string, string | number | boolean | Record<string, unknown> | unknown[]>;
}

interface UpdateClientSettingsData {
  clientId: string;
  updatedKeys: string[];
}

export const updateClientSettingsTool: RegisteredTool<
  UpdateClientSettingsArgs,
  UpdateClientSettingsData
> = {
  definition: {
    name: 'updateClientSettings',
    description:
      'Atualiza preferências/settings genéricos do cliente (key/value bag). Use quando o usuário pedir "salva como minha preferência X = Y", "muda default de plataforma pra IG", "liga notificações", "desliga aviso de prazo". Faz upsert em client_preferences.',
    parameters: {
      type: 'object',
      properties: {
        client_id: {
          type: 'string',
          description: 'UUID do cliente. Default: cliente atual.',
        },
        settings: {
          type: 'object',
          description:
            'Objeto key/value de preferências. Ex: { "default_platform": "instagram", "notifications_enabled": true, "tone_override": "informal" }.',
        },
      },
      required: ['settings'],
    },
  },

  handler: async (args, ctx) => {
    const clientId = String(args.client_id ?? ctx.clientId ?? '').trim();
    if (!clientId) {
      return { ok: false, error: 'client_id obrigatório (nenhum cliente selecionado)' };
    }

    const settings = args.settings ?? {};
    const keys = Object.keys(settings);
    if (keys.length === 0) {
      return { ok: false, error: 'settings vazio — passe ao menos uma chave' };
    }

    const res = await fetch(`${ctx.internalBaseUrl}/api/router?slug=client-settings-update`, {
      method: 'POST',
      headers: buildToolFetchHeaders(ctx),
      body: JSON.stringify({ client_id: clientId, settings }),
    }).catch((err) => {
      console.error('[updateClientSettings] fetch failed:', err);
      return null;
    });

    if (!res || !res.ok) {
      const errText = res ? await res.text().catch(() => '') : 'network';
      return { ok: false, error: `client-settings-update: ${errText.slice(0, 200)}` };
    }

    const card: KAIActionCard = {
      id: newActionCardId(),
      planning_item_id: null,
      type: 'draft',
      status: 'done',
      data: {
        kind: 'draft',
        clientId,
        platform: 'client',
        format: 'client',
        title: 'Settings atualizadas',
        body: `Chaves atualizadas: ${keys.join(', ')}`,
        briefing: clientId,
      },
      requires_approval: false,
      available_actions: [
        {
          id: 'view_client',
          label: 'Ver cliente',
          variant: 'primary',
          client_action: 'edit',
        },
      ],
    };

    return { ok: true, data: { clientId, updatedKeys: keys }, card };
  },
};
