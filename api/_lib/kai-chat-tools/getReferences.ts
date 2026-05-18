/**
 * Tool `getReferences` — lista refs (texto + visuais) do cliente com filtros.
 *
 * Diferente de `searchRefs` (que faz busca por termo na text-only library) e
 * `searchLibrary` (que pesquisa em conteúdo + refs), esse retorna a LISTA
 * completa paginada com filtros por reference_type + format e ordenação por
 * created_at.
 *
 * Use quando o user pedir "lista as refs", "todas as refs salvas",
 * "quantas refs eu tenho?", "refs de IG (somente)", "as 50 mais recentes".
 */
import type { RegisteredTool } from './types.js';
import { query, queryOne } from '../db.js';
import { assertToolClientAccess, isToolAccessFail } from './tool-access.js';

interface GetReferencesArgs {
  client_id?: string;
  reference_type?: string;
  format?: string;
  source_platform?: string;
  limit?: number;
  offset?: number;
  order?: 'recent' | 'oldest';
}

interface RefOut {
  id: string;
  title: string | null;
  referenceType: string | null;
  sourceUrl: string | null;
  thumbnailUrl: string | null;
  contentSnippet: string;
  metadataKeys: string[];
  createdAt: string | null;
}

interface GetReferencesData {
  clientId: string;
  refs: RefOut[];
  total: number;
  returned: number;
  filteredBy: {
    referenceType: string | null;
    format: string | null;
    sourcePlatform: string | null;
    order: string;
  };
}

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;
const SNIPPET_CHARS = 240;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function buildSnippet(content: unknown): string {
  if (typeof content !== 'string') return '';
  const t = content.trim();
  if (t.length <= SNIPPET_CHARS) return t;
  return `${t.slice(0, SNIPPET_CHARS).trim()}...`;
}

export const getReferencesTool: RegisteredTool<GetReferencesArgs, GetReferencesData> = {
  definition: {
    name: 'getReferences',
    description:
      "Lista refs do cliente (full list paginada, não busca por termo — pra busca use searchRefs). Filtra por reference_type, format e source_platform. Use quando o user pedir 'todas as refs', 'lista as refs salvas', 'quantas refs tenho?', 'refs de IG', 'últimas 50 refs'.",
    parameters: {
      type: 'object',
      properties: {
        client_id: {
          type: 'string',
          description: 'UUID do cliente. Default: cliente atual.',
        },
        reference_type: {
          type: 'string',
          description:
            'Filtra por tipo (ex: carousel, reel, post, video, article).',
        },
        format: {
          type: 'string',
          description:
            'Filtra por metadata.format (carousel, reel, static, tweet, thread, newsletter).',
        },
        source_platform: {
          type: 'string',
          description:
            'Filtra por metadata.source_platform (instagram, twitter, linkedin, etc).',
        },
        limit: {
          type: 'integer',
          description: 'Máximo de refs por página. Default 30, máx 100.',
        },
        offset: {
          type: 'integer',
          description: 'Offset pra paginação. Default 0.',
        },
        order: {
          type: 'string',
          enum: ['recent', 'oldest'],
          description: 'Ordem. Default recent (mais novas primeiro).',
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

    // SECURITY: client_reference_library guarda swipes/refs salvos
    // (estratégia editorial). Validar acesso antes.
    const guard = await assertToolClientAccess(ctx, clientId);
    if (isToolAccessFail(guard)) return { ok: false, error: guard.error };

    const rawLimit =
      typeof args.limit === 'number' && args.limit > 0
        ? Math.floor(args.limit)
        : DEFAULT_LIMIT;
    const limit = Math.min(rawLimit, MAX_LIMIT);
    const offset =
      typeof args.offset === 'number' && args.offset > 0 ? Math.floor(args.offset) : 0;
    const order = args.order === 'oldest' ? 'ASC' : 'DESC';

    const where: string[] = ['client_id = $1'];
    const params: any[] = [clientId];

    const refType = typeof args.reference_type === 'string' ? args.reference_type.trim() : '';
    if (refType) {
      params.push(refType);
      where.push(`reference_type = $${params.length}`);
    }
    const format = typeof args.format === 'string' ? args.format.trim() : '';
    if (format) {
      params.push(format);
      where.push(
        `(reference_type = $${params.length} OR (metadata->>'format') = $${params.length})`,
      );
    }
    const srcPlat = typeof args.source_platform === 'string' ? args.source_platform.trim() : '';
    if (srcPlat) {
      params.push(srcPlat);
      where.push(`(metadata->>'source_platform') = $${params.length}`);
    }

    try {
      const totalRow = await queryOne<{ total: string }>(
        `SELECT COUNT(*)::text AS total FROM client_reference_library WHERE ${where.join(' AND ')}`,
        params,
      );
      const total = Number(totalRow?.total ?? 0);

      params.push(limit);
      const limitIdx = params.length;
      params.push(offset);
      const offsetIdx = params.length;

      const rows = await query<{
        id: string;
        title: string | null;
        reference_type: string | null;
        source_url: string | null;
        thumbnail_url: string | null;
        content: string | null;
        metadata: unknown;
        created_at: string | null;
      }>(
        `SELECT id, title, reference_type, source_url, thumbnail_url,
                content, metadata, created_at
           FROM client_reference_library
          WHERE ${where.join(' AND ')}
          ORDER BY created_at ${order} NULLS LAST
          LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        params,
      );

      const refs: RefOut[] = rows.map((r) => ({
        id: String(r.id ?? ''),
        title: r.title ?? null,
        referenceType: r.reference_type ?? null,
        sourceUrl: r.source_url ?? null,
        thumbnailUrl: r.thumbnail_url ?? null,
        contentSnippet: buildSnippet(r.content),
        metadataKeys: isPlainObject(r.metadata) ? Object.keys(r.metadata) : [],
        createdAt: r.created_at ?? null,
      }));

      console.log(
        `[getReferences] client=${clientId} type=${refType || 'all'} format=${format || 'all'} → ${refs.length} de ${total}`,
      );

      return {
        ok: true,
        data: {
          clientId,
          refs,
          total,
          returned: refs.length,
          filteredBy: {
            referenceType: refType || null,
            format: format || null,
            sourcePlatform: srcPlat || null,
            order: order === 'DESC' ? 'recent' : 'oldest',
          },
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[getReferences] error:', err);
      return { ok: false, error: message };
    }
  },
};
