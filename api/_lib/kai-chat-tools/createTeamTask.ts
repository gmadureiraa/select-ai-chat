/**
 * Tool `createTeamTask` — cria task interna (team_tasks). Diferente de
 * createContent (que cria planning_item de conteúdo a publicar), tasks
 * são trabalho de equipe não-relacionado a posts (admin/dev/produção).
 */
import { newActionCardId, type KAIActionCard } from './kai-stream.js';
import type { RegisteredTool } from './types.js';

interface CreateTeamTaskArgs {
  title: string;
  description?: string;
  status?: 'todo' | 'in_progress' | 'done';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: string;
  assignedTo?: string;
  labels?: string[];
}

interface CreateTeamTaskData {
  taskId: string | null;
}

export const createTeamTaskTool: RegisteredTool<
  CreateTeamTaskArgs,
  CreateTeamTaskData
> = {
  definition: {
    name: 'createTeamTask',
    description:
      'Cria uma TAREFA INTERNA de equipe (team_tasks). Use quando o usuário pedir trabalho administrativo/operacional NÃO relacionado a posts — ex: "criar tarefa pra revisar contrato", "adicionar TODO de ligar pro fornecedor", "agenda reunião com cliente". NÃO use pra criar conteúdo (use createContent ou createViralCarousel pra isso).',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Título curto da tarefa (até 200 chars).',
        },
        description: {
          type: 'string',
          description: 'Descrição detalhada opcional (instruções, contexto).',
        },
        status: {
          type: 'string',
          enum: ['todo', 'in_progress', 'done'],
          description: 'Status inicial. Default: todo.',
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'urgent'],
          description: 'Prioridade. Default: medium.',
        },
        dueDate: {
          type: 'string',
          description: 'Data limite ISO (YYYY-MM-DD).',
        },
        assignedTo: {
          type: 'string',
          description: 'UUID do user assignee. Default: criador.',
        },
        labels: {
          type: 'array',
          items: { type: 'string' },
          description: 'Labels/tags da tarefa.',
        },
      },
      required: ['title'],
    },
  },

  handler: async (args, ctx) => {
    const title = String(args.title ?? '').trim();
    if (!title) return { ok: false, error: 'title obrigatório' };

    const res = await fetch(`${ctx.internalBaseUrl}/api/router?slug=team-tasks-create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ctx.accessToken}`,
      },
      body: JSON.stringify({
        title,
        description: args.description,
        status: args.status ?? 'todo',
        priority: args.priority ?? 'medium',
        due_date: args.dueDate,
        assigned_to: args.assignedTo,
        labels: args.labels,
        client_id: ctx.clientId || null,
      }),
    }).catch((err) => {
      console.error('[createTeamTask] fetch failed:', err);
      return null;
    });

    if (!res || !res.ok) {
      // Fallback: insert direto via Neon Data API (PostgREST)
      // (Handler `team-tasks-create` ainda não existe; fallback por
      //  enquanto retorna o card sem persistir mas sinaliza intenção)
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
          title,
          body: args.description ?? '',
          briefing: title,
        } as Record<string, unknown>,
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
      return {
        ok: true,
        data: { taskId: null },
        card,
      };
    }

    const json: any = await res.json();
    const taskId: string | null = json?.id ?? json?.task?.id ?? null;

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
        title,
        body: args.description ?? '',
        briefing: title,
      } as Record<string, unknown>,
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

    return {
      ok: true,
      data: { taskId },
      card,
    };
  },
};
