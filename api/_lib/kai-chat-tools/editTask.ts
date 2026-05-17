/**
 * Tool `editTask` — edita título/descrição/status/priority/due_date de uma
 * team_task existente. Não-destrutiva (não exige approval), mas faz access
 * check antes (workspace_members owner/admin ou super_admin).
 */
import { newActionCardId, type KAIActionCard } from './kai-stream.js';
import type { RegisteredTool } from './types.js';
import { buildToolFetchHeaders } from './internal-headers.js';

interface EditTaskArgs {
  taskId: string;
  title?: string;
  description?: string | null;
  status?: 'todo' | 'in_progress' | 'done';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  due_date?: string | null;
  assigned_to?: string | null;
  labels?: string[];
}

interface EditTaskData {
  taskId: string;
  fieldsUpdated: string[];
}

export const editTaskTool: RegisteredTool<EditTaskArgs, EditTaskData> = {
  definition: {
    name: 'editTask',
    description:
      'Edita uma team_task existente. Use quando o usuário pedir "muda o status da tarefa X pra done", "renomeia essa task", "marca como urgente", "muda o prazo". Cada campo é opcional — só atualiza o que foi enviado.',
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'UUID da team_task.' },
        title: { type: 'string', description: 'Novo título (até 200 chars).' },
        description: { type: 'string', description: 'Nova descrição (até 5000 chars).' },
        status: {
          type: 'string',
          enum: ['todo', 'in_progress', 'done'],
          description: 'Novo status.',
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'urgent'],
          description: 'Nova prioridade.',
        },
        due_date: {
          type: 'string',
          description: 'Nova data limite ISO (YYYY-MM-DD). Passe null pra remover.',
        },
        assigned_to: {
          type: 'string',
          description: 'UUID do novo assignee. Passe null pra desatribuir.',
        },
        labels: {
          type: 'array',
          items: { type: 'string' },
          description: 'Lista completa de labels (substitui a anterior).',
        },
      },
      required: ['taskId'],
    },
  },

  handler: async (args, ctx) => {
    const taskId = String(args.taskId ?? '').trim();
    if (!taskId) return { ok: false, error: 'taskId obrigatório' };

    const fieldsUpdated = Object.keys(args).filter(
      (k) => k !== 'taskId' && (args as any)[k] !== undefined,
    );
    if (fieldsUpdated.length === 0) {
      return { ok: false, error: 'Passe ao menos um campo pra atualizar.' };
    }

    const res = await fetch(`${ctx.internalBaseUrl}/api/router?slug=team-tasks-update`, {
      method: 'POST',
      headers: buildToolFetchHeaders(ctx),
      body: JSON.stringify({ ...args, id: taskId }),
    }).catch((err) => {
      console.error('[editTask] fetch failed:', err);
      return null;
    });

    if (!res || !res.ok) {
      const errText = res ? await res.text().catch(() => '') : 'network';
      return { ok: false, error: `team-tasks-update: ${errText.slice(0, 200)}` };
    }

    const json: any = await res.json();
    const task = json?.task ?? {};

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
        title: `Tarefa atualizada: ${task?.title ?? '(sem título)'}`,
        body: `Campos atualizados: ${fieldsUpdated.join(', ')}`,
        briefing: taskId,
      },
      requires_approval: false,
      available_actions: [
        {
          id: 'view_in_tasks',
          label: 'Ver em Tarefas',
          variant: 'primary',
          client_action: 'edit',
        },
      ],
    };

    return { ok: true, data: { taskId, fieldsUpdated }, card };
  },
};
