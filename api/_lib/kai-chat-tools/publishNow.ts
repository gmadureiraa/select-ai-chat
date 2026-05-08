/**
 * Tool `publishNow` — publica rascunho via late-post handler.
 */
import { newActionCardId, type KAIActionCard } from './kai-stream.js';
import type { RegisteredTool } from './types.js';
import { query, queryOne } from '../db.js';

interface PublishNowArgs {
  planningItemId: string;
}

interface PublishNowData {
  planningItemId: string;
  platform: string;
  externalUrl?: string;
  publishedAt?: string;
  status: 'published' | 'needs_connect' | 'failed';
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
  internalBaseUrl: string,
  accessToken: string,
  clientId: string,
  platform: string,
): Promise<string | null> {
  try {
    const res = await fetch(`${internalBaseUrl}/api/late-oauth-start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ clientId, platform }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error(`[publishNow] late-oauth-start ${res.status}: ${t.slice(0, 200)}`);
      return null;
    }
    const json: any = await res.json().catch(() => ({}));
    return typeof json?.authUrl === 'string' ? json.authUrl : null;
  } catch (err) {
    console.error('[publishNow] late-oauth-start fetch error:', err);
    return null;
  }
}

export const publishNowTool: RegisteredTool<PublishNowArgs, PublishNowData> = {
  definition: {
    name: 'publishNow',
    description:
      'Publica um rascunho imediatamente na plataforma dele. Use quando o usuário aprova e quer publicar agora.',
    parameters: {
      type: 'object',
      properties: {
        planningItemId: {
          type: 'string',
          description:
            "ID do item em planning_items a ser publicado. Deve vir de um rascunho existente (status='draft').",
        },
      },
      required: ['planningItemId'],
    },
  },

  handler: async (args, ctx) => {
    const planningItemId = String(args.planningItemId ?? '').trim();
    if (!planningItemId) return { ok: false, error: 'planningItemId é obrigatório.' };

    console.log(`[publishNow] clientId=${ctx.clientId} planningItemId=${planningItemId}`);

    try {
      const item = await queryOne<{
        id: string;
        client_id: string;
        platform: string;
        content: string;
        media_urls: any;
        status: string;
        scheduled_at: string | null;
        metadata: any;
      }>(
        `SELECT id, client_id, platform, content, media_urls, status, scheduled_at, metadata
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
            message: 'Já foi publicado',
            toolName: 'publishNow',
            recoverable: false,
          },
          requires_approval: false,
          available_actions: [],
        };
        return {
          ok: true,
          data: { planningItemId, platform: item.platform, status: 'failed' },
          card,
        };
      }

      const platform = String(item.platform ?? '').toLowerCase();
      const content = String(item.content ?? '');
      const mediaUrls: string[] | undefined = Array.isArray(item.media_urls)
        ? (item.media_urls as string[])
        : undefined;

      const platformOptions =
        item.metadata && typeof item.metadata === 'object'
          ? (item.metadata as Record<string, any>).platform_options
          : undefined;

      const postResponse = await fetch(`${ctx.internalBaseUrl}/api/late-post`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ctx.accessToken}`,
        },
        body: JSON.stringify({
          clientId: ctx.clientId,
          platform,
          content,
          mediaUrls,
          planningItemId: item.id,
          publishNow: true,
          platformOptions,
        }),
      });

      const responseText = await postResponse.text();
      console.log(
        `[publishNow] late-post status=${postResponse.status} body=${responseText.slice(0, 300)}`,
      );

      if (!postResponse.ok) {
        // 409 — duplicate, conferir se item virou published
        if (postResponse.status === 409) {
          const refreshed = await queryOne<{
            status: string;
            published_at: string | null;
            metadata: any;
            external_post_id: string | null;
          }>(
            `SELECT status, published_at, metadata, external_post_id
               FROM planning_items WHERE id = $1`,
            [planningItemId],
          );
          const meta = (refreshed?.metadata ?? {}) as Record<string, unknown>;
          const publishedUrls = (meta.published_urls ?? {}) as Record<string, string>;
          const externalUrl =
            publishedUrls[platform] ?? (meta.published_url as string | undefined);

          if (refreshed?.status === 'published' || refreshed?.published_at) {
            console.log('[publishNow] 409 mas item já published — reconciliando como sucesso');
            const card: KAIActionCard = {
              id: newActionCardId(),
              planning_item_id: planningItemId,
              type: 'published',
              status: 'done',
              data: {
                kind: 'published',
                clientId: ctx.clientId,
                platform,
                externalUrl,
                publishedAt: refreshed.published_at ?? new Date().toISOString(),
                body: content,
                mediaUrls,
              },
              requires_approval: false,
              available_actions: [],
            };
            return {
              ok: true,
              data: { planningItemId, platform, externalUrl, status: 'published' },
              card,
            };
          }

          const card: KAIActionCard = {
            id: newActionCardId(),
            planning_item_id: planningItemId,
            type: 'error',
            status: 'error',
            data: {
              kind: 'error',
              message:
                'Esse conteúdo já foi enviado pra rede social nas últimas 24h. Edite o texto pra publicar de novo.',
              toolName: 'publishNow',
              recoverable: false,
            },
            requires_approval: false,
            available_actions: [],
          };
          return {
            ok: true,
            data: { planningItemId, platform, status: 'failed' },
            card,
          };
        }

        if (isNotConnectedError(postResponse.status, responseText)) {
          const oauthUrl = await fetchOAuthUrl(
            ctx.internalBaseUrl,
            ctx.accessToken,
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
                reason: `Conecte sua conta do ${platform} pra publicar`,
              },
              requires_approval: true,
              available_actions: [],
            };
            return {
              ok: true,
              data: { planningItemId, platform, status: 'needs_connect' },
              card,
            };
          }
        }

        let userMessage = 'Falha ao publicar';
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
            toolName: 'publishNow',
            recoverable: true,
          },
          requires_approval: false,
          available_actions: [],
        };
        return {
          ok: true,
          data: { planningItemId, platform, status: 'failed' },
          card,
        };
      }

      // Sucesso
      let postJson: Record<string, unknown> = {};
      try {
        postJson = JSON.parse(responseText);
      } catch {
        postJson = {};
      }
      const externalUrl: string | undefined =
        typeof postJson?.url === 'string' ? postJson.url : undefined;
      const externalPostId: string | undefined =
        typeof postJson?.postId === 'string' ? postJson.postId : undefined;
      const publishedAt = new Date().toISOString();

      try {
        if (externalPostId) {
          await query(
            `UPDATE planning_items
                SET status = 'published',
                    published_at = $1,
                    external_post_id = $2,
                    updated_at = $1
              WHERE id = $3`,
            [publishedAt, externalPostId, planningItemId],
          );
        } else {
          await query(
            `UPDATE planning_items
                SET status = 'published',
                    published_at = $1,
                    updated_at = $1
              WHERE id = $2`,
            [publishedAt, planningItemId],
          );
        }
      } catch (e: any) {
        console.warn(
          '[publishNow] update planning_items falhou (late-post já deve ter atualizado):',
          e?.message,
        );
      }

      const card: KAIActionCard = {
        id: newActionCardId(),
        planning_item_id: planningItemId,
        type: 'published',
        status: 'done',
        data: {
          kind: 'published',
          clientId: ctx.clientId,
          platform,
          externalUrl,
          publishedAt,
          body: content,
          mediaUrls,
        },
        requires_approval: false,
        available_actions: [],
      };

      return {
        ok: true,
        data: { planningItemId, platform, externalUrl, publishedAt, status: 'published' },
        card,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[publishNow] error:', err);
      return { ok: false, error: message };
    }
  },
};
