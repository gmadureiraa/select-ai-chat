/**
 * Tool `updateWorkflow` — edita config de um ai_workflow existente
 * (name/description/schedule_cron/is_active/config). Wrapper sobre o handler
 * `ai-workflow-update`.
 */
import { newActionCardId, type KAIActionCard } from './kai-stream.js';
import type { RegisteredTool } from './types.js';
import { buildToolFetchHeaders } from './internal-headers.js';

interface UpdateWorkflowArgs {
  workflowId: string;
  name?: string;
  description?: string | null;
  schedule_cron?: string;
  is_active?: boolean;
  config?: Record<string, unknown>;
}

interface UpdateWorkflowData {
  workflowId: string;
  fieldsUpdated: string[];
}

export const updateWorkflowTool: RegisteredTool<UpdateWorkflowArgs, UpdateWorkflowData> = {
  definition: {
    name: 'updateWorkflow',
    description:
      'Edita um AI workflow existente (ai_workflows). Use quando o usuário pedir "muda o cron desse workflow", "ajusta o prompt do workflow X", "pausa workflow Y", "renomeia". Cada campo é opcional — só atualiza o que vier. config é jsonb livre (contém prompt, params, etc).',
    parameters: {
      type: 'object',
      properties: {
        workflowId: { type: 'string', description: 'UUID do ai_workflow.' },
        name: { type: 'string', description: 'Novo nome (até 200 chars).' },
        description: {
          type: 'string',
          description: 'Nova descrição (até 5000 chars). null pra limpar.',
        },
        schedule_cron: {
          type: 'string',
          description:
            'Cron expression (5 segmentos: "min hour dom month dow"). Ex: "0 10 * * *" pra rodar todo dia às 10h.',
        },
        is_active: {
          type: 'boolean',
          description: 'true = workflow ativo (roda no cron). false = pausado.',
        },
        config: {
          type: 'object',
          description:
            'Config jsonb livre. Conteúdo depende do workflow (geralmente: { prompt, model, params, output_format }).',
        },
      },
      required: ['workflowId'],
    },
  },

  handler: async (args, ctx) => {
    const workflowId = String(args.workflowId ?? '').trim();
    if (!workflowId) return { ok: false, error: 'workflowId obrigatório' };

    const fieldsUpdated = Object.keys(args).filter(
      (k) => k !== 'workflowId' && (args as any)[k] !== undefined,
    );
    if (fieldsUpdated.length === 0) {
      return { ok: false, error: 'Passe ao menos um campo pra atualizar.' };
    }

    const res = await fetch(`${ctx.internalBaseUrl}/api/router?slug=ai-workflow-update`, {
      method: 'POST',
      headers: buildToolFetchHeaders(ctx),
      body: JSON.stringify({ ...args, id: workflowId }),
    }).catch((err) => {
      console.error('[updateWorkflow] fetch failed:', err);
      return null;
    });

    if (!res || !res.ok) {
      const errText = res ? await res.text().catch(() => '') : 'network';
      return { ok: false, error: `ai-workflow-update: ${errText.slice(0, 200)}` };
    }

    const json: any = await res.json();
    const workflow = json?.workflow ?? {};

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
        title: `Workflow atualizado: ${workflow?.name ?? '(sem nome)'}`,
        body: `Campos atualizados: ${fieldsUpdated.join(', ')}${
          workflow?.schedule_cron ? `\nCron: ${workflow.schedule_cron}` : ''
        }${typeof workflow?.is_active === 'boolean' ? `\nAtivo: ${workflow.is_active ? 'sim' : 'não'}` : ''}`,
        briefing: workflowId,
      },
      requires_approval: false,
      available_actions: [
        {
          id: 'view_workflow',
          label: 'Ver workflow',
          variant: 'primary',
          client_action: 'edit',
        },
      ],
    };

    return { ok: true, data: { workflowId, fieldsUpdated }, card };
  },
};
