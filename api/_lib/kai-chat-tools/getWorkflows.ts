/**
 * Tool `getWorkflows` — lista AI workflows (ai_workflows) do workspace,
 * opcionalmente filtrando por cliente (via metadata.config.client_id).
 *
 * ai_workflows é o backbone das automações Madureira (10 workflows semanais
 * que rodam via cron `run-madureira-workflows-daily`). Não confunde com
 * `planning_automations` (esse é a tabela legada de automações simples
 * — coberta por `listAutomations` tool).
 *
 * Use quando o user pedir "que workflows estão rodando?", "workflows ativos
 * pro cliente X?", "quando o workflow Y roda?".
 */
import type { RegisteredTool } from './types.js';
import { query, queryOne } from '../db.js';

interface GetWorkflowsArgs {
  workspace_id?: string;
  client_id?: string;
  status?: 'active' | 'paused' | 'all';
  limit?: number;
}

interface WorkflowOut {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  scheduleCron: string | null;
  agentId: string | null;
  agentName: string | null;
  configClientId: string | null;
  configFormat: string | null;
  configPlatform: string | null;
  lastRunAt: string | null;
  nextRunAt: string | null;
  recentRunCount: number;
  lastRunStatus: string | null;
}

interface GetWorkflowsData {
  workspaceId: string;
  workflows: WorkflowOut[];
  count: number;
  activeCount: number;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function asStr(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

export const getWorkflowsTool: RegisteredTool<GetWorkflowsArgs, GetWorkflowsData> = {
  definition: {
    name: 'getWorkflows',
    description:
      "Lista AI workflows do workspace (ai_workflows = automações semanais avançadas tipo as 10 do Madureira). Filtra por client_id (via metadata.config.client_id), status (active/paused). NÃO confunde com listAutomations (essa é a tabela legada planning_automations). Use quando o user perguntar 'que workflows tenho rodando?', 'quando roda o workflow X?', 'workflows ativos pro Madureira?'.",
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
            'UUID do cliente — filtra via config.client_id JSONB. Default: cliente atual se passado.',
        },
        status: {
          type: 'string',
          enum: ['active', 'paused', 'all'],
          description: 'Filtra por is_active. Default: all.',
        },
        limit: {
          type: 'integer',
          description: 'Máximo de workflows. Default 50, máx 200.',
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

    try {
      // Resolve workspace_id
      let workspaceId = String(args.workspace_id ?? '').trim();
      if (!workspaceId) {
        if (!ctx.clientId) {
          return {
            ok: false,
            error:
              'Sem workspace_id e sem clientId no contexto. Passe workspace_id ou selecione um cliente.',
          };
        }
        const c = await queryOne<{ workspace_id: string }>(
          `SELECT workspace_id FROM clients WHERE id = $1 LIMIT 1`,
          [ctx.clientId],
        );
        if (!c?.workspace_id) {
          return { ok: false, error: 'Cliente atual não tem workspace_id.' };
        }
        workspaceId = String(c.workspace_id);
      }

      const where: string[] = ['w.workspace_id = $1'];
      const params: any[] = [workspaceId];

      if (args.status && args.status !== 'all') {
        params.push(args.status === 'active');
        where.push(`w.is_active = $${params.length}`);
      }

      const clientFilter = String(args.client_id ?? '').trim();
      if (clientFilter) {
        params.push(clientFilter);
        where.push(`(w.config->>'client_id') = $${params.length}`);
      }

      params.push(limit);
      const limitIdx = params.length;

      const rows = await query<{
        id: string;
        name: string;
        description: string | null;
        is_active: boolean;
        schedule_cron: string | null;
        agent_id: string | null;
        agent_name: string | null;
        config: unknown;
        last_run_at: string | null;
        next_run_at: string | null;
        recent_run_count: string | null;
        last_run_status: string | null;
      }>(
        `SELECT w.id, w.name, w.description, w.is_active,
                w.schedule_cron, w.agent_id, w.last_run_at, w.next_run_at,
                w.config,
                a.name AS agent_name,
                (SELECT COUNT(*)::text FROM ai_workflow_runs
                   WHERE workflow_id = w.id
                     AND started_at >= NOW() - INTERVAL '14 days') AS recent_run_count,
                (SELECT status FROM ai_workflow_runs
                   WHERE workflow_id = w.id
                   ORDER BY started_at DESC LIMIT 1) AS last_run_status
           FROM ai_workflows w
           LEFT JOIN ai_agents a ON a.id = w.agent_id
          WHERE ${where.join(' AND ')}
          ORDER BY w.is_active DESC, w.name ASC
          LIMIT $${limitIdx}`,
        params,
      );

      const workflows: WorkflowOut[] = rows.map((r) => {
        const cfg = isPlainObject(r.config) ? r.config : {};
        return {
          id: String(r.id ?? ''),
          name: String(r.name ?? '(sem nome)'),
          description: r.description ?? null,
          isActive: !!r.is_active,
          scheduleCron: r.schedule_cron ?? null,
          agentId: r.agent_id ?? null,
          agentName: r.agent_name ?? null,
          configClientId: asStr(cfg.client_id),
          configFormat: asStr(cfg.format),
          configPlatform: asStr(cfg.platform),
          lastRunAt: r.last_run_at ?? null,
          nextRunAt: r.next_run_at ?? null,
          recentRunCount: Number(r.recent_run_count ?? 0),
          lastRunStatus: r.last_run_status ?? null,
        };
      });

      const activeCount = workflows.filter((w) => w.isActive).length;

      console.log(
        `[getWorkflows] workspace=${workspaceId} client=${clientFilter || 'all'} → ${workflows.length} (active=${activeCount})`,
      );

      return {
        ok: true,
        data: {
          workspaceId,
          workflows,
          count: workflows.length,
          activeCount,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[getWorkflows] error:', err);
      return { ok: false, error: message };
    }
  },
};
