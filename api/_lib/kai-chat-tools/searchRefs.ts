/**
 * Tool `searchRefs` — busca refs visuais/inspiração em client_reference_library.
 * Diferente de searchLibrary (que busca text-only em conteúdo + refs),
 * searchRefs foca em refs com thumbnail + filtro por formato.
 */
import type { RegisteredTool } from './types.js';
import { query } from '../db.js';
import { assertToolClientAccess } from './tool-access.js';

interface SearchRefsArgs {
  query?: string;
  format?: 'carousel' | 'reel' | 'static' | 'tweet' | 'thread' | 'newsletter' | 'article' | 'all';
  client_id?: string;
  limit?: number;
}

interface RefMatch {
  id: string;
  title: string;
  reference_type: string | null;
  format: string | null;
  source_url: string | null;
  thumbnail_url: string | null;
  snippet: string;
}

interface SearchRefsData {
  refs: RefMatch[];
  count: number;
}

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;
const SNIPPET_CHARS = 220;

function escapeIlike(q: string): string {
  return q.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

function buildSnippet(content: unknown): string {
  if (typeof content !== 'string') return '';
  const trimmed = content.trim();
  if (trimmed.length <= SNIPPET_CHARS) return trimmed;
  return `${trimmed.slice(0, SNIPPET_CHARS).trim()}...`;
}

export const searchRefsTool: RegisteredTool<SearchRefsArgs, SearchRefsData> = {
  definition: {
    name: 'searchRefs',
    description:
      "Busca refs visuais e de inspiração na biblioteca do cliente (client_reference_library). Use quando o usuário pedir 'me mostra refs de carrossel', 'tem alguma inspiração de reel sobre X?', 'quero ver as refs salvas'. Retorna refs com thumbnail e link da fonte.",
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Termo de busca opcional. Se vazio, lista as refs mais recentes.',
        },
        format: {
          type: 'string',
          enum: ['carousel', 'reel', 'static', 'tweet', 'thread', 'newsletter', 'article', 'all'],
          description: 'Filtra por formato. Default: all.',
        },
        client_id: {
          type: 'string',
          description: 'UUID do cliente. Default: cliente atual.',
        },
        limit: {
          type: 'integer',
          description: 'Máximo de refs. Default 12, máx 50.',
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

    // SECURITY: validar acesso ao cliente antes de devolver refs.
    const guard = await assertToolClientAccess(ctx, clientId);
    if (!guard.ok) return { ok: false, error: guard.error };

    const queryStr = typeof args.query === 'string' ? args.query.trim() : '';
    const rawLimit =
      typeof args.limit === 'number' && args.limit > 0 ? Math.floor(args.limit) : DEFAULT_LIMIT;
    const limit = Math.min(rawLimit, MAX_LIMIT);
    const format = args.format && args.format !== 'all' ? args.format : null;

    const where: string[] = ['client_id = $1'];
    const params: any[] = [clientId];

    if (queryStr) {
      params.push(`%${escapeIlike(queryStr)}%`);
      where.push(`(title ILIKE $${params.length} OR content ILIKE $${params.length})`);
    }

    if (format) {
      // metadata.format ou reference_type podem indicar o formato
      params.push(format);
      where.push(
        `(reference_type = $${params.length} OR (metadata->>'format') = $${params.length})`,
      );
    }

    params.push(limit);
    const limitIdx = params.length;

    try {
      const rows = await query<{
        id: string;
        title: string | null;
        reference_type: string | null;
        source_url: string | null;
        thumbnail_url: string | null;
        content: string | null;
        metadata: any;
      }>(
        `SELECT id, title, reference_type, source_url, thumbnail_url, content, metadata
           FROM client_reference_library
          WHERE ${where.join(' AND ')}
          ORDER BY created_at DESC
          LIMIT $${limitIdx}`,
        params,
      );

      const refs: RefMatch[] = rows.map((r) => ({
        id: String(r.id ?? ''),
        title: r.title?.trim() ? r.title : '(sem título)',
        reference_type: r.reference_type ?? null,
        format:
          (r.metadata && typeof r.metadata === 'object' && (r.metadata.format as string)) ||
          r.reference_type ||
          null,
        source_url: r.source_url ?? null,
        thumbnail_url: r.thumbnail_url ?? null,
        snippet: buildSnippet(r.content),
      }));

      console.log(`[searchRefs] client=${clientId} q="${queryStr}" → ${refs.length}`);
      return { ok: true, data: { refs, count: refs.length } };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[searchRefs] error:', err);
      return { ok: false, error: message };
    }
  },
};
