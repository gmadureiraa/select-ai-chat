/**
 * Tool `deleteReference` — remove uma row de client_reference_library.
 * AÇÃO DESTRUTIVA — exige `approved: true`.
 */
import { newActionCardId, type KAIActionCard } from './kai-stream.js';
import type { RegisteredTool } from './types.js';
import { buildToolFetchHeaders } from './internal-headers.js';
import { query } from '../db.js';
import { requireApproval, consumeApprovalToken } from '../approval-flow.js';

interface DeleteReferenceArgs {
  referenceId: string;
  approved?: boolean;
  callbackToken?: string;
}

interface DeleteReferenceData {
  referenceId: string;
  requiresApproval?: boolean;
}

export const deleteReferenceTool: RegisteredTool<DeleteReferenceArgs, DeleteReferenceData> = {
  definition: {
    name: 'deleteReference',
    description:
      'Remove uma reference da library do cliente. AÇÃO DESTRUTIVA — sempre passa requires_approval na primeira chamada.',
    parameters: {
      type: 'object',
      properties: {
        referenceId: { type: 'string', description: 'UUID da reference.' },
        approved: {
          type: 'boolean',
          description: 'true quando o usuário JÁ confirmou via UI. Sempre false na primeira chamada.',
        },
        callbackToken: {
          type: 'string',
          description: 'Token devolvido na 1ª chamada. OBRIGATÓRIO quando approved=true.',
        },
      },
      required: ['referenceId'],
    },
  },

  handler: async (args, ctx) => {
    const referenceId = String(args.referenceId ?? '').trim();
    if (!referenceId) return { ok: false, error: 'referenceId obrigatório' };

    let title = '(sem título)';
    try {
      const rows = await query<{ title: string }>(
        `SELECT title FROM client_reference_library WHERE id = $1 LIMIT 1`,
        [referenceId],
      );
      if (rows[0]) title = rows[0].title ?? title;
      else return { ok: false, error: 'Reference não encontrada' };
    } catch (err) {
      console.warn('[deleteReference] preview fetch failed:', err);
    }

    if (!args.approved) {
      const approval = requireApproval({
        action: 'delete_reference',
        preview: {
          title: 'Remover reference da library?',
          description: `Remover "${title}" da library do cliente? Essa ação é permanente.`,
          impactedItems: [{ id: referenceId, label: title }],
          irreversible: true,
        },
        toolName: 'deleteReference',
        toolArgs: { referenceId, approved: true },
      });
      const card: KAIActionCard = {
        id: newActionCardId(),
        planning_item_id: null,
        type: 'library_match',
        status: 'pending_approval',
        data: {
          kind: 'library_match',
          clientId: ctx.clientId,
          matches: [
            {
              id: referenceId,
              title,
              snippet: `Tem certeza que quer remover "${title}" da library?`,
            },
          ],
        },
        requires_approval: true,
        available_actions: [
          {
            id: 'confirm_delete',
            label: 'Remover',
            variant: 'danger',
            tool_call: {
              name: 'deleteReference',
              args: { referenceId, approved: true, callbackToken: approval.callbackToken },
            },
          },
          { id: 'cancel', label: 'Cancelar', variant: 'ghost', client_action: 'edit' },
        ],
      };
      return { ok: true, data: approval, card };
    }

    const token = typeof args.callbackToken === 'string' ? args.callbackToken : '';
    if (!consumeApprovalToken(token, 'delete_reference')) {
      return {
        ok: false,
        error:
          'Token de aprovação inválido, expirado ou já consumido. Chame deleteReference SEM approved primeiro pra gerar um novo token.',
      };
    }

    const res = await fetch(`${ctx.internalBaseUrl}/api/router?slug=reference-delete`, {
      method: 'POST',
      headers: buildToolFetchHeaders(ctx),
      body: JSON.stringify({ id: referenceId }),
    }).catch((err) => {
      console.error('[deleteReference] fetch failed:', err);
      return null;
    });

    if (!res || !res.ok) {
      const errText = res ? await res.text().catch(() => '') : 'network';
      return { ok: false, error: `reference-delete: ${errText.slice(0, 200)}` };
    }

    const card: KAIActionCard = {
      id: newActionCardId(),
      planning_item_id: null,
      type: 'library_match',
      status: 'done',
      data: {
        kind: 'library_match',
        clientId: ctx.clientId,
        matches: [
          {
            id: referenceId,
            title: 'Removido',
            snippet: `"${title}" foi removido da library.`,
          },
        ],
      },
      requires_approval: false,
      available_actions: [
        {
          id: 'view_in_library',
          label: 'Ver biblioteca',
          variant: 'primary',
          client_action: 'edit',
        },
      ],
    };

    return { ok: true, data: { referenceId }, card };
  },
};
