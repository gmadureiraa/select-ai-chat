/**
 * Tool `listClients` — lista clientes acessíveis ao user (workspace_members).
 * Útil pra "quais clientes eu tenho?" via chat.
 */
import type { RegisteredTool, ToolExecutionContext } from './types.js';
import { query, queryOne } from '../db.js';

interface ListClientsArgs {
  search?: string;
  limit?: number;
}

interface ClientSummary {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  workspace_id: string;
  lastActivity: string | null;
  planningCount: number;
}

interface ListClientsData {
  clients: ClientSummary[];
  count: number;
}

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

function escapeIlike(q: string): string {
  return q.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

export const listClientsTool: RegisteredTool<ListClientsArgs, ListClientsData> = {
  definition: {
    name: 'listClients',
    description:
      "Lista todos os clientes que o user tem acesso (via workspace_members). Use quando o usuário perguntar 'quais clientes tenho?', 'lista meus clientes', 'me mostra os ativos'. Retorna {id, name, avatar, lastActivity}.",
    parameters: {
      type: 'object',
      properties: {
        search: {
          type: 'string',
          description: 'Filtra por nome (ILIKE).',
        },
        limit: {
          type: 'integer',
          description: 'Máximo de clientes. Default 25, máx 100.',
        },
      },
      required: [],
    },
  },

  handler: async (args, ctx: ToolExecutionContext) => {
    const search = typeof args.search === 'string' ? args.search.trim() : '';
    const rawLimit =
      typeof args.limit === 'number' && args.limit > 0 ? Math.floor(args.limit) : DEFAULT_LIMIT;
    const limit = Math.min(rawLimit, MAX_LIMIT);

    try {
      // Verifica se é super_admin (acesso global) ou listar via workspace_members
      const sa = await queryOne<{ id: string }>(
        `SELECT user_id AS id FROM super_admins WHERE user_id = $1 LIMIT 1`,
        [ctx.userId],
      );
      const isSuperAdmin = !!sa;

      const where: string[] = [];
      const params: any[] = [];

      if (!isSuperAdmin) {
        params.push(ctx.userId);
        where.push(
          `c.workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = $${params.length})`,
        );
      }

      if (search) {
        params.push(`%${escapeIlike(search)}%`);
        where.push(`c.name ILIKE $${params.length}`);
      }

      params.push(limit);
      const limitIdx = params.length;

      const rows = await query<{
        id: string;
        name: string;
        description: string | null;
        avatar_url: string | null;
        workspace_id: string;
        last_activity: string | null;
        planning_count: string;
      }>(
        `SELECT c.id, c.name, c.description, c.avatar_url, c.workspace_id,
                (SELECT MAX(updated_at) FROM planning_items WHERE client_id = c.id) AS last_activity,
                (SELECT COUNT(*)::text FROM planning_items WHERE client_id = c.id) AS planning_count
           FROM clients c
          ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
          ORDER BY c.updated_at DESC
          LIMIT $${limitIdx}`,
        params,
      );

      const clients: ClientSummary[] = rows.map((r) => ({
        id: String(r.id ?? ''),
        name: r.name ?? '(sem nome)',
        description: r.description ?? null,
        avatar_url: r.avatar_url ?? null,
        workspace_id: String(r.workspace_id ?? ''),
        lastActivity: r.last_activity ?? null,
        planningCount: Number(r.planning_count ?? 0),
      }));

      console.log(`[listClients] user=${ctx.userId} super=${isSuperAdmin} → ${clients.length}`);
      return { ok: true, data: { clients, count: clients.length } };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[listClients] error:', err);
      return { ok: false, error: message };
    }
  },
};
