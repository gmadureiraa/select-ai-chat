/**
 * Tool `editReference` — edita uma row de client_reference_library
 * existente (title, content, source_url, thumbnail_url, reference_type,
 * metadata.tags).
 */
import { newActionCardId, type KAIActionCard } from './kai-stream.js';
import type { RegisteredTool } from './types.js';
import { buildToolFetchHeaders } from './internal-headers.js';

interface EditReferenceArgs {
  referenceId: string;
  title?: string;
  content?: string;
  source_url?: string | null;
  thumbnail_url?: string | null;
  reference_type?: string;
  note?: string;
  tags?: string[];
}

interface EditReferenceData {
  referenceId: string;
  fieldsUpdated: string[];
}

export const editReferenceTool: RegisteredTool<EditReferenceArgs, EditReferenceData> = {
  definition: {
    name: 'editReference',
    description:
      'Edita uma reference existente. Use quando o usuário pedir "muda o título dessa ref", "atualiza nota da ref", "troca tags dessa inspiração". Cada campo é opcional.',
    parameters: {
      type: 'object',
      properties: {
        referenceId: { type: 'string', description: 'UUID da reference.' },
        title: { type: 'string', description: 'Novo título (até 200 chars).' },
        content: { type: 'string', description: 'Novo conteúdo/texto principal.' },
        source_url: { type: 'string', description: 'Nova URL. null pra limpar.' },
        thumbnail_url: { type: 'string', description: 'Nova thumbnail URL. null pra limpar.' },
        reference_type: {
          type: 'string',
          description: 'Novo tipo (inspiration, carousel, reel, tweet, ...).',
        },
        note: {
          type: 'string',
          description: 'Nota livre — salva em metadata.note.',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Nova lista de tags (salva em metadata.tags).',
        },
      },
      required: ['referenceId'],
    },
  },

  handler: async (args, ctx) => {
    const referenceId = String(args.referenceId ?? '').trim();
    if (!referenceId) return { ok: false, error: 'referenceId obrigatório' };

    const payload: Record<string, unknown> = { id: referenceId };
    if (args.title !== undefined) payload.title = args.title;
    if (args.content !== undefined) payload.content = args.content;
    if (args.source_url !== undefined) payload.source_url = args.source_url;
    if (args.thumbnail_url !== undefined) payload.thumbnail_url = args.thumbnail_url;
    if (args.reference_type !== undefined) payload.reference_type = args.reference_type;

    // Note + tags vão dentro de metadata
    if (args.note !== undefined || args.tags !== undefined) {
      const meta: Record<string, unknown> = {};
      if (args.note !== undefined) meta.note = args.note;
      if (args.tags !== undefined) meta.tags = args.tags;
      payload.metadata = meta;
    }

    const fieldsUpdated = Object.keys(payload).filter((k) => k !== 'id');
    if (fieldsUpdated.length === 0) {
      return { ok: false, error: 'Passe ao menos um campo pra atualizar.' };
    }

    const res = await fetch(`${ctx.internalBaseUrl}/api/router?slug=reference-update`, {
      method: 'POST',
      headers: buildToolFetchHeaders(ctx),
      body: JSON.stringify(payload),
    }).catch((err) => {
      console.error('[editReference] fetch failed:', err);
      return null;
    });

    if (!res || !res.ok) {
      const errText = res ? await res.text().catch(() => '') : 'network';
      return { ok: false, error: `reference-update: ${errText.slice(0, 200)}` };
    }

    const json: any = await res.json();
    const ref = json?.reference ?? {};

    const card: KAIActionCard = {
      id: newActionCardId(),
      planning_item_id: null,
      type: 'library_match',
      status: 'done',
      data: {
        kind: 'library_match',
        clientId: ctx.clientId,
        matches: [
          {
            id: ref?.id ?? referenceId,
            title: ref?.title ?? '(sem título)',
            snippet: `Atualizado: ${fieldsUpdated.join(', ')}`,
            url: ref?.source_url,
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

    return { ok: true, data: { referenceId, fieldsUpdated }, card };
  },
};
