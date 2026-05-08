/**
 * Tool `toggleAutomation` — pausa ou reativa uma planning_automation.
 */
import { newActionCardId, type KAIActionCard } from './kai-stream.js';
import type { RegisteredTool } from './types.js';

interface ToggleAutomationArgs {
  automation_id: string;
  enabled: boolean;
}

interface ToggleAutomationData {
  automationId: string;
  enabled: boolean;
}

export const toggleAutomationTool: RegisteredTool<ToggleAutomationArgs, ToggleAutomationData> = {
  definition: {
    name: 'toggleAutomation',
    description:
      "Pausa (enabled=false) ou reativa (enabled=true) uma automação de conteúdo. Use quando o usuário disser 'pausa a automação X', 'desliga aquele cron', 'reativa a automação Y'.",
    parameters: {
      type: 'object',
      properties: {
        automation_id: {
          type: 'string',
          description: 'UUID da automação. Pegue de listAutomations primeiro se não souber.',
        },
        enabled: {
          type: 'boolean',
          description: 'true = ativa. false = pausa.',
        },
      },
      required: ['automation_id', 'enabled'],
    },
  },

  handler: async (args, ctx) => {
    const automationId = String(args.automation_id ?? '').trim();
    if (!automationId) return { ok: false, error: 'automation_id obrigatório' };

    const enabled = !!args.enabled;

    const res = await fetch(`${ctx.internalBaseUrl}/api/router?slug=automations-toggle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ctx.accessToken}`,
      },
      body: JSON.stringify({ automation_id: automationId, enabled }),
    }).catch((err) => {
      console.error('[toggleAutomation] fetch failed:', err);
      return null;
    });

    if (!res || !res.ok) {
      const errText = res ? await res.text().catch(() => '') : 'network';
      return { ok: false, error: `automations-toggle: ${errText.slice(0, 200)}` };
    }

    const json: any = await res.json();
    const name: string = json?.automation?.name ?? '(sem nome)';

    const card: KAIActionCard = {
      id: newActionCardId(),
      planning_item_id: null,
      type: 'draft',
      status: 'done',
      data: {
        kind: 'draft',
        clientId: ctx.clientId,
        platform: 'automation',
        format: 'automation',
        title: enabled ? `Automação ativada: ${name}` : `Automação pausada: ${name}`,
        body: enabled
          ? 'Trigger volta a rodar no próximo ciclo.'
          : 'Trigger desativado — não vai gerar mais itens até reativar.',
        briefing: automationId,
      } as Record<string, unknown>,
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

    return { ok: true, data: { automationId, enabled }, card };
  },
};
