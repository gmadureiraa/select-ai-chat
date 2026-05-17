/**
 * Tool `updateClient` — atualiza dados do cliente atual ou de um cliente
 * específico (description, persona/identity_guide, voice_profile, tom, tags).
 */
import { newActionCardId, type KAIActionCard } from './kai-stream.js';
import type { RegisteredTool } from './types.js';
import { buildToolFetchHeaders } from './internal-headers.js';

interface UpdateClientArgs {
  client_id?: string;
  name?: string;
  description?: string;
  context_notes?: string;
  identity_guide?: string;
  content_guidelines?: string;
  avatar_url?: string;
  social_media?: Record<string, unknown>;
  voice_profile?: Record<string, unknown>;
  tags?: string[] | Record<string, unknown>;
}

interface UpdateClientData {
  clientId: string;
  fieldsUpdated: string[];
}

export const updateClientTool: RegisteredTool<UpdateClientArgs, UpdateClientData> = {
  definition: {
    name: 'updateClient',
    description:
      "Atualiza dados do cliente — descrição, contexto, guia de identidade, voice profile, tags, avatar. Use quando o usuário pedir 'atualiza descrição do cliente', 'troca o tom', 'adiciona ao guia de identidade', 'salva isso como persona'. Cliente atual é usado se client_id omitido.",
    parameters: {
      type: 'object',
      properties: {
        client_id: {
          type: 'string',
          description: 'UUID do cliente alvo. Default: cliente atual da conversa.',
        },
        name: { type: 'string', description: 'Renomeia o cliente.' },
        description: { type: 'string', description: 'Descrição curta (até 5000 chars).' },
        context_notes: {
          type: 'string',
          description: 'Notas de contexto longas (até 20k chars).',
        },
        identity_guide: {
          type: 'string',
          description: 'Guia de identidade em markdown — tom, pilares, plataformas (até 50k chars).',
        },
        content_guidelines: {
          type: 'string',
          description: 'Guidelines de conteúdo (formato, estilo, restrições).',
        },
        avatar_url: { type: 'string', description: 'URL pública do avatar/logo do cliente.' },
        social_media: {
          type: 'object',
          description: 'Handles sociais: { instagram: "@x", twitter: "@y", linkedin: "/in/z", ... }.',
        },
        voice_profile: {
          type: 'object',
          description: 'Perfil de voz estruturado: { tone: "...", use: ["..."], avoid: ["..."] }.',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags para classificar o cliente.',
        },
      },
      required: [],
    },
  },

  handler: async (args, ctx) => {
    const clientId = String(args.client_id ?? ctx.clientId ?? '').trim();
    if (!clientId) {
      return { ok: false, error: 'client_id é obrigatório (nenhum cliente selecionado).' };
    }

    const fieldsUpdated = Object.keys(args).filter(
      (k) => k !== 'client_id' && (args as any)[k] !== undefined,
    );
    if (fieldsUpdated.length === 0) {
      return { ok: false, error: 'Passe ao menos um campo pra atualizar.' };
    }

    const res = await fetch(`${ctx.internalBaseUrl}/api/router?slug=client-update`, {
      method: 'POST',
      headers: buildToolFetchHeaders(ctx),
      body: JSON.stringify({ ...args, client_id: clientId }),
    }).catch((err) => {
      console.error('[updateClient] fetch failed:', err);
      return null;
    });

    if (!res || !res.ok) {
      const errText = res ? await res.text().catch(() => '') : 'network';
      return { ok: false, error: `client-update: ${errText.slice(0, 200)}` };
    }

    const json: any = await res.json();
    const name = json?.client?.name ?? '(sem nome)';

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
        title: `Cliente atualizado: ${name}`,
        body: `Campos atualizados: ${fieldsUpdated.join(', ')}`,
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

    return { ok: true, data: { clientId, fieldsUpdated }, card };
  },
};
