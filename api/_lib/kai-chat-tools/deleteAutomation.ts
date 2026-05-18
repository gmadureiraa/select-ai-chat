/**
 * Tool `deleteAutomation` — remove uma planning_automation. AÇÃO
 * DESTRUTIVA — exige `approved: true`. Diferente de toggleAutomation (que
 * só pausa), aqui apaga a row inteira.
 */
import { newActionCardId, type KAIActionCard } from './kai-stream.js';
import type { RegisteredTool } from './types.js';
import { buildToolFetchHeaders } from './internal-headers.js';
import { query } from '../db.js';
import { requireApproval, consumeApprovalToken, type ApprovalRequest } from '../approval-flow.js';

interface DeleteAutomationArgs {
  automationId: string;
  approved?: boolean;
  callbackToken?: string;
}

interface DeleteAutomationData {
  automationId: string;
  requiresApproval?: boolean;
}

export const deleteAutomationTool: RegisteredTool<DeleteAutomationArgs, DeleteAutomationData | ApprovalRequest> = {
  definition: {
    name: 'deleteAutomation',
    description:
      'Remove permanentemente uma planning_automation. AÇÃO DESTRUTIVA — sempre passa requires_approval na primeira chamada. Use toggleAutomation com enabled=false pra apenas pausar (recuperável). Use deleteAutomation só quando o usuário pedir EXPLICITAMENTE pra "apagar/deletar/remover automação".',
    parameters: {
      type: 'object',
      properties: {
        automationId: { type: 'string', description: 'UUID da planning_automation.' },
        approved: {
          type: 'boolean',
          description: 'true quando o usuário JÁ confirmou via UI. Sempre false na primeira chamada.',
        },
        callbackToken: {
          type: 'string',
          description: 'Token devolvido na 1ª chamada. OBRIGATÓRIO quando approved=true.',
        },
      },
      required: ['automationId'],
    },
  },

  handler: async (args, ctx) => {
    const automationId = String(args.automationId ?? '').trim();
    if (!automationId) return { ok: false, error: 'automationId obrigatório' };

    let name = '(sem nome)';
    let triggerType = '';
    try {
      const rows = await query<{ name: string; trigger_type: string }>(
        `SELECT name, trigger_type FROM planning_automations WHERE id = $1 LIMIT 1`,
        [automationId],
      );
      if (rows[0]) {
        name = rows[0].name ?? name;
        triggerType = rows[0].trigger_type ?? '';
      } else {
        return { ok: false, error: 'Automação não encontrada' };
      }
    } catch (err) {
      console.warn('[deleteAutomation] preview fetch failed:', err);
    }

    if (!args.approved) {
      const approval = await requireApproval({
        action: 'delete_automation',
        createdBy: ctx.userId,
        payload: { automationId, triggerType },
        preview: {
          title: 'Deletar automação?',
          description: `Apagar a automação "${name}" (${triggerType}) permanentemente? Pra apenas pausar, use toggleAutomation.`,
          impactedItems: [{ id: automationId, label: name }],
          irreversible: true,
        },
        toolName: 'deleteAutomation',
        toolArgs: { automationId, approved: true },
      });
      const card: KAIActionCard = {
        id: newActionCardId(),
        planning_item_id: null,
        type: 'draft',
        status: 'pending_approval',
        data: {
          kind: 'draft',
          clientId: ctx.clientId,
          platform: 'instagram',
          format: 'automation',
          title: 'Confirmar deleção de automação',
          body: `Tem certeza que quer DELETAR a automação "${name}" (${triggerType})? Essa ação é permanente. Pra apenas pausar, use toggleAutomation.`,
          briefing: automationId,
        },
        requires_approval: true,
        available_actions: [
          {
            id: 'confirm_delete',
            label: 'Deletar',
            variant: 'danger',
            tool_call: {
              name: 'deleteAutomation',
              args: { automationId, approved: true, callbackToken: approval.callbackToken },
            },
          },
          {
            id: 'pause_instead',
            label: 'Apenas pausar',
            variant: 'secondary',
            tool_call: {
              name: 'toggleAutomation',
              args: { automation_id: automationId, enabled: false },
            },
          },
          { id: 'cancel', label: 'Cancelar', variant: 'ghost', client_action: 'edit' },
        ],
      };
      return { ok: true, data: approval, card };
    }

    const token = typeof args.callbackToken === 'string' ? args.callbackToken : '';
    if (!(await consumeApprovalToken(token, 'delete_automation'))) {
      return {
        ok: false,
        error:
          'Token de aprovação inválido, expirado ou já consumido. Chame deleteAutomation SEM approved primeiro pra gerar um novo token.',
      };
    }

    const res = await fetch(`${ctx.internalBaseUrl}/api/router?slug=automations-delete`, {
      method: 'POST',
      headers: buildToolFetchHeaders(ctx),
      body: JSON.stringify({ id: automationId }),
    }).catch((err) => {
      console.error('[deleteAutomation] fetch failed:', err);
      return null;
    });

    if (!res || !res.ok) {
      const errText = res ? await res.text().catch(() => '') : 'network';
      return { ok: false, error: `automations-delete: ${errText.slice(0, 200)}` };
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
        format: 'automation',
        title: 'Automação deletada',
        body: `"${name}" foi removida permanentemente.`,
        briefing: automationId,
      },
      requires_approval: false,
      available_actions: [
        {
          id: 'view_automations',
          label: 'Ver automações',
          variant: 'primary',
          client_action: 'edit',
        },
      ],
    };

    return { ok: true, data: { automationId }, card };
  },
};
