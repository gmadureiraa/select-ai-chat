/**
 * Tool F3 `searchLibrary` — pesquisa biblioteca de conteúdos e referências.
 */
import type { RegisteredTool } from './types.js';
import { query } from '../db.js';

interface SearchLibraryArgs {
  query: string;
  limit?: number;
  includeReferences?: boolean;
}

interface ContentMatch {
  id: string;
  title: string;
  content_type: string | null;
  snippet: string;
}

interface ReferenceMatch {
  id: string;
  title: string;
  reference_type: string | null;
  source_url: string | null;
  snippet: string;
}

interface SearchLibraryData {
  content: ContentMatch[];
  references: ReferenceMatch[];
}

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 25;
const SNIPPET_CHARS = 240;

function escapeIlike(q: string): string {
  return q.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

function buildSnippet(content: unknown): string {
  if (typeof content !== 'string') return '';
  const trimmed = content.trim();
  if (trimmed.length <= SNIPPET_CHARS) return trimmed;
  return `${trimmed.slice(0, SNIPPET_CHARS).trim()}...`;
}

export const searchLibraryTool: RegisteredTool<SearchLibraryArgs, SearchLibraryData> = {
  definition: {
    name: 'searchLibrary',
    description:
      "Pesquisa a biblioteca de conteúdos e referências do cliente por palavra-chave. Use quando o usuário pergunta 'tem algum post sobre X?', 'lembra daquela referência de Y?'.",
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Termo ou frase curta a buscar em título e corpo dos itens da biblioteca.',
        },
        limit: {
          type: 'integer',
          description:
            'Número máximo de resultados por fonte (content e references). Default 5, máximo 25.',
        },
        includeReferences: {
          type: 'boolean',
          description:
            'Se true (default), também busca em client_reference_library. Se false, busca só em client_content_library.',
        },
      },
      required: ['query'],
    },
  },

  handler: async (args, ctx) => {
    const queryStr = typeof args.query === 'string' ? args.query.trim() : '';
    if (!queryStr) {
      return { ok: false, error: "Argumento 'query' obrigatório e não pode ser vazio." };
    }

    const rawLimit =
      typeof args.limit === 'number' && args.limit > 0 ? Math.floor(args.limit) : DEFAULT_LIMIT;
    const limit = Math.min(rawLimit, MAX_LIMIT);
    const includeReferences = args.includeReferences !== false;

    const pattern = `%${escapeIlike(queryStr)}%`;

    console.log(
      `[searchLibrary] clientId=${ctx.clientId} query="${queryStr}" limit=${limit} refs=${includeReferences}`,
    );

    try {
      const contentRowsP = query<{
        id: string;
        title: string | null;
        content: string | null;
        content_type: string | null;
      }>(
        `SELECT id, title, content, content_type
           FROM client_content_library
          WHERE client_id = $1 AND (title ILIKE $2 OR content ILIKE $2)
          LIMIT $3`,
        [ctx.clientId, pattern, limit],
      );

      const refRowsP = includeReferences
        ? query<{
            id: string;
            title: string | null;
            content: string | null;
            reference_type: string | null;
            source_url: string | null;
          }>(
            `SELECT id, title, content, reference_type, source_url
               FROM client_reference_library
              WHERE client_id = $1 AND (title ILIKE $2 OR content ILIKE $2)
              LIMIT $3`,
            [ctx.clientId, pattern, limit],
          )
        : Promise.resolve([] as any[]);

      const [contentRows, refRows] = await Promise.all([contentRowsP, refRowsP]);

      const content: ContentMatch[] = contentRows.map((row) => ({
        id: String(row.id ?? ''),
        title: row.title?.trim() ? row.title : '(sem título)',
        content_type: typeof row.content_type === 'string' ? row.content_type : null,
        snippet: buildSnippet(row.content),
      }));

      const references: ReferenceMatch[] = refRows.map((row: any) => ({
        id: String(row.id ?? ''),
        title: row.title?.trim() ? row.title : '(sem título)',
        reference_type: typeof row.reference_type === 'string' ? row.reference_type : null,
        source_url: typeof row.source_url === 'string' ? row.source_url : null,
        snippet: buildSnippet(row.content),
      }));

      console.log(`[searchLibrary] content=${content.length} references=${references.length}`);
      return { ok: true, data: { content, references } };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[searchLibrary] error:', err);
      return { ok: false, error: message };
    }
  },
};
