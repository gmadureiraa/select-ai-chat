/**
 * Tool `getWorkspaceMembers` — lista membros + roles do workspace do cliente atual.
 *
 * Use quando o usuário perguntar "quem tem acesso?", "quem tá no time?",
 * "lista os membros do workspace", "quem é admin?". Retorna user_id, role,
 * full_name (via profiles) e email (via profiles) — quando disponíveis.
 */
import type { RegisteredTool } from './types.js';
import { query, queryOne } from '../db.js';
import { assertToolClientAccess, assertToolWorkspaceAccess } from './tool-access.js';

interface GetWorkspaceMembersArgs {
  workspace_id?: string;
  role?: 'owner' | 'admin' | 'member' | 'viewer' | 'all';
  limit?: number;
}

interface MemberOut {
  userId: string;
  role: string;
  fullName: string | null;
  email: string | null;
  joinedAt: string | null;
}

interface GetWorkspaceMembersData {
  workspaceId: string;
  workspaceName: string | null;
  members: MemberOut[];
  count: number;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export const getWorkspaceMembersTool: RegisteredTool<
  GetWorkspaceMembersArgs,
  GetWorkspaceMembersData
> = {
  definition: {
    name: 'getWorkspaceMembers',
    description:
      "Lista membros + roles do workspace ativo (o que dono do cliente atual). Use quando o user perguntar 'quem tem acesso?', 'quem é admin?', 'lista o time do workspace'. Retorna user_id, role (owner/admin/member/viewer), full_name e email quando profile existe.",
    parameters: {
      type: 'object',
      properties: {
        workspace_id: {
          type: 'string',
          description:
            'UUID do workspace. Default: workspace do cliente atual (lookup via clients.workspace_id).',
        },
        role: {
          type: 'string',
          enum: ['owner', 'admin', 'member', 'viewer', 'all'],
          description: 'Filtra por role. Default: all.',
        },
        limit: {
          type: 'integer',
          description: 'Máximo de membros. Default 50, máx 200.',
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
      // Resolve workspace_id: arg explícito ou derivar do cliente atual.
      // SECURITY: workspace_id explícito DEVE ser validado contra
      // ctx.userId — sem isso, qualquer user listava emails+roles de
      // qualquer workspace conhecido (vazamento PII).
      let workspaceId = String(args.workspace_id ?? '').trim();
      let workspaceName: string | null = null;

      if (workspaceId) {
        const guard = await assertToolWorkspaceAccess(ctx, workspaceId);
        if (!guard.ok) return { ok: false, error: guard.error };
      } else {
        if (!ctx.clientId) {
          return {
            ok: false,
            error:
              'Sem workspace_id explícito e sem clientId no contexto. Selecione um cliente ou passe workspace_id.',
          };
        }
        const guard = await assertToolClientAccess(ctx, ctx.clientId);
        if (!guard.ok) return { ok: false, error: guard.error };
        if (!guard.workspaceId) {
          // Service-mode bypass — pega workspace direto do cliente.
          const c = await queryOne<{ workspace_id: string }>(
            `SELECT workspace_id FROM clients WHERE id = $1 LIMIT 1`,
            [ctx.clientId],
          );
          if (!c?.workspace_id) {
            return { ok: false, error: 'Cliente atual não tem workspace_id.' };
          }
          workspaceId = String(c.workspace_id);
        } else {
          workspaceId = guard.workspaceId;
        }
      }

      const wsRow = await queryOne<{ name: string }>(
        `SELECT name FROM workspaces WHERE id = $1 LIMIT 1`,
        [workspaceId],
      );
      workspaceName = wsRow?.name ?? null;

      const where: string[] = ['wm.workspace_id = $1'];
      const params: any[] = [workspaceId];

      if (args.role && args.role !== 'all') {
        params.push(args.role);
        where.push(`wm.role = $${params.length}`);
      }

      params.push(limit);
      const limitIdx = params.length;

      const rows = await query<{
        user_id: string;
        role: string;
        created_at: string | null;
        full_name: string | null;
        email: string | null;
      }>(
        `SELECT wm.user_id, wm.role::text AS role, wm.created_at,
                p.full_name, p.email
           FROM workspace_members wm
           LEFT JOIN profiles p ON p.id = wm.user_id
          WHERE ${where.join(' AND ')}
          ORDER BY
            CASE wm.role::text
              WHEN 'owner' THEN 0
              WHEN 'admin' THEN 1
              WHEN 'member' THEN 2
              WHEN 'viewer' THEN 3
              ELSE 9
            END,
            wm.created_at ASC
          LIMIT $${limitIdx}`,
        params,
      );

      const members: MemberOut[] = rows.map((r) => ({
        userId: String(r.user_id ?? ''),
        role: String(r.role ?? 'member'),
        fullName: r.full_name ?? null,
        email: r.email ?? null,
        joinedAt: r.created_at ?? null,
      }));

      console.log(
        `[getWorkspaceMembers] workspace=${workspaceId} members=${members.length}`,
      );

      return {
        ok: true,
        data: {
          workspaceId,
          workspaceName,
          members,
          count: members.length,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[getWorkspaceMembers] error:', err);
      return { ok: false, error: message };
    }
  },
};
