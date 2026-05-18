/**
 * Tool `getRecentActivity` — últimos N eventos do workspace.
 *
 * Mistura 3 fontes (ordenadas por timestamp):
 *  1. planning_items criados/atualizados/publicados (status mudou)
 *  2. team_tasks criadas/completadas
 *  3. Posts publicados (planning_items.status='published')
 *
 * Use quando o user perguntar "o que aconteceu no workspace hoje?",
 * "últimas atividades", "que posts foram publicados essa semana?",
 * "alguém criou algo novo?".
 *
 * IMPORTANTE: lê só dentro do workspace do user (via clients.workspace_id),
 * nunca cross-workspace.
 */
import type { RegisteredTool } from './types.js';
import { query, queryOne } from '../db.js';
import { assertToolClientAccess, assertToolWorkspaceAccess, isToolAccessFail } from './tool-access.js';

interface GetRecentActivityArgs {
  workspace_id?: string;
  client_id?: string;
  hours?: number;
  limit?: number;
  types?: Array<'planning_created' | 'planning_published' | 'task_created' | 'task_completed'>;
}

interface ActivityEventOut {
  kind:
    | 'planning_created'
    | 'planning_updated'
    | 'planning_published'
    | 'task_created'
    | 'task_completed';
  timestamp: string;
  entityId: string;
  clientId: string | null;
  clientName: string | null;
  title: string;
  status: string | null;
  platform: string | null;
  assignedTo: string | null;
  url: string | null;
}

interface GetRecentActivityData {
  workspaceId: string;
  events: ActivityEventOut[];
  count: number;
  windowHours: number;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const DEFAULT_HOURS = 24 * 7; // 7 dias
const MAX_HOURS = 24 * 30; // 30 dias

export const getRecentActivityTool: RegisteredTool<
  GetRecentActivityArgs,
  GetRecentActivityData
> = {
  definition: {
    name: 'getRecentActivity',
    description:
      "Últimos eventos do workspace nos últimos N horas (default 7 dias). Mistura planning_items criados/publicados + team_tasks criadas/completadas. Use quando o user perguntar 'o que aconteceu hoje?', 'últimas atividades', 'posts publicados essa semana?', 'alguém criou algo?', 'tarefas concluídas?'.",
    parameters: {
      type: 'object',
      properties: {
        workspace_id: {
          type: 'string',
          description: 'UUID do workspace. Default: workspace do cliente atual.',
        },
        client_id: {
          type: 'string',
          description:
            'Filtra eventos de um cliente específico. Default: todos do workspace.',
        },
        hours: {
          type: 'integer',
          description: 'Janela em horas. Default 168 (7 dias). Máx 720 (30 dias).',
        },
        limit: {
          type: 'integer',
          description: 'Máximo de eventos. Default 20, máx 100.',
        },
        types: {
          type: 'array',
          description:
            'Filtra por tipos. Default: todos. Valores: planning_created, planning_published, task_created, task_completed.',
          items: { type: 'string' },
        },
      },
      required: [],
    },
  },

  handler: async (args, ctx) => {
    const rawLimit =
      typeof args.limit === 'number' && args.limit > 0
        ? Math.floor(args.limit)
        : DEFAULT_LIMIT;
    const limit = Math.min(rawLimit, MAX_LIMIT);
    const rawHours =
      typeof args.hours === 'number' && args.hours > 0
        ? Math.floor(args.hours)
        : DEFAULT_HOURS;
    const hours = Math.min(rawHours, MAX_HOURS);
    const cutoffISO = new Date(Date.now() - hours * 3600 * 1000).toISOString();

    const types = Array.isArray(args.types) && args.types.length > 0 ? args.types : null;
    const wantPlanningCreated = !types || types.includes('planning_created');
    const wantPlanningPublished = !types || types.includes('planning_published');
    const wantTaskCreated = !types || types.includes('task_created');
    const wantTaskCompleted = !types || types.includes('task_completed');

    try {
      // Resolve workspace_id.
      // SECURITY: workspace_id explícito DEVE ser validado contra ctx.userId.
      // Sem isso, qualquer user lia atividade de qualquer workspace conhecido
      // (rascunhos com título, plataformas, datas).
      let workspaceId = String(args.workspace_id ?? '').trim();
      if (workspaceId) {
        const guard = await assertToolWorkspaceAccess(ctx, workspaceId);
        if (isToolAccessFail(guard)) return { ok: false, error: guard.error };
      } else {
        if (!ctx.clientId) {
          return {
            ok: false,
            error:
              'Sem workspace_id e sem clientId no contexto. Passe workspace_id ou selecione um cliente.',
          };
        }
        const guard = await assertToolClientAccess(ctx, ctx.clientId);
        if (isToolAccessFail(guard)) return { ok: false, error: guard.error };
        if (guard.workspaceId) {
          workspaceId = guard.workspaceId;
        } else {
          // Service-mode bypass — pega workspace direto do cliente.
          const c = await queryOne<{ workspace_id: string }>(
            `SELECT workspace_id FROM clients WHERE id = $1 LIMIT 1`,
            [ctx.clientId],
          );
          if (!c?.workspace_id) {
            return { ok: false, error: 'Cliente atual não tem workspace_id.' };
          }
          workspaceId = String(c.workspace_id);
        }
      }

      // client_id como filtro → validar que pertence ao workspace E que o
      // user tem acesso.
      const clientFilter = String(args.client_id ?? '').trim();
      if (clientFilter) {
        const guard = await assertToolClientAccess(ctx, clientFilter);
        if (isToolAccessFail(guard)) return { ok: false, error: guard.error };
        if (guard.workspaceId && guard.workspaceId !== workspaceId) {
          return { ok: false, error: 'client_id filtro fora do workspace alvo.' };
        }
      }

      const events: ActivityEventOut[] = [];

      // Planning items created
      if (wantPlanningCreated) {
        const params: any[] = [workspaceId, cutoffISO];
        let where = `pi.workspace_id = $1 AND pi.created_at >= $2`;
        if (clientFilter) {
          params.push(clientFilter);
          where += ` AND pi.client_id = $${params.length}`;
        }
        const rows = await query<any>(
          `SELECT pi.id, pi.title, pi.status, pi.platform, pi.client_id,
                  pi.assigned_to, pi.created_at, c.name AS client_name
             FROM planning_items pi
             LEFT JOIN clients c ON c.id = pi.client_id
            WHERE ${where}
            ORDER BY pi.created_at DESC
            LIMIT ${limit * 2}`,
          params,
        );
        for (const r of rows) {
          events.push({
            kind: 'planning_created',
            timestamp: String(r.created_at ?? ''),
            entityId: String(r.id ?? ''),
            clientId: r.client_id ?? null,
            clientName: r.client_name ?? null,
            title: String(r.title ?? '(sem título)'),
            status: r.status ?? null,
            platform: r.platform ?? null,
            assignedTo: r.assigned_to ?? null,
            url: null,
          });
        }
      }

      // Planning items published
      if (wantPlanningPublished) {
        const params: any[] = [workspaceId, cutoffISO];
        let where = `pi.workspace_id = $1 AND pi.published_at >= $2 AND pi.status = 'published'`;
        if (clientFilter) {
          params.push(clientFilter);
          where += ` AND pi.client_id = $${params.length}`;
        }
        const rows = await query<any>(
          `SELECT pi.id, pi.title, pi.status, pi.platform, pi.client_id,
                  pi.assigned_to, pi.published_at, pi.metadata, c.name AS client_name
             FROM planning_items pi
             LEFT JOIN clients c ON c.id = pi.client_id
            WHERE ${where}
            ORDER BY pi.published_at DESC
            LIMIT ${limit * 2}`,
          params,
        );
        for (const r of rows) {
          const meta =
            r.metadata && typeof r.metadata === 'object' ? r.metadata : {};
          const publishedUrls =
            meta.published_urls && typeof meta.published_urls === 'object'
              ? meta.published_urls
              : null;
          const url =
            publishedUrls && r.platform && typeof publishedUrls[r.platform] === 'string'
              ? publishedUrls[r.platform]
              : null;
          events.push({
            kind: 'planning_published',
            timestamp: String(r.published_at ?? ''),
            entityId: String(r.id ?? ''),
            clientId: r.client_id ?? null,
            clientName: r.client_name ?? null,
            title: String(r.title ?? '(sem título)'),
            status: r.status ?? null,
            platform: r.platform ?? null,
            assignedTo: r.assigned_to ?? null,
            url,
          });
        }
      }

      // Team tasks created
      if (wantTaskCreated) {
        const params: any[] = [workspaceId, cutoffISO];
        let where = `tt.workspace_id = $1 AND tt.created_at >= $2`;
        if (clientFilter) {
          params.push(clientFilter);
          where += ` AND tt.client_id = $${params.length}`;
        }
        const rows = await query<any>(
          `SELECT tt.id, tt.title, tt.status, tt.client_id,
                  tt.assigned_to, tt.created_at, c.name AS client_name
             FROM team_tasks tt
             LEFT JOIN clients c ON c.id = tt.client_id
            WHERE ${where}
            ORDER BY tt.created_at DESC
            LIMIT ${limit * 2}`,
          params,
        );
        for (const r of rows) {
          events.push({
            kind: 'task_created',
            timestamp: String(r.created_at ?? ''),
            entityId: String(r.id ?? ''),
            clientId: r.client_id ?? null,
            clientName: r.client_name ?? null,
            title: String(r.title ?? '(sem título)'),
            status: r.status ?? null,
            platform: null,
            assignedTo: r.assigned_to ?? null,
            url: null,
          });
        }
      }

      // Team tasks completed
      if (wantTaskCompleted) {
        const params: any[] = [workspaceId, cutoffISO];
        let where = `tt.workspace_id = $1 AND tt.completed_at >= $2`;
        if (clientFilter) {
          params.push(clientFilter);
          where += ` AND tt.client_id = $${params.length}`;
        }
        const rows = await query<any>(
          `SELECT tt.id, tt.title, tt.status, tt.client_id,
                  tt.assigned_to, tt.completed_at, c.name AS client_name
             FROM team_tasks tt
             LEFT JOIN clients c ON c.id = tt.client_id
            WHERE ${where}
            ORDER BY tt.completed_at DESC
            LIMIT ${limit * 2}`,
          params,
        );
        for (const r of rows) {
          events.push({
            kind: 'task_completed',
            timestamp: String(r.completed_at ?? ''),
            entityId: String(r.id ?? ''),
            clientId: r.client_id ?? null,
            clientName: r.client_name ?? null,
            title: String(r.title ?? '(sem título)'),
            status: r.status ?? 'done',
            platform: null,
            assignedTo: r.assigned_to ?? null,
            url: null,
          });
        }
      }

      // Sort by timestamp desc and trim
      events.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
      const sliced = events.slice(0, limit);

      console.log(
        `[getRecentActivity] workspace=${workspaceId} window=${hours}h → ${sliced.length}/${events.length}`,
      );

      return {
        ok: true,
        data: {
          workspaceId,
          events: sliced,
          count: sliced.length,
          windowHours: hours,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[getRecentActivity] error:', err);
      return { ok: false, error: message };
    }
  },
};
