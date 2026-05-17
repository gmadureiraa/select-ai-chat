/**
 * Tool `getAuditLog` — últimos N eventos do audit log do workspace (admin only).
 *
 * Lê `social_credentials_audit_log` que rastreia acessos/usos de credenciais
 * (view/create/update/delete/use). É a fonte de auditoria mais sensível do KAI.
 *
 * Use quando o user perguntar "quem acessou credenciais?", "quem alterou
 * conta X?", "logs de auditoria", "histórico de uso de credenciais". Apenas
 * owners/admins do workspace conseguem ver (RLS no banco + check explícito
 * aqui pra dar erro claro pro LLM).
 */
import type { RegisteredTool } from './types.js';
import { query, queryOne } from '../db.js';

interface GetAuditLogArgs {
  workspace_id?: string;
  client_id?: string;
  action?: 'view' | 'create' | 'update' | 'delete' | 'use' | 'all';
  limit?: number;
  since?: string;
}

interface AuditEventOut {
  id: string;
  action: string;
  userId: string;
  userFullName: string | null;
  clientId: string;
  credentialId: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  metadata: Record<string, unknown> | null;
}

interface GetAuditLogData {
  workspaceId: string;
  events: AuditEventOut[];
  count: number;
  filteredBy: {
    action: string;
    clientId: string | null;
    since: string | null;
  };
}

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 200;
const VALID_ACTIONS = new Set(['view', 'create', 'update', 'delete', 'use']);

export const getAuditLogTool: RegisteredTool<GetAuditLogArgs, GetAuditLogData> = {
  definition: {
    name: 'getAuditLog',
    description:
      "Lista últimos eventos do audit log de credenciais do workspace (quem acessou/usou/alterou contas conectadas). APENAS owners e admins do workspace conseguem ver. Use quando o user perguntar 'quem acessou as credenciais?', 'histórico de uso', 'auditoria', 'quem alterou a conta X?'.",
    parameters: {
      type: 'object',
      properties: {
        workspace_id: {
          type: 'string',
          description: 'UUID do workspace. Default: workspace do cliente atual.',
        },
        client_id: {
          type: 'string',
          description: 'Filtra eventos de um cliente específico. Default: todos do workspace.',
        },
        action: {
          type: 'string',
          enum: ['view', 'create', 'update', 'delete', 'use', 'all'],
          description: 'Filtra por tipo de ação. Default: all.',
        },
        limit: {
          type: 'integer',
          description: 'Máximo de eventos. Default 30, máx 200.',
        },
        since: {
          type: 'string',
          description:
            'ISO datetime — só eventos a partir dessa data (ex: 2026-05-01T00:00:00Z).',
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
    const actionFilter =
      args.action && args.action !== 'all' && VALID_ACTIONS.has(args.action)
        ? args.action
        : null;
    const clientFilter = String(args.client_id ?? '').trim() || null;
    const sinceFilter = typeof args.since === 'string' && args.since ? args.since : null;

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

      // Check role: only owner/admin can view audit logs (também a RLS bloqueia,
      // mas damos erro claro aqui pra LLM saber).
      const role = await queryOne<{ role: string }>(
        `SELECT role::text AS role
           FROM workspace_members
          WHERE workspace_id = $1 AND user_id = $2 LIMIT 1`,
        [workspaceId, ctx.userId],
      );
      const isSuperAdmin = await queryOne<{ id: string }>(
        `SELECT user_id AS id FROM super_admins WHERE user_id = $1 LIMIT 1`,
        [ctx.userId],
      );
      const allowed =
        !!isSuperAdmin || (role && (role.role === 'owner' || role.role === 'admin'));

      if (!allowed) {
        return {
          ok: false,
          error:
            'Acesso negado ao audit log. Apenas owners e admins do workspace conseguem ver eventos de auditoria.',
        };
      }

      const where: string[] = [
        `c.workspace_id = $1`,
      ];
      const params: any[] = [workspaceId];

      if (clientFilter) {
        params.push(clientFilter);
        where.push(`l.client_id = $${params.length}`);
      }
      if (actionFilter) {
        params.push(actionFilter);
        where.push(`l.action = $${params.length}`);
      }
      if (sinceFilter) {
        params.push(sinceFilter);
        where.push(`l.created_at >= $${params.length}`);
      }

      params.push(limit);
      const limitIdx = params.length;

      const rows = await query<{
        id: string;
        action: string;
        user_id: string;
        client_id: string;
        credential_id: string;
        ip_address: string | null;
        user_agent: string | null;
        created_at: string;
        metadata: unknown;
        full_name: string | null;
      }>(
        `SELECT l.id, l.action, l.user_id, l.client_id, l.credential_id,
                l.ip_address, l.user_agent, l.created_at, l.metadata,
                p.full_name
           FROM social_credentials_audit_log l
           JOIN clients c ON c.id = l.client_id
           LEFT JOIN profiles p ON p.id = l.user_id
          WHERE ${where.join(' AND ')}
          ORDER BY l.created_at DESC
          LIMIT $${limitIdx}`,
        params,
      );

      const events: AuditEventOut[] = rows.map((r) => ({
        id: String(r.id ?? ''),
        action: String(r.action ?? ''),
        userId: String(r.user_id ?? ''),
        userFullName: r.full_name ?? null,
        clientId: String(r.client_id ?? ''),
        credentialId: String(r.credential_id ?? ''),
        ipAddress: r.ip_address ?? null,
        userAgent: r.user_agent ?? null,
        createdAt: r.created_at ?? '',
        metadata:
          r.metadata && typeof r.metadata === 'object' && !Array.isArray(r.metadata)
            ? (r.metadata as Record<string, unknown>)
            : null,
      }));

      console.log(
        `[getAuditLog] workspace=${workspaceId} action=${actionFilter ?? 'all'} client=${clientFilter ?? 'all'} → ${events.length}`,
      );

      return {
        ok: true,
        data: {
          workspaceId,
          events,
          count: events.length,
          filteredBy: {
            action: actionFilter ?? 'all',
            clientId: clientFilter,
            since: sinceFilter,
          },
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[getAuditLog] error:', err);
      return { ok: false, error: message };
    }
  },
};
