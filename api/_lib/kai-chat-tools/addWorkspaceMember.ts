/**
 * Tool `addWorkspaceMember` — cria invite pra adicionar membro novo ao
 * workspace. Não envia email automaticamente (a UI faz isso ao mostrar o
 * card); só cria o registro em workspace_invites.
 */
import { newActionCardId, type KAIActionCard } from './kai-stream.js';
import type { RegisteredTool } from './types.js';
import { buildToolFetchHeaders } from './internal-headers.js';

interface AddWorkspaceMemberArgs {
  email: string;
  role?: 'owner' | 'admin' | 'member';
  workspace_id?: string;
  expires_in_days?: number;
}

interface AddWorkspaceMemberData {
  inviteId: string | null;
  email: string;
  role: string;
}

export const addWorkspaceMemberTool: RegisteredTool<
  AddWorkspaceMemberArgs,
  AddWorkspaceMemberData
> = {
  definition: {
    name: 'addWorkspaceMember',
    description:
      'Cria invite pra adicionar membro novo ao workspace. Use quando o usuário pedir "convida fulano@email pro workspace", "adiciona o João como admin". Cria o invite (expira em 7 dias por padrão); a UI dispara o email.',
    parameters: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          description: 'Email do convidado (será normalizado pra lowercase).',
        },
        role: {
          type: 'string',
          enum: ['owner', 'admin', 'member'],
          description: 'Role inicial. Default: member.',
        },
        workspace_id: {
          type: 'string',
          description:
            'UUID do workspace alvo. Default: workspace ativo do user (precisa ser admin/owner).',
        },
        expires_in_days: {
          type: 'integer',
          description: 'Quantos dias pra o invite expirar (1-60). Default: 7.',
        },
      },
      required: ['email'],
    },
  },

  handler: async (args, ctx) => {
    const email = String(args.email ?? '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      return { ok: false, error: 'email inválido' };
    }
    const role = args.role ?? 'member';

    const res = await fetch(`${ctx.internalBaseUrl}/api/router?slug=workspace-members-add`, {
      method: 'POST',
      headers: buildToolFetchHeaders(ctx),
      body: JSON.stringify({
        email,
        role,
        workspace_id: args.workspace_id,
        expires_in_days: args.expires_in_days,
      }),
    }).catch((err) => {
      console.error('[addWorkspaceMember] fetch failed:', err);
      return null;
    });

    if (!res || !res.ok) {
      const errText = res ? await res.text().catch(() => '') : 'network';
      return { ok: false, error: `workspace-members-add: ${errText.slice(0, 200)}` };
    }

    const json: any = await res.json();
    const inviteId: string | null = json?.id ?? json?.invite?.id ?? null;
    const expiresAt: string | null = json?.invite?.expires_at ?? null;

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
        title: `Convite criado: ${email}`,
        body: `Role: ${role}${expiresAt ? `\nExpira em: ${new Date(expiresAt).toLocaleDateString('pt-BR')}` : ''}`,
        briefing: email,
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

    return { ok: true, data: { inviteId, email, role }, card };
  },
};
