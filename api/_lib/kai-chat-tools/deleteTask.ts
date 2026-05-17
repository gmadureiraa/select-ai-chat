/**
 * Tool `deleteTask` — deleta uma team_task. AÇÃO DESTRUTIVA — exige
 * `approved: true`.
 */
import { newActionCardId, type KAIActionCard } from './kai-stream.js';
import type { RegisteredTool } from './types.js';
import { buildToolFetchHeaders } from './internal-headers.js';
import { query } from '../db.js';

interface DeleteTaskArgs {
  taskId: string;
  approved?: boolean;
}

interface DeleteTaskData {
  taskId: string;
  requiresApproval?: boolean;
}

export const deleteTaskTool: RegisteredTool<DeleteTaskArgs, DeleteTaskData> = {
  definition: {
    name: 'deleteTask',
    description:
      'Deleta uma team_task. AÇÃO DESTRUTIVA — sempre passa requires_approval na primeira chamada. UI mostra modal "tem certeza?" e re-chama com approved=true.',
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'UUID da team_task.' },
        approved: {
          type: 'boolean',
          description:
            'true quando o usuário JÁ confirmou via UI. Sempre false na primeira chamada.',
        },
      },
      required: ['taskId'],
    },
  },

  handler: async (args, ctx) => {
    const taskId = String(args.taskId ?? '').trim();
    if (!taskId) return { ok: false, error: 'taskId obrigatório' };

    let title = '(sem título)';
    try {
      const rows = await query<{ title: string }>(
        `SELECT title FROM team_tasks WHERE id = $1 LIMIT 1`,
        [taskId],
      );
      if (rows[0]) title = rows[0].title ?? title;
      else return { ok: false, error: 'Tarefa não encontrada' };
    } catch (err) {
      console.warn('[deleteTask] preview fetch failed:', err);
    }

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
          title: 'Confirmar deleção',
          body: `Tem certeza que quer deletar a tarefa "${title}"? Essa ação é permanente.`,
          briefing: taskId,
        },
        requires_approval: true,
        available_actions: [
          {
            id: 'confirm_delete',
            label: 'Deletar',
            variant: 'danger',
            tool_call: { name: 'deleteTask', args: { taskId, approved: true } },
          },
          { id: 'cancel', label: 'Cancelar', variant: 'ghost', client_action: 'edit' },
        ],
      };
      return { ok: true, data: { taskId, requiresApproval: true }, card };
    }

    const res = await fetch(`${ctx.internalBaseUrl}/api/router?slug=team-tasks-delete`, {
      method: 'POST',
      headers: buildToolFetchHeaders(ctx),
      body: JSON.stringify({ id: taskId }),
    }).catch((err) => {
      console.error('[deleteTask] fetch failed:', err);
      return null;
    });

    if (!res || !res.ok) {
      const errText = res ? await res.text().catch(() => '') : 'network';
      return { ok: false, error: `team-tasks-delete: ${errText.slice(0, 200)}` };
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
        format: 'team_task',
        title: 'Tarefa deletada',
        body: `"${title}" foi removida.`,
        briefing: taskId,
      },
      requires_approval: false,
      available_actions: [
        {
          id: 'view_tasks',
          label: 'Ver tarefas',
          variant: 'primary',
          client_action: 'edit',
        },
      ],
    };

    return { ok: true, data: { taskId }, card };
  },
};
