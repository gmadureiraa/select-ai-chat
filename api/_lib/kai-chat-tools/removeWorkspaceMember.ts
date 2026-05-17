/**
 * Tool `removeWorkspaceMember` — remove membro do workspace. AÇÃO SENSÍVEL:
 * sempre exige `approved: true` antes de executar (frontend mostra modal de
 * confirmação e re-chama com approved=true).
 */
import { newActionCardId, type KAIActionCard } from './kai-stream.js';
import type { RegisteredTool } from './types.js';
import { buildToolFetchHeaders } from './internal-headers.js';

interface RemoveWorkspaceMemberArgs {
  workspace_id: string;
  user_id?: string;
  member_id?: string;
  approved?: boolean;
}

interface RemoveWorkspaceMemberData {
  removedUserId?: string;
  memberId?: string;
  requiresApproval?: boolean;
}

export const removeWorkspaceMemberTool: RegisteredTool<
  RemoveWorkspaceMemberArgs,
  RemoveWorkspaceMemberData
> = {
  definition: {
    name: 'removeWorkspaceMember',
    description:
      'Remove um membro do workspace. AÇÃO DESTRUTIVA — sempre passa requires_approval na primeira chamada. UI mostra modal "tem certeza?" e re-chama com approved=true. Use quando o usuário pedir "remove o João do workspace", "kicka o membro X".',
    parameters: {
      type: 'object',
      properties: {
        workspace_id: { type: 'string', description: 'UUID do workspace.' },
        user_id: { type: 'string', description: 'UUID do user a remover.' },
        member_id: {
          type: 'string',
          description: 'UUID do registro em workspace_members (alternativa a user_id).',
        },
        approved: {
          type: 'boolean',
          description:
            'true quando o usuário JÁ confirmou a remoção via UI. Sempre false na primeira chamada.',
        },
      },
      required: ['workspace_id'],
    },
  },

  handler: async (args, ctx) => {
    const workspaceId = String(args.workspace_id ?? '').trim();
    if (!workspaceId) return { ok: false, error: 'workspace_id obrigatório' };
    if (!args.user_id && !args.member_id) {
      return { ok: false, error: 'Passe user_id ou member_id' };
    }

    // Sensível — exige aprovação prévia
    if (!args.approved) {
      const card: KAIActionCard = {
        id: newActionCardId(),
        planning_item_id: null,
        type: 'draft',
        status: 'pending_approval',
        data: {
          kind: 'draft',
          clientId: ctx.clientId,
          platform: 'instagram',
          format: 'team_task',
          title: 'Confirmar remoção de membro',
          body: `Tem certeza que quer remover ${args.user_id ?? args.member_id} do workspace ${workspaceId}? Essa ação é permanente.`,
          briefing: workspaceId,
        },
        requires_approval: true,
        available_actions: [
          {
            id: 'confirm_remove',
            label: 'Remover',
            variant: 'danger',
            tool_call: {
              name: 'removeWorkspaceMember',
              args: { ...args, approved: true },
            },
          },
          {
            id: 'cancel',
            label: 'Cancelar',
            variant: 'ghost',
            client_action: 'edit',
          },
        ],
      };
      return {
        ok: true,
        data: { requiresApproval: true },
        card,
      };
    }

    const res = await fetch(`${ctx.internalBaseUrl}/api/router?slug=workspace-members-remove`, {
      method: 'POST',
      headers: buildToolFetchHeaders(ctx),
      body: JSON.stringify({
        workspace_id: workspaceId,
        user_id: args.user_id,
        member_id: args.member_id,
      }),
    }).catch((err) => {
      console.error('[removeWorkspaceMember] fetch failed:', err);
      return null;
    });

    if (!res || !res.ok) {
      const errText = res ? await res.text().catch(() => '') : 'network';
      return { ok: false, error: `workspace-members-remove: ${errText.slice(0, 200)}` };
    }

    const json: any = await res.json();
    const removed = json?.removed ?? {};

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
        title: 'Membro removido',
        body: `User ${removed?.user_id ?? '?'} (role ${removed?.role ?? '?'}) removido do workspace.`,
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

    return {
      ok: true,
      data: { removedUserId: removed?.user_id, memberId: removed?.id },
      card,
    };
  },
};
