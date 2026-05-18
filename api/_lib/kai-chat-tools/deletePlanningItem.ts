/**
 * Tool `deletePlanningItem` — alias semântico de deleteContent quando o
 * usuário fala em "item do planejamento" / "card do kanban" em vez de
 * "post" ou "conteúdo". Mesma lógica, mesmo handler.
 *
 * AÇÃO DESTRUTIVA — exige `approved: true`.
 */
import { newActionCardId, type KAIActionCard } from './kai-stream.js';
import type { RegisteredTool } from './types.js';
import { buildToolFetchHeaders } from './internal-headers.js';
import { query } from '../db.js';
import { requireApproval, consumeApprovalToken, type ApprovalRequest } from '../approval-flow.js';

interface DeletePlanningItemArgs {
  itemId: string;
  approved?: boolean;
  callbackToken?: string;
  force?: boolean;
}

interface DeletePlanningItemData {
  itemId: string;
  requiresApproval?: boolean;
  wasPublished?: boolean;
}

export const deletePlanningItemTool: RegisteredTool<
  DeletePlanningItemArgs,
  DeletePlanningItemData | ApprovalRequest
> = {
  definition: {
    name: 'deletePlanningItem',
    description:
      'Deleta um item do planejamento (planning_items). Use quando o usuário pedir "remove esse card", "tira do planejamento", "deleta esse item do kanban". Sinônimo de deleteContent — usa quando o framing é "planejamento/card" em vez de "conteúdo".',
    parameters: {
      type: 'object',
      properties: {
        itemId: { type: 'string', description: 'UUID do planning_item.' },
        approved: {
          type: 'boolean',
          description: 'true quando o usuário JÁ confirmou via UI. Sempre false na primeira chamada.',
        },
        callbackToken: {
          type: 'string',
          description:
            'Token devolvido na 1ª chamada. OBRIGATÓRIO quando approved=true.',
        },
        force: {
          type: 'boolean',
          description: 'true pra forçar delete mesmo de item já publicado.',
        },
      },
      required: ['itemId'],
    },
  },

  handler: async (args, ctx) => {
    const itemId = String(args.itemId ?? '').trim();
    if (!itemId) return { ok: false, error: 'itemId obrigatório' };

    let title = '(sem título)';
    let wasPublished = false;
    try {
      const rows = await query<{ title: string; status: string; published_at: string | null }>(
        `SELECT title, status, published_at FROM planning_items WHERE id = $1 LIMIT 1`,
        [itemId],
      );
      const item = rows[0];
      if (item) {
        title = item.title ?? title;
        wasPublished = item.status === 'published' || !!item.published_at;
      } else {
        return { ok: false, error: 'Item não encontrado' };
      }
    } catch (err) {
      console.warn('[deletePlanningItem] preview fetch failed:', err);
    }

    if (!args.approved) {
      const approval = await requireApproval({
        action: 'delete_planning_item',
        createdBy: ctx.userId,
        payload: { itemId, wasPublished },
        preview: {
          title: 'Confirmar deleção do item',
          description: `Remover "${title}" do planejamento?${
            wasPublished
              ? '\n\nEste item já foi publicado. Remover não despublica da plataforma.'
              : ''
          }`,
          impactedItems: [{ id: itemId, label: title }],
          irreversible: true,
        },
        toolName: 'deletePlanningItem',
        toolArgs: { itemId, approved: true, force: wasPublished ? true : undefined },
      });
      const card: KAIActionCard = {
        id: newActionCardId(),
        planning_item_id: itemId,
        type: 'draft',
        status: 'pending_approval',
        data: {
          kind: 'draft',
          clientId: ctx.clientId,
          platform: 'instagram',
          format: 'post',
          title: 'Confirmar deleção do item',
          body: `Tem certeza que quer remover "${title}" do planejamento?${
            wasPublished
              ? '\n\nEste item já foi publicado. Remover não despublica da plataforma.'
              : ''
          }`,
          briefing: itemId,
        },
        requires_approval: true,
        available_actions: [
          {
            id: 'confirm_delete',
            label: 'Remover',
            variant: 'danger',
            tool_call: {
              name: 'deletePlanningItem',
              args: {
                itemId,
                approved: true,
                callbackToken: approval.callbackToken,
                force: wasPublished ? true : undefined,
              },
            },
          },
          { id: 'cancel', label: 'Cancelar', variant: 'ghost', client_action: 'edit' },
        ],
      };
      return { ok: true, data: approval, card };
    }

    // Aprovado — exige token válido (single-use, TTL 5min).
    const token = typeof args.callbackToken === 'string' ? args.callbackToken : '';
    if (!(await consumeApprovalToken(token, 'delete_planning_item'))) {
      return {
        ok: false,
        error:
          'Token de aprovação inválido, expirado ou já consumido. Chame deletePlanningItem SEM approved primeiro pra gerar um novo token.',
      };
    }

    if (wasPublished && !args.force) {
      return {
        ok: false,
        error: 'Item já publicado — passe force=true pra remover do planejamento.',
      };
    }

    const res = await fetch(`${ctx.internalBaseUrl}/api/router?slug=planning-items-delete`, {
      method: 'POST',
      headers: buildToolFetchHeaders(ctx),
      body: JSON.stringify({ id: itemId }),
    }).catch((err) => {
      console.error('[deletePlanningItem] fetch failed:', err);
      return null;
    });

    if (!res || !res.ok) {
      const errText = res ? await res.text().catch(() => '') : 'network';
      return { ok: false, error: `planning-items-delete: ${errText.slice(0, 200)}` };
    }

    const card: KAIActionCard = {
      id: newActionCardId(),
      planning_item_id: null,
      type: 'draft',
      status: 'done',
      data: {
        kind: 'draft',
        clientId: ctx.clientId,
        platform: 'instagram',
        format: 'post',
        title: 'Item removido',
        body: `"${title}" foi removido do planejamento.`,
        briefing: itemId,
      },
      requires_approval: false,
      available_actions: [
        {
          id: 'view_planning',
          label: 'Ver planejamento',
          variant: 'primary',
          client_action: 'edit',
        },
      ],
    };

    return { ok: true, data: { itemId, wasPublished }, card };
  },
};
