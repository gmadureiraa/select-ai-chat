/**
 * Tool `addReference` — adiciona ref (texto/visual) à library do cliente
 * (client_reference_library). Alias semântico do saveToLibrary com
 * destination='references' já hardcoded — pra LLM ter intent mais claro.
 */
import { newActionCardId, type KAIActionCard } from './kai-stream.js';
import type { RegisteredTool } from './types.js';
import { buildToolFetchHeaders } from './internal-headers.js';

interface AddReferenceArgs {
  title: string;
  content?: string;
  source_url?: string;
  thumbnail_url?: string;
  reference_type?: 'inspiration' | 'carousel' | 'reel' | 'static' | 'tweet' | 'thread' | 'newsletter' | 'article';
  tags?: string[];
  client_id?: string;
}

interface AddReferenceData {
  referenceId: string | null;
}

const FORMAT_FALLBACK_MAP: Record<string, string> = {
  inspiration: 'static',
  carousel: 'carousel',
  reel: 'reel',
  static: 'static',
  tweet: 'tweet',
  thread: 'thread',
  newsletter: 'newsletter',
  article: 'article',
};

export const addReferenceTool: RegisteredTool<AddReferenceArgs, AddReferenceData> = {
  definition: {
    name: 'addReference',
    description:
      'Adiciona uma referência externa (post de inspiração, exemplo de carrossel/reel/thread) à library do cliente. Use quando o usuário pedir "adiciona essa ref", "salva esse post como inspiração", "joga isso na biblioteca". Diferente de saveToLibrary, aqui é sempre destination=references.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Título descritivo curto.' },
        content: { type: 'string', description: 'Texto/caption/conteúdo principal da ref.' },
        source_url: { type: 'string', description: 'URL original (post Instagram, artigo, etc).' },
        thumbnail_url: { type: 'string', description: 'URL da imagem de thumbnail.' },
        reference_type: {
          type: 'string',
          enum: ['inspiration', 'carousel', 'reel', 'static', 'tweet', 'thread', 'newsletter', 'article'],
          description: 'Tipo da ref. Default: inspiration.',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags pra organização (ex: ["hook", "storytelling"]).',
        },
        client_id: {
          type: 'string',
          description: 'UUID do cliente alvo. Default: cliente atual.',
        },
      },
      required: ['title'],
    },
  },

  handler: async (args, ctx) => {
    const clientId = String(args.client_id ?? ctx.clientId ?? '').trim();
    if (!clientId) return { ok: false, error: 'Selecione um cliente primeiro' };

    const title = String(args.title ?? '').trim();
    if (!title) return { ok: false, error: 'title obrigatório' };

    const refType = args.reference_type ?? 'inspiration';
    const format = FORMAT_FALLBACK_MAP[refType] ?? 'static';

    const res = await fetch(`${ctx.internalBaseUrl}/api/save-to-library`, {
      method: 'POST',
      headers: buildToolFetchHeaders(ctx),
      body: JSON.stringify({
        client_id: clientId,
        title,
        content: args.content ?? '',
        source_url: args.source_url,
        thumbnail_url: args.thumbnail_url,
        format,
        destination: 'references',
        tags: args.tags ?? [],
        metadata: { reference_type: refType, tags: args.tags ?? [] },
      }),
    }).catch((err) => {
      console.error('[addReference] fetch failed:', err);
      return null;
    });

    if (!res || !res.ok) {
      const errText = res ? await res.text().catch(() => '') : 'network';
      return { ok: false, error: `save-to-library: ${errText.slice(0, 200)}` };
    }

    const json: any = await res.json();
    const referenceId: string | null = json?.id ?? json?.item?.id ?? null;

    const snippet = (args.content ?? '').slice(0, 240);
    const card: KAIActionCard = {
      id: newActionCardId(),
      planning_item_id: null,
      type: 'library_match',
      status: 'done',
      data: {
        kind: 'library_match',
        clientId,
        matches: [
          {
            id: referenceId ?? `local_${Date.now()}`,
            title,
            snippet: snippet || `Ref ${refType}`,
            url: args.source_url,
          },
        ],
      },
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

    return { ok: true, data: { referenceId }, card };
  },
};
