/**
 * Tool `saveToLibrary` — salva conteúdo/ref na biblioteca do cliente atual
 * (`client_reference_library` se for ref externa, ou `client_content_library`
 * se for conteúdo gerado/próprio).
 */
import { newActionCardId, type KAIActionCard } from './kai-stream.js';
import type { RegisteredTool } from './types.js';

interface SaveToLibraryArgs {
  title: string;
  content?: string;
  url?: string;
  thumbnailUrl?: string;
  format?: 'carousel' | 'reel' | 'static' | 'tweet' | 'thread' | 'newsletter' | 'article';
  destination?: 'references' | 'content';
  tags?: string[];
}

interface SaveToLibraryData {
  itemId: string | null;
  destination: string;
}

export const saveToLibraryTool: RegisteredTool<
  SaveToLibraryArgs,
  SaveToLibraryData
> = {
  definition: {
    name: 'saveToLibrary',
    description:
      'Salva conteúdo na biblioteca do cliente atual. Use quando o usuário pedir: "salva isso pra mim", "guarda essa ref", "adiciona à biblioteca". destination=references (default) salva como inspiração externa. destination=content salva como conteúdo próprio do cliente. Adiciona format tag pra organização.',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Título descritivo curto.',
        },
        content: {
          type: 'string',
          description: 'Texto/caption/conteúdo principal.',
        },
        url: {
          type: 'string',
          description: 'URL original (post Instagram, artigo, etc).',
        },
        thumbnailUrl: {
          type: 'string',
          description: 'URL da imagem de thumbnail.',
        },
        format: {
          type: 'string',
          enum: ['carousel', 'reel', 'static', 'tweet', 'thread', 'newsletter', 'article'],
          description: 'Formato do conteúdo. Default: static.',
        },
        destination: {
          type: 'string',
          enum: ['references', 'content'],
          description: 'references = inspiração externa. content = conteúdo próprio. Default: references.',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags pra organização.',
        },
      },
      required: ['title'],
    },
  },

  handler: async (args, ctx) => {
    if (!ctx.clientId) {
      return { ok: false, error: 'Selecione um cliente primeiro' };
    }

    const title = String(args.title ?? '').trim();
    if (!title) return { ok: false, error: 'title obrigatório' };

    const destination = args.destination ?? 'references';
    const format = args.format ?? 'static';

    const res = await fetch(`${ctx.internalBaseUrl}/api/save-to-library`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ctx.accessToken}`,
      },
      body: JSON.stringify({
        client_id: ctx.clientId,
        title,
        content: args.content ?? '',
        source_url: args.url,
        thumbnail_url: args.thumbnailUrl,
        format,
        destination,
        tags: args.tags ?? [],
      }),
    }).catch((err) => {
      console.error('[saveToLibrary] fetch failed:', err);
      return null;
    });

    if (!res || !res.ok) {
      const errText = res ? await res.text().catch(() => '') : 'network';
      return { ok: false, error: `save-to-library: ${errText.slice(0, 200)}` };
    }

    const json: any = await res.json();
    const itemId: string | null = json?.id ?? json?.item?.id ?? null;

    const card: KAIActionCard = {
      id: newActionCardId(),
      planning_item_id: null,
      type: 'library_match',
      status: 'done',
      data: {
        kind: 'library_match',
        clientId: ctx.clientId,
        title,
        format,
        destination,
        url: args.url,
        thumbnailUrl: args.thumbnailUrl,
      } as Record<string, unknown>,
      requires_approval: false,
      available_actions: [
        {
          id: 'view_in_library',
          label: 'Abrir biblioteca',
          variant: 'primary',
          client_action: 'edit',
        },
      ],
    };

    return {
      ok: true,
      data: { itemId, destination },
      card,
    };
  },
};
