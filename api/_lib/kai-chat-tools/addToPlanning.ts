/**
 * Tool `addToPlanning` — cria planning_item com conteúdo já pronto e
 * (opcionalmente) data agendada. Diferente de createContent (que gera via
 * agente), addToPlanning aceita conteúdo pronto + data e só salva no kanban.
 *
 * Use quando o usuário fala "adiciona X ao planejamento da terça que vem"
 * ou tem o conteúdo na mão e quer só agendar.
 */
import { newActionCardId, type KAIActionCard } from './kai-stream.js';
import type { RegisteredTool } from './types.js';
import { query, insertRow } from '../db.js';

interface AddToPlanningArgs {
  content: string;
  platform: string;
  format?: string;
  title?: string;
  scheduled_at?: string;
  client_id?: string;
  column_type?: 'idea' | 'draft' | 'review' | 'approved' | 'scheduled';
  media_urls?: string[];
}

interface AddToPlanningData {
  planningItemId: string;
  scheduled: boolean;
}

async function resolveColumnId(
  workspaceId: string,
  preferType: string,
): Promise<string | null> {
  const preferred = await query<{ id: string }>(
    `SELECT id FROM kanban_columns
       WHERE workspace_id = $1 AND column_type = $2
       ORDER BY position ASC LIMIT 1`,
    [workspaceId, preferType],
  );
  if (preferred.length > 0) return preferred[0].id;

  const fallback = await query<{ id: string }>(
    `SELECT id FROM kanban_columns
       WHERE workspace_id = $1
       ORDER BY (is_default IS TRUE) DESC, position ASC
       LIMIT 1`,
    [workspaceId],
  );
  return fallback[0]?.id ?? null;
}

export const addToPlanningTool: RegisteredTool<AddToPlanningArgs, AddToPlanningData> = {
  definition: {
    name: 'addToPlanning',
    description:
      "Adiciona um item já pronto ao planejamento (kanban) do cliente, com data opcional. Use quando o usuário disser 'adiciona X ao planejamento', 'agenda esse texto pra terça', 'salva isso no calendário pra sábado 10h'. Diferente de createContent (que GERA o conteúdo), aqui o texto vem pronto.",
    parameters: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'O texto/conteúdo pronto do post.',
        },
        platform: {
          type: 'string',
          enum: ['instagram', 'twitter', 'linkedin', 'youtube', 'newsletter', 'tiktok', 'threads'],
          description: 'Plataforma alvo.',
        },
        format: {
          type: 'string',
          description: 'Formato (post, carousel, reel, thread, tweet, newsletter). Default: post.',
        },
        title: {
          type: 'string',
          description: 'Título do item no kanban (até 200 chars). Default: primeiros chars do content.',
        },
        scheduled_at: {
          type: 'string',
          description: "Data ISO 8601 pra agendar (ex: '2026-05-15T14:30:00-03:00'). Omita pra não agendar (vira só rascunho).",
          format: 'date-time',
        },
        client_id: {
          type: 'string',
          description: 'UUID do cliente. Default: cliente atual.',
        },
        column_type: {
          type: 'string',
          enum: ['idea', 'draft', 'review', 'approved', 'scheduled'],
          description: 'Coluna alvo. Default: scheduled se scheduled_at presente, senão draft.',
        },
        media_urls: {
          type: 'array',
          items: { type: 'string' },
          description: 'URLs de mídia (imagens/vídeos) opcionais.',
        },
      },
      required: ['content', 'platform'],
    },
  },

  handler: async (args, ctx) => {
    const content = String(args.content ?? '').trim();
    const platform = String(args.platform ?? '').toLowerCase();
    if (!content || !platform) {
      return { ok: false, error: 'content e platform são obrigatórios.' };
    }

    const clientId = String(args.client_id ?? ctx.clientId ?? '').trim();
    if (!clientId) {
      return { ok: false, error: 'client_id é obrigatório (nenhum cliente selecionado).' };
    }

    let scheduledIso: string | null = null;
    if (args.scheduled_at) {
      const parsed = new Date(args.scheduled_at);
      if (isNaN(parsed.getTime())) {
        return {
          ok: false,
          error: `scheduled_at inválido: "${args.scheduled_at}". Use ISO 8601 (ex: 2026-04-21T14:30:00-03:00).`,
        };
      }
      scheduledIso = parsed.toISOString();
    }

    try {
      const clients = await query<{ workspace_id: string }>(
        `SELECT workspace_id FROM clients WHERE id = $1 LIMIT 1`,
        [clientId],
      );
      const workspaceId = clients[0]?.workspace_id;
      if (!workspaceId) {
        return { ok: false, error: 'Cliente não encontrado ou sem workspace.' };
      }

      const desiredColumn =
        args.column_type ?? (scheduledIso ? 'scheduled' : 'draft');
      const columnId = await resolveColumnId(workspaceId, desiredColumn);

      const fallbackTitle = (() => {
        const firstNonMetaLine = content
          .split(/\n/)
          .map((l) => l.trim())
          .find((l) => l && !/^\*\*Hook:\*\*/i.test(l) && !/^\*\*Gancho:\*\*/i.test(l));
        return (firstNonMetaLine ?? content)
          .replace(/^#+\s*/, '')
          .replace(/\*\*/g, '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 60);
      })();
      const title =
        (args.title && String(args.title).slice(0, 200)) || fallbackTitle;
      const format = String(args.format ?? 'post').toLowerCase();
      const status = scheduledIso ? 'scheduled' : 'draft';

      const item = await insertRow<{ id: string }>('planning_items', {
        title,
        content,
        platform,
        status,
        client_id: clientId,
        workspace_id: workspaceId,
        created_by: ctx.userId,
        column_id: columnId,
        scheduled_at: scheduledIso,
        media_urls: Array.isArray(args.media_urls) ? args.media_urls : [],
        metadata: JSON.stringify({
          source: 'kai-tool:addToPlanning',
          format,
        }),
      });

      const planningItemId = item.id;

      const card: KAIActionCard = scheduledIso
        ? {
            id: newActionCardId(),
            planning_item_id: planningItemId,
            type: 'scheduled',
            status: 'done',
            data: {
              kind: 'scheduled',
              clientId,
              platform,
              scheduledFor: scheduledIso,
              body: content,
              mediaUrls: Array.isArray(args.media_urls) ? args.media_urls : undefined,
              planningItemId,
            },
            requires_approval: false,
            available_actions: [
              {
                id: 'edit',
                label: 'Editar',
                variant: 'secondary',
                tool_call: { name: 'editContent', args: { planningItemId, instruction: '' } },
              },
              {
                id: 'publish_now',
                label: 'Publicar agora',
                variant: 'primary',
                tool_call: { name: 'publishNow', args: { planningItemId } },
              },
            ],
          }
        : {
            id: newActionCardId(),
            planning_item_id: planningItemId,
            type: 'draft',
            status: 'done',
            data: {
              kind: 'draft',
              clientId,
              platform,
              format,
              title,
              body: content,
              mediaUrls: Array.isArray(args.media_urls) ? args.media_urls : undefined,
              briefing: 'addToPlanning (sem data)',
            },
            requires_approval: false,
            available_actions: [
              {
                id: 'schedule',
                label: 'Agendar',
                variant: 'primary',
                client_action: 'edit',
              },
              {
                id: 'publish_now',
                label: 'Publicar agora',
                variant: 'secondary',
                tool_call: { name: 'publishNow', args: { planningItemId } },
              },
            ],
          };

      return {
        ok: true,
        data: { planningItemId, scheduled: !!scheduledIso },
        card,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[addToPlanning] error:', err);
      return { ok: false, error: message };
    }
  },
};
