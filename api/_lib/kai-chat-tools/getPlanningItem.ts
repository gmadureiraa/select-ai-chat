/**
 * Tool `getPlanningItem` — busca um planning_item específico (rascunho/post agendado).
 *
 * Use ANTES de `editContent`, `publishNow` ou `scheduleFor` quando o usuário
 * mencionar "esse post", "o último rascunho", "o card que eu acabei de criar"
 * pra trazer ID + content + status como contexto para a próxima ação.
 *
 * Args:
 *   - planningItemId?: UUID do item (preferido)
 *   - latest?: boolean — se true, busca o item mais recente do cliente em status
 *               draft/idea (default false; só usar se planningItemId não vier)
 *   - status?: filtro opcional (draft|idea|scheduled|published|publishing|failed)
 */
import type { RegisteredTool } from './types.js';
import { queryOne, query } from '../db.js';
import { assertToolClientAccess } from './tool-access.js';

interface GetPlanningItemArgs {
  planningItemId?: string;
  latest?: boolean;
  status?: string;
}

interface GetPlanningItemData {
  found: boolean;
  id: string | null;
  title: string | null;
  content: string | null;
  platform: string | null;
  status: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  metadata: Record<string, unknown> | null;
  mediaUrls: string[] | null;
  createdAt: string | null;
  updatedAt: string | null;
}

const VALID_STATUSES = new Set([
  'draft', 'idea', 'scheduled', 'published', 'publishing', 'failed', 'archived', 'canceled',
]);

export const getPlanningItemTool: RegisteredTool<
  GetPlanningItemArgs,
  GetPlanningItemData
> = {
  definition: {
    name: 'getPlanningItem',
    description:
      'Busca um item específico do planejamento (rascunho, agendado ou publicado) pelo ID, ou o mais recente do cliente. Use ANTES de editContent/publishNow/scheduleFor sempre que o usuário se referir a "esse post", "esse rascunho", "o último card" — pra recuperar o ID e o conteúdo atual antes de agir.',
    parameters: {
      type: 'object',
      properties: {
        planningItemId: {
          type: 'string',
          description:
            'UUID do planning_item. Use sempre que o ID estiver disponível na conversa ou em cards anteriores.',
        },
        latest: {
          type: 'boolean',
          description:
            'Se true e planningItemId não for informado, retorna o item mais recente do cliente. Default false.',
        },
        status: {
          type: 'string',
          description:
            "Filtro opcional combinado com latest=true. Ex: 'draft' pra pegar o último rascunho.",
          enum: ['draft', 'idea', 'scheduled', 'published', 'publishing', 'failed', 'archived', 'canceled'],
        },
      },
      required: [],
    },
  },

  handler: async (args, ctx) => {
    const planningItemId = String(args.planningItemId || '').trim();
    const latest = !!args.latest;
    const statusFilter =
      args.status && VALID_STATUSES.has(String(args.status)) ? String(args.status) : null;

    if (!planningItemId && !latest) {
      return {
        ok: false,
        error: 'Forneça planningItemId ou use latest=true.',
      };
    }

    // SECURITY: o filtro já restringe via client_id = ctx.clientId, mas em
    // service mode + ctx.clientId arbitrário, attacker poderia ler items
    // de qualquer cliente. Validar acesso explicitamente.
    if (ctx.clientId) {
      const guard = await assertToolClientAccess(ctx, ctx.clientId);
      if (!guard.ok) return { ok: false, error: guard.error };
    }

    try {
      let row: any = null;
      if (planningItemId) {
        row = await queryOne<any>(
          `SELECT id, title, content, platform, status, scheduled_at, published_at,
                  metadata, media_urls, created_at, updated_at
             FROM planning_items
            WHERE id = $1 AND client_id = $2 LIMIT 1`,
          [planningItemId, ctx.clientId],
        );
      } else if (latest) {
        const params: any[] = [ctx.clientId];
        let where = `client_id = $1`;
        if (statusFilter) {
          params.push(statusFilter);
          where += ` AND status = $${params.length}`;
        }
        const rows = await query<any>(
          `SELECT id, title, content, platform, status, scheduled_at, published_at,
                  metadata, media_urls, created_at, updated_at
             FROM planning_items
            WHERE ${where}
            ORDER BY updated_at DESC
            LIMIT 1`,
          params,
        );
        row = rows[0] ?? null;
      }

      if (!row) {
        return {
          ok: true,
          data: {
            found: false,
            id: null,
            title: null,
            content: null,
            platform: null,
            status: null,
            scheduledAt: null,
            publishedAt: null,
            metadata: null,
            mediaUrls: null,
            createdAt: null,
            updatedAt: null,
          },
        };
      }

      const mediaUrls = Array.isArray(row.media_urls)
        ? (row.media_urls as unknown[]).filter((u) => typeof u === 'string') as string[]
        : null;

      return {
        ok: true,
        data: {
          found: true,
          id: String(row.id),
          title: row.title ?? null,
          content: row.content ?? null,
          platform: row.platform ?? null,
          status: row.status ?? null,
          scheduledAt: row.scheduled_at ?? null,
          publishedAt: row.published_at ?? null,
          metadata: (row.metadata && typeof row.metadata === 'object')
            ? (row.metadata as Record<string, unknown>)
            : null,
          mediaUrls,
          createdAt: row.created_at ?? null,
          updatedAt: row.updated_at ?? null,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[getPlanningItem] error:', err);
      return { ok: false, error: message };
    }
  },
};
