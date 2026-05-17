/**
 * Tool `scheduleFor` — agenda rascunho via late-post handler.
 */
import { newActionCardId, type KAIActionCard } from './kai-stream.js';
import type { RegisteredTool, ToolExecutionContext } from './types.js';
import { query, queryOne } from '../db.js';
import { buildToolFetchHeaders } from './internal-headers.js';

interface ScheduleForArgs {
  planningItemId: string;
  datetime: string;
}

interface ScheduleForData {
  planningItemId: string;
  platform: string;
  scheduledFor: string;
  status: 'scheduled' | 'needs_connect' | 'failed';
}

function isNotConnectedError(status: number, body: string): boolean {
  if (status === 401 || status === 403) return true;
  const lower = body.toLowerCase();
  if (status === 400) {
    if (
      lower.includes('não conectada') ||
      lower.includes('nao conectada') ||
      lower.includes('not connected') ||
      lower.includes('reconecte') ||
      lower.includes('expiradas') ||
      lower.includes('não configurada') ||
      lower.includes('nao configurada')
    ) {
      return true;
    }
  }
  return false;
}

async function fetchOAuthUrl(
  ctx: ToolExecutionContext,
  clientId: string,
  platform: string,
): Promise<string | null> {
  try {
    const res = await fetch(`${ctx.internalBaseUrl}/api/late-oauth-start`, {
      method: 'POST',
      headers: buildToolFetchHeaders(ctx),
      body: JSON.stringify({ clientId, platform }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error(`[scheduleFor] late-oauth-start ${res.status}: ${t.slice(0, 200)}`);
      return null;
    }
    const json: any = await res.json().catch(() => ({}));
    return typeof json?.authUrl === 'string' ? json.authUrl : null;
  } catch (err) {
    console.error('[scheduleFor] late-oauth-start fetch error:', err);
    return null;
  }
}

export const scheduleForTool: RegisteredTool<ScheduleForArgs, ScheduleForData> = {
  definition: {
    name: 'scheduleFor',
    description: 'Agenda um rascunho pra publicar numa data/hora futura.',
    parameters: {
      type: 'object',
      properties: {
        planningItemId: {
          type: 'string',
          description: 'ID do rascunho em planning_items a ser agendado.',
        },
        datetime: {
          type: 'string',
          description:
            "Data e hora ISO 8601 (ex: '2026-04-21T14:30:00-03:00'). Precisa estar no futuro.",
          format: 'date-time',
        },
      },
      required: ['planningItemId', 'datetime'],
    },
  },

  handler: async (args, ctx) => {
    const planningItemId = String(args.planningItemId ?? '').trim();
    const datetime = String(args.datetime ?? '').trim();

    if (!planningItemId) return { ok: false, error: 'planningItemId é obrigatório.' };
    if (!datetime) return { ok: false, error: 'datetime é obrigatório (ISO 8601).' };

    const parsed = new Date(datetime);
    if (isNaN(parsed.getTime())) {
      return {
        ok: false,
        error: `datetime inválido: "${datetime}". Use ISO 8601 (ex: 2026-04-21T14:30:00-03:00).`,
      };
    }
    const now = Date.now();
    const MIN_AHEAD_MS = 60 * 1000;
    if (parsed.getTime() < now + MIN_AHEAD_MS) {
      return { ok: false, error: 'datetime precisa estar pelo menos 60 segundos no futuro.' };
    }
    const scheduledForIso = parsed.toISOString();

    console.log(
      `[scheduleFor] clientId=${ctx.clientId} planningItemId=${planningItemId} scheduledFor=${scheduledForIso}`,
    );

    try {
      const item = await queryOne<{
        id: string;
        client_id: string;
        platform: string;
        content: string;
        media_urls: any;
        status: string;
        scheduled_at: string | null;
      }>(
        `SELECT id, client_id, platform, content, media_urls, status, scheduled_at
           FROM planning_items
          WHERE id = $1 AND client_id = $2 LIMIT 1`,
        [planningItemId, ctx.clientId],
      );
      if (!item) {
        return { ok: false, error: 'Rascunho não encontrado ou não pertence a este cliente.' };
      }

      if (item.status === 'published') {
        const card: KAIActionCard = {
          id: newActionCardId(),
          planning_item_id: planningItemId,
          type: 'error',
          status: 'error',
          data: {
            kind: 'error',
            message: 'Já foi publicado — não dá pra agendar.',
            toolName: 'scheduleFor',
            recoverable: false,
          },
          requires_approval: false,
          available_actions: [],
        };
        return {
          ok: true,
          data: {
            planningItemId,
            platform: item.platform,
            scheduledFor: scheduledForIso,
            status: 'failed',
          },
          card,
        };
      }

      const platform = String(item.platform ?? '').toLowerCase();
      const content = String(item.content ?? '');
      const mediaUrls: string[] | undefined = Array.isArray(item.media_urls)
        ? (item.media_urls as string[])
        : undefined;

      const postResponse = await fetch(`${ctx.internalBaseUrl}/api/late-post`, {
        method: 'POST',
        headers: buildToolFetchHeaders(ctx),
        body: JSON.stringify({
          clientId: ctx.clientId,
          platform,
          content,
          mediaUrls,
          planningItemId: item.id,
          scheduledFor: scheduledForIso,
          publishNow: false,
        }),
      });

      const responseText = await postResponse.text();
      console.log(
        `[scheduleFor] late-post status=${postResponse.status} body=${responseText.slice(0, 300)}`,
      );

      if (!postResponse.ok) {
        if (isNotConnectedError(postResponse.status, responseText)) {
          const oauthUrl = await fetchOAuthUrl(
            ctx,
            ctx.clientId,
            platform,
          );
          if (oauthUrl) {
            const card: KAIActionCard = {
              id: newActionCardId(),
              planning_item_id: planningItemId,
              type: 'connect_account',
              status: 'pending_approval',
              data: {
                kind: 'connect_account',
                platform,
                oauthUrl,
                reason: `Conecte sua conta do ${platform} pra agendar`,
              },
              requires_approval: true,
              available_actions: [],
            };
            return {
              ok: true,
              data: {
                planningItemId,
                platform,
                scheduledFor: scheduledForIso,
                status: 'needs_connect',
              },
              card,
            };
          }
        }

        let userMessage = 'Falha ao agendar';
        try {
          const errJson = JSON.parse(responseText);
          if (errJson?.error) userMessage = String(errJson.error);
          else if (errJson?.message) userMessage = String(errJson.message);
        } catch {
          if (responseText) userMessage = responseText.slice(0, 200);
        }

        const card: KAIActionCard = {
          id: newActionCardId(),
          planning_item_id: planningItemId,
          type: 'error',
          status: 'error',
          data: {
            kind: 'error',
            message: userMessage,
            toolName: 'scheduleFor',
            recoverable: true,
          },
          requires_approval: false,
          available_actions: [],
        };
        return {
          ok: true,
          data: {
            planningItemId,
            platform,
            scheduledFor: scheduledForIso,
            status: 'failed',
          },
          card,
        };
      }

      try {
        await query(
          `UPDATE planning_items
              SET status = 'scheduled',
                  scheduled_at = $1,
                  updated_at = NOW()
            WHERE id = $2`,
          [scheduledForIso, planningItemId],
        );
      } catch (e: any) {
        console.warn(
          '[scheduleFor] update planning_items falhou (late-post já deve ter atualizado):',
          e?.message,
        );
      }

      const card: KAIActionCard = {
        id: newActionCardId(),
        planning_item_id: planningItemId,
        type: 'scheduled',
        status: 'done',
        data: {
          kind: 'scheduled',
          clientId: ctx.clientId,
          platform,
          scheduledFor: scheduledForIso,
          body: content,
          mediaUrls,
          planningItemId,
        },
        requires_approval: false,
        available_actions: [],
      };

      return {
        ok: true,
        data: {
          planningItemId,
          platform,
          scheduledFor: scheduledForIso,
          status: 'scheduled',
        },
        card,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[scheduleFor] error:', err);
      return { ok: false, error: message };
    }
  },
};
