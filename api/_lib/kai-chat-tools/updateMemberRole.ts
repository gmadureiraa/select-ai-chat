/**
 * Tool `updateMemberRole` — muda role (owner/admin/member) de um workspace
 * member. Só owner do workspace pode rebaixar/promover outros. Não permite
 * rebaixar o último owner.
 */
import { newActionCardId, type KAIActionCard } from './kai-stream.js';
import type { RegisteredTool } from './types.js';
import { buildToolFetchHeaders } from './internal-headers.js';

interface UpdateMemberRoleArgs {
  workspace_id: string;
  user_id?: string;
  member_id?: string;
  role: 'owner' | 'admin' | 'member';
}

interface UpdateMemberRoleData {
  memberId: string | null;
  newRole: string;
}

export const updateMemberRoleTool: RegisteredTool<UpdateMemberRoleArgs, UpdateMemberRoleData> = {
  definition: {
    name: 'updateMemberRole',
    description:
      'Muda role de um membro do workspace (owner/admin/member). Use quando o usuário pedir "promove o João pra admin", "rebaixa pra member", "torna owner". Só owners podem mudar roles.',
    parameters: {
      type: 'object',
      properties: {
        workspace_id: { type: 'string', description: 'UUID do workspace.' },
        user_id: { type: 'string', description: 'UUID do user alvo.' },
        member_id: {
          type: 'string',
          description: 'UUID do registro workspace_members (alternativa a user_id).',
        },
        role: {
          type: 'string',
          enum: ['owner', 'admin', 'member'],
          description: 'Nova role.',
        },
      },
      required: ['workspace_id', 'role'],
    },
  },

  handler: async (args, ctx) => {
    const workspaceId = String(args.workspace_id ?? '').trim();
    if (!workspaceId) return { ok: false, error: 'workspace_id obrigatório' };
    if (!args.user_id && !args.member_id) {
      return { ok: false, error: 'Passe user_id ou member_id' };
    }
    if (!args.role) return { ok: false, error: 'role obrigatório' };

    const res = await fetch(
      `${ctx.internalBaseUrl}/api/router?slug=workspace-members-update-role`,
      {
        method: 'POST',
        headers: buildToolFetchHeaders(ctx),
        body: JSON.stringify({
          workspace_id: workspaceId,
          user_id: args.user_id,
          member_id: args.member_id,
          role: args.role,
        }),
      },
    ).catch((err) => {
      console.error('[updateMemberRole] fetch failed:', err);
      return null;
    });

    if (!res || !res.ok) {
      const errText = res ? await res.text().catch(() => '') : 'network';
      return { ok: false, error: `workspace-members-update-role: ${errText.slice(0, 200)}` };
    }

    const json: any = await res.json();
    const member = json?.member ?? {};

    const card: KAIActionCard = {
      id: newActionCardId(),
      planning_item_id: null,
      type: 'draft',
      status: 'done',
      data: {
        kind: 'draft',
        clientId: ctx.clientId,
        platform: 'instagram',
        format: 'team_task',
        title: `Role atualizada: ${member?.user_id ?? '?'}`,
        body: `Nova role: ${member?.role ?? args.role}`,
        briefing: workspaceId,
      },
      requires_approval: false,
      available_actions: [
        {
          id: 'view_workspace',
          label: 'Ver workspace',
          variant: 'primary',
          client_action: 'edit',
        },
      ],
    };

    return { ok: true, data: { memberId: member?.id ?? null, newRole: args.role }, card };
  },
};
