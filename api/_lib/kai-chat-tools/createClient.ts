/**
 * Tool `createClient` — cria cliente novo no workspace via chat.
 * "novo cliente, nome X, descrição Y" no KAI Chat.
 */
import { newActionCardId, type KAIActionCard } from './kai-stream.js';
import type { RegisteredTool } from './types.js';
import { buildToolFetchHeaders } from './internal-headers.js';

interface CreateClientArgs {
  name: string;
  description?: string;
  context_notes?: string;
  identity_guide?: string;
  avatar_url?: string;
  social_media?: Record<string, unknown>;
  tags?: string[] | Record<string, unknown>;
}

interface CreateClientData {
  clientId: string | null;
  name: string;
}

export const createClientTool: RegisteredTool<CreateClientArgs, CreateClientData> = {
  definition: {
    name: 'createClient',
    description:
      "Cria um cliente novo no workspace atual. Use quando o usuário disser 'novo cliente, nome X, nicho Y', 'cria cliente X', 'adiciona cliente'. social_media aceita {instagram, twitter, linkedin, threads, youtube, tiktok, website}.",
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Nome do cliente (1-200 chars).',
        },
        description: {
          type: 'string',
          description: 'Descrição curta (até 5000 chars).',
        },
        context_notes: {
          type: 'string',
          description: 'Notas de contexto detalhadas (até 20k chars).',
        },
        identity_guide: {
          type: 'string',
          description: 'Guia de identidade markdown (tom, pilares, estratégia).',
        },
        avatar_url: {
          type: 'string',
          description: 'URL pública do avatar/logo.',
        },
        social_media: {
          type: 'object',
          description: 'Handles sociais (instagram, twitter, linkedin, etc).',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags para classificar o cliente.',
        },
      },
      required: ['name'],
    },
  },

  handler: async (args, ctx) => {
    const name = String(args.name ?? '').trim();
    if (!name) return { ok: false, error: 'name é obrigatório' };

    const res = await fetch(`${ctx.internalBaseUrl}/api/client-create`, {
      method: 'POST',
      headers: buildToolFetchHeaders(ctx),
      body: JSON.stringify({
        name,
        description: args.description,
        context_notes: args.context_notes,
        identity_guide: args.identity_guide,
        avatar_url: args.avatar_url,
        social_media: args.social_media,
        tags: args.tags,
      }),
    }).catch((err) => {
      console.error('[createClient] fetch failed:', err);
      return null;
    });

    if (!res || !res.ok) {
      const errText = res ? await res.text().catch(() => '') : 'network';
      return { ok: false, error: `client-create: ${errText.slice(0, 200)}` };
    }

    const json: any = await res.json();
    const clientId: string | null = json?.id ?? json?.client?.id ?? null;

    const card: KAIActionCard = {
      id: newActionCardId(),
      planning_item_id: null,
      type: 'draft',
      status: 'done',
      data: {
        kind: 'draft',
        clientId: clientId ?? ctx.clientId,
        platform: 'client',
        format: 'client',
        title: `Cliente criado: ${name}`,
        body: args.description ?? '',
        briefing: name,
        avatarUrl: args.avatar_url,
      },
      requires_approval: false,
      available_actions: [
        {
          id: 'view_client',
          label: 'Abrir cliente',
          variant: 'primary',
          client_action: 'edit',
        },
        clientId
          ? {
              id: 'set_context',
              label: 'Adicionar contexto',
              variant: 'secondary',
              tool_call: {
                name: 'updateClient',
                args: { client_id: clientId },
              },
            }
          : null,
      ].filter(Boolean) as any[],
    };

    return { ok: true, data: { clientId, name }, card };
  },
};
