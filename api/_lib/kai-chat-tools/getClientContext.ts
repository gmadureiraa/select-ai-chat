/**
 * Tool F3 `getClientContext` — busca contexto completo do cliente.
 */
import type { RegisteredTool } from './types.js';
import { query, queryOne } from '../db.js';

interface GetClientContextArgs {
  [key: string]: unknown;
}

interface ClientStats {
  planningItems: number;
  libraryItems: number;
  references: number;
}

interface GetClientContextData {
  name: string;
  description: string | null;
  contextNotes: string | null;
  identityGuideSummary: string | null;
  socialMedia: unknown;
  tags: string[];
  stats: ClientStats;
}

const MAX_LONG_FIELD = 2000;

function summarizeLongField(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.length <= MAX_LONG_FIELD) return trimmed;
  const slice = trimmed.slice(0, MAX_LONG_FIELD);
  const lastSpace = slice.lastIndexOf(' ');
  const base = lastSpace > MAX_LONG_FIELD * 0.7 ? slice.slice(0, lastSpace) : slice;
  return `${base.trim()}... [resumido, ${trimmed.length} chars no total]`;
}

async function countRows(table: string, clientId: string): Promise<number> {
  try {
    const row = await queryOne<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM ${table} WHERE client_id = $1`,
      [clientId],
    );
    return Number(row?.count ?? 0);
  } catch {
    return 0;
  }
}

export const getClientContextTool: RegisteredTool<GetClientContextArgs, GetClientContextData> = {
  definition: {
    name: 'getClientContext',
    description:
      "Busca o contexto completo do cliente (brand voice, público, guidelines, perfis sociais). Use quando o usuário pergunta 'quem é esse cliente?', 'qual o tom de voz?', 'me lembra dos guidelines'.",
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },

  handler: async (_args, ctx) => {
    console.log(`[getClientContext] clientId=${ctx.clientId}`);
    try {
      const clients = await query<{
        id: string;
        name: string;
        description: string | null;
        context_notes: string | null;
        identity_guide: string | null;
        social_media: any;
        tags: any;
      }>(
        `SELECT id, name, description, context_notes, identity_guide, social_media, tags
           FROM clients WHERE id = $1 LIMIT 1`,
        [ctx.clientId],
      );
      const client = clients[0];
      if (!client) return { ok: false, error: 'Cliente não encontrado' };

      const [planningCount, libraryCount, referencesCount] = await Promise.all([
        countRows('planning_items', ctx.clientId),
        countRows('client_content_library', ctx.clientId),
        countRows('client_reference_library', ctx.clientId),
      ]);

      const tags = Array.isArray(client.tags)
        ? (client.tags as unknown[]).filter((t): t is string => typeof t === 'string')
        : [];

      const data: GetClientContextData = {
        name: typeof client.name === 'string' ? client.name : '(sem nome)',
        description: typeof client.description === 'string' ? client.description : null,
        contextNotes: summarizeLongField(client.context_notes),
        identityGuideSummary: summarizeLongField(client.identity_guide),
        socialMedia: client.social_media ?? null,
        tags,
        stats: {
          planningItems: planningCount,
          libraryItems: libraryCount,
          references: referencesCount,
        },
      };

      console.log(
        `[getClientContext] ${data.name} — plan=${data.stats.planningItems} lib=${data.stats.libraryItems} refs=${data.stats.references}`,
      );

      return { ok: true, data };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[getClientContext] error:', err);
      return { ok: false, error: message };
    }
  },
};
