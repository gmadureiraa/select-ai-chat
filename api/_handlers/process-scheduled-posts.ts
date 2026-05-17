// Migrated from supabase/functions/process-scheduled-posts/index.ts
// Cron worker that publishes due planning_items by calling Metricool in-process.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';
import { getPool, query, queryOne } from '../_lib/db.js';
import { publishMetricoolForClient } from './metricool-post.js';
import { normalizePublicationError } from '../_lib/publication-errors.js';
import { assertCronAuth } from '../_lib/cron-auth.js';

const SUPPORTED_PLATFORMS = ['twitter', 'linkedin', 'instagram', 'tiktok', 'youtube', 'facebook', 'threads', 'pinterest', 'bluesky'];
const DEFAULT_MAX_LAG_MINUTES = 360;

type ScheduledSource = 'planning_items' | 'scheduled_posts';

interface ScheduledItem {
  id: string;
  source: ScheduledSource;
  workspace_id?: string | null;
  client_id: string | null;
  platform: string;
  content?: string | null;
  description?: string | null;
  media_urls?: unknown;
  metadata?: unknown;
  scheduled_at?: string | null;
  retry_count?: number | null;
  title?: string | null;
  created_by?: string | null;
  user_id?: string | null;
  assigned_to?: string | null;
  added_to_library?: boolean | null;
  external_post_id?: string | null;
}

interface PublishResult {
  postId: string;
  platform: string;
  success: boolean;
  source: ScheduledSource;
  error?: string;
}

function errorMessage(error: unknown): string {
  return normalizePublicationError(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function threadItems(value: unknown): Array<{ text: string; media_urls?: string[] }> | undefined {
  if (!Array.isArray(value)) return undefined;
  const parsed = value
    .map((item) => {
      if (!isRecord(item) || typeof item.text !== 'string') return null;
      return { text: item.text, media_urls: stringArray(item.media_urls) };
    })
    .filter((item): item is { text: string; media_urls: string[] } => !!item);
  return parsed.length > 0 ? parsed : undefined;
}

function responseString(data: Record<string, unknown>, key: string): string | null {
  const value = data[key];
  return typeof value === 'string' ? value : null;
}

function getMaxLagMinutes(): number {
  const raw = Number(process.env.SCHEDULED_POST_MAX_LAG_MINUTES || DEFAULT_MAX_LAG_MINUTES);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_MAX_LAG_MINUTES;
}

function isTooStale(item: ScheduledItem, now: Date): boolean {
  if (!item.scheduled_at) return false;
  const scheduledAt = new Date(item.scheduled_at);
  if (Number.isNaN(scheduledAt.getTime())) return false;
  const lagMs = now.getTime() - scheduledAt.getTime();
  return lagMs > getMaxLagMinutes() * 60 * 1000;
}

async function resolveActorUserId(item: ScheduledItem): Promise<string | null> {
  if (item.created_by) return item.created_by;
  if (item.user_id) return item.user_id;
  if (!item.workspace_id) return null;

  const member = await queryOne<{ user_id: string }>(
    `SELECT user_id
       FROM workspace_members
      WHERE workspace_id = $1
      ORDER BY CASE role
        WHEN 'owner' THEN 0
        WHEN 'admin' THEN 1
        WHEN 'member' THEN 2
        ELSE 3
      END, created_at ASC
      LIMIT 1`,
    [item.workspace_id],
  ).catch(() => null);
  return member?.user_id ?? null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res);
  if (req.method !== 'POST' && req.method !== 'GET') {
    return jsonError(res, 405, 'Method not allowed');
  }

  // Auth: SOMENTE cron via Authorization: Bearer $CRON_SECRET.
  // Não permite trigger por user autenticado — isso permitiria QUALQUER user
  // logado disparar publicação de scheduled posts globais (de outros workspaces).
  // Header `x-vercel-cron` standalone NÃO é confiável (forjável).
  if (!assertCronAuth(req, res)) return;

  try {
    const body = req.body && typeof req.body === 'object'
      ? req.body as Record<string, unknown>
      : (req.body ? JSON.parse(String(req.body)) as Record<string, unknown> : {});
    const dryRun = body.dryRun === true || req.query?.dryRun === '1' || req.query?.dryRun === 'true';
    const now = new Date();
    const marginTime = new Date(now.getTime() + 2 * 60 * 1000);
    console.log(`[process-scheduled-posts] running at ${now.toISOString()} margin=${marginTime.toISOString()} dryRun=${dryRun}`);

    if (!dryRun) {
      const recovered = await query<{ id: string }>(
        `UPDATE planning_items
            SET status = 'failed',
                error_message = COALESCE(error_message, 'Publicação ficou presa em "publicando" sem retorno da Metricool. Revise e clique em retry.'),
                retry_count = GREATEST(COALESCE(retry_count, 0), 1),
                next_retry_at = NULL,
                updated_at = NOW()
          WHERE status = 'publishing'
            AND external_post_id IS NULL
            AND updated_at < NOW() - INTERVAL '10 minutes'
          RETURNING id`,
      ).catch(() => []);
      if (recovered.length > 0) {
        console.warn(`[process-scheduled-posts] recovered ${recovered.length} stuck publishing item(s)`);
      }
    }

    // Fetch planning_items due for publish, with retry-aware filter
    const planningItems = await query<Omit<ScheduledItem, 'source'>>(
      `SELECT pi.*, c.name AS client_name
       FROM planning_items pi
       LEFT JOIN clients c ON c.id = pi.client_id
       WHERE pi.status = 'scheduled'
         AND pi.scheduled_at <= $1
         AND pi.external_post_id IS NULL
         AND COALESCE(pi.retry_count, 0) < 3
         AND (pi.next_retry_at IS NULL OR pi.next_retry_at <= $2)
       ORDER BY pi.scheduled_at ASC
       LIMIT 25`,
      [marginTime.toISOString(), now.toISOString()],
    );

    // Legacy scheduled_posts table (graceful fallback)
    let legacyPosts: Array<Omit<ScheduledItem, 'source'>> = [];
    try {
      legacyPosts = await query<Omit<ScheduledItem, 'source'>>(
        `SELECT *
         FROM scheduled_posts
         WHERE status = 'scheduled'
           AND scheduled_at <= $1
           AND external_post_id IS NULL
           AND COALESCE(retry_count, 0) < 3
           AND (next_retry_at IS NULL OR next_retry_at <= $2)
         ORDER BY scheduled_at ASC
         LIMIT 25`,
        [marginTime.toISOString(), now.toISOString()],
      );
    } catch (e: unknown) {
      console.log('[process-scheduled-posts] legacy table query skipped:', errorMessage(e));
    }

    const allItems: ScheduledItem[] = [
      ...planningItems.map((it) => ({ ...it, source: 'planning_items' as const })),
      ...legacyPosts.map((p) => ({ ...p, source: 'scheduled_posts' as const })),
    ];

    if (allItems.length === 0) {
      console.log('[process-scheduled-posts] no items');
      return res.status(200).json({ processed: 0, dryRun, message: 'No posts to process' });
    }

    if (dryRun) {
      const diagnostics = [];
      for (const item of allItems) {
        const metadata = isRecord(item.metadata) ? item.metadata : {};
        const credential = await queryOne<{
          is_valid: boolean | null;
          account_name: string | null;
          metricool_blog_id: string | null;
        }>(
          `SELECT is_valid, account_name, metadata->>'metricool_blog_id' AS metricool_blog_id
             FROM client_social_credentials
            WHERE client_id = $1 AND platform = $2
            LIMIT 1`,
          [item.client_id, item.platform],
        ).catch(() => null);
        const actorUserId = await resolveActorUserId(item).catch(() => null);
        diagnostics.push({
          id: item.id,
          source: item.source,
          clientId: item.client_id,
          platform: item.platform,
          status: 'scheduled',
          scheduledAt: item.scheduled_at,
          retryCount: item.retry_count || 0,
          hasContent: !!(item.content || item.description || threadItems(metadata.thread_tweets)?.length),
          credentialValid: credential?.is_valid === true,
          accountName: credential?.account_name || null,
          metricoolBlogId: credential?.metricool_blog_id || null,
          externalPostId: item.external_post_id || null,
          providerConfirmed: !!item.external_post_id,
          actorUserId,
          stale: isTooStale(item, now),
          wouldPublish: !item.external_post_id && SUPPORTED_PLATFORMS.includes(item.platform) && credential?.is_valid === true && !!actorUserId && !isTooStale(item, now),
        });
      }
      return res.status(200).json({
        processed: 0,
        dryRun: true,
        due: diagnostics.length,
        maxLagMinutes: getMaxLagMinutes(),
        diagnostics,
      });
    }

    console.log(`[process-scheduled-posts] ${allItems.length} item(s)`);
    const results: PublishResult[] = [];

    for (const item of allItems) {
      const tableName = item.source;
      try {
        if (isTooStale(item, now)) {
          const message = `Agendamento expirado: horário passou há mais de ${getMaxLagMinutes()} minutos. Revise e clique em retry/publicar para confirmar.`;
          await getPool().query(
            `UPDATE ${tableName} SET status = 'failed', error_message = $1, next_retry_at = NULL WHERE id = $2`,
            [message, item.id],
          );
          results.push({
            postId: item.id,
            platform: item.platform,
            success: false,
            error: message,
            source: tableName,
          });
          continue;
        }

        // Set publishing
        await getPool().query(`UPDATE ${tableName} SET status = 'publishing' WHERE id = $1`, [item.id]);

        if (!SUPPORTED_PLATFORMS.includes(item.platform)) {
          await getPool().query(
            `UPDATE ${tableName} SET status = 'scheduled', error_message = $1 WHERE id = $2`,
            [`Plataforma ${item.platform} requer publicação manual`, item.id],
          );
          results.push({
            postId: item.id,
            platform: item.platform,
            success: false,
            error: `Manual publish required for ${item.platform}`,
            source: tableName,
          });
          continue;
        }

        // Validate credentials
        const credentials = await queryOne<{ is_valid: boolean }>(
          `SELECT is_valid FROM client_social_credentials WHERE client_id = $1 AND platform = $2 LIMIT 1`,
          [item.client_id, item.platform],
        );
        if (!credentials?.is_valid) {
          await getPool().query(
            `UPDATE ${tableName} SET status = 'scheduled', error_message = $1 WHERE id = $2`,
            [`Credenciais inválidas ou não configuradas para ${item.platform}`, item.id],
          );
          results.push({
            postId: item.id,
            platform: item.platform,
            success: false,
            error: 'No valid credentials',
            source: tableName,
          });
          continue;
        }

        // Extract thread items from metadata
        const metadata = isRecord(item.metadata) ? item.metadata : null;
        const threadTweets = threadItems(metadata?.thread_tweets);

        const actorUserId = await resolveActorUserId(item);
        if (!actorUserId) {
          await getPool().query(
            `UPDATE ${tableName} SET status = 'scheduled', error_message = $1 WHERE id = $2`,
            ['Sem usuário responsável para publicar este agendamento', item.id],
          );
          results.push({
            postId: item.id,
            platform: item.platform,
            success: false,
            error: 'No actor user',
            source: tableName,
          });
          continue;
        }

        const result = await publishMetricoolForClient({
          userId: actorUserId,
          body: {
            clientId: item.client_id,
            platform: item.platform,
            content: item.content || item.description || '',
            mediaUrls: stringArray(item.media_urls),
            threadItems: threadTweets,
            planningItemId: item.id,
            publishNow: true,
          },
        }) as Record<string, unknown>;

        if (result.success) {
          // Find published column
          let publishedColumnId: string | null = null;
          if (tableName === 'planning_items' && item.workspace_id) {
            const pubCol = await queryOne<{ id: string }>(
              `SELECT id FROM kanban_columns WHERE workspace_id = $1 AND column_type = 'published' LIMIT 1`,
              [item.workspace_id],
            ).catch(() => null);
            publishedColumnId = pubCol?.id || null;
          }

          if (tableName === 'planning_items') {
            await getPool().query(
              `UPDATE planning_items SET status = 'published', published_at = NOW(),
                 external_post_id = $1, error_message = NULL,
                 column_id = COALESCE($2, column_id)
               WHERE id = $3`,
              [responseString(result, 'postId') || responseString(result, 'externalId'), publishedColumnId, item.id],
            );
          } else {
            await getPool().query(
              `UPDATE scheduled_posts SET status = 'published', published_at = NOW(),
                 external_post_id = $1, error_message = NULL
               WHERE id = $2`,
              [responseString(result, 'postId') || responseString(result, 'externalId'), item.id],
            );
          }

          // Auto-save to content library on publish
          if (tableName === 'planning_items' && item.client_id) {
            try {
              const libraryState = await queryOne<{ added_to_library: boolean | null }>(
                `SELECT added_to_library FROM planning_items WHERE id = $1`,
                [item.id],
              ).catch(() => null);
              if (libraryState?.added_to_library) {
                console.log(`[process-scheduled-posts] library already saved for ${item.id}`);
                results.push({ postId: item.id, platform: item.platform, success: true, source: tableName });
                continue;
              }
              const contentTypeMap: Record<string, string> = {
                twitter: 'tweet',
                instagram: 'post',
                linkedin: 'linkedin_post',
                facebook: 'social_post',
                tiktok: 'script',
                youtube: 'script',
                newsletter: 'newsletter',
                blog: 'article',
              };
              const mappedType = contentTypeMap[(item.platform || '').toLowerCase()] || 'post';
              const saved = await queryOne<{ id: string }>(
                `INSERT INTO client_content_library
                  (client_id, title, content, content_type, metadata)
                 VALUES ($1, $2, $3, $4, $5::jsonb)
                 RETURNING id`,
                [
                  item.client_id,
                  item.title,
                  item.content || item.description || '',
                  mappedType,
                  JSON.stringify({
                    auto_saved_on_publish: true,
                    from_planning: true,
                    original_item_id: item.id,
                    platform: item.platform,
                    published_at: new Date().toISOString(),
                    external_post_id: responseString(result, 'postId') || responseString(result, 'externalId'),
                  }),
                ],
              );
              if (saved?.id) {
                await getPool().query(
                  `UPDATE planning_items SET added_to_library = true, content_library_id = $1 WHERE id = $2`,
                  [saved.id, item.id],
                );
                console.log(`[process-scheduled-posts] saved to library: ${saved.id}`);
              }
            } catch (saveErr: unknown) {
              console.error('[process-scheduled-posts] library save error:', errorMessage(saveErr));
            }
          }

          console.log(`[process-scheduled-posts] published ${item.id}`);
          results.push({ postId: item.id, platform: item.platform, success: true, source: tableName });
        } else {
          // Failure with exponential backoff
          const newRetryCount = (item.retry_count || 0) + 1;
          const retryDelayMs = Math.pow(2, newRetryCount) * 60 * 1000;
          const nextRetryAt = new Date(Date.now() + retryDelayMs);
          const newStatus = newRetryCount >= 3 ? 'failed' : 'scheduled';

          await getPool().query(
            `UPDATE ${tableName} SET status = $1, error_message = $2, retry_count = $3, next_retry_at = $4 WHERE id = $5`,
            [
              newStatus,
              normalizePublicationError(responseString(result, 'error') || 'Erro desconhecido'),
              newRetryCount,
              newRetryCount < 3 ? nextRetryAt.toISOString() : null,
              item.id,
            ],
          );

          // Notify on permanent failure
          if (item.workspace_id && newStatus === 'failed') {
            try {
              let notifyUserId = item.created_by || item.assigned_to;
              if (!notifyUserId) {
                const ws = await queryOne<{ owner_id: string | null }>(
                  `SELECT owner_id FROM workspaces WHERE id = $1`,
                  [item.workspace_id],
                ).catch(() => null);
                notifyUserId = ws?.owner_id;
              }
              if (notifyUserId) {
                await getPool().query(
                  `INSERT INTO notifications (workspace_id, user_id, type, title, message, metadata)
                   VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
                  [
                    item.workspace_id,
                    notifyUserId,
                    'publish_failed',
                    `Falha ao publicar "${(item.title || 'Post').substring(0, 30)}..."`,
                    normalizePublicationError(responseString(result, 'error') || 'Erro desconhecido após 3 tentativas'),
                    JSON.stringify({
                      planning_item_id: item.id,
                      platform: item.platform,
                      client_id: item.client_id,
                      retry_count: newRetryCount,
                    }),
                  ],
                );
              }
            } catch (e: unknown) {
              console.warn('[process-scheduled-posts] notify error:', errorMessage(e));
            }
          }

          console.log(`[process-scheduled-posts] ${item.id} ${newStatus}: ${normalizePublicationError(responseString(result, 'error'))}`);
          results.push({
            postId: item.id,
            platform: item.platform,
            success: false,
            error: normalizePublicationError(responseString(result, 'error') || 'Erro desconhecido'),
            source: tableName,
          });
        }
      } catch (err: unknown) {
        const message = errorMessage(err) || 'Erro desconhecido';
        console.error(`[process-scheduled-posts] error processing ${item.id}:`, err);
        const newRetryCount = (item.retry_count || 0) + 1;
        const retryDelayMs = Math.pow(2, newRetryCount) * 60 * 1000;
        const nextRetryAt = new Date(Date.now() + retryDelayMs);
        const newStatus = newRetryCount >= 3 ? 'failed' : 'scheduled';
        await getPool().query(
          `UPDATE ${tableName} SET status = $1, error_message = $2, retry_count = $3, next_retry_at = $4 WHERE id = $5`,
          [
            newStatus,
            message,
            newRetryCount,
            newRetryCount < 3 ? nextRetryAt.toISOString() : null,
            item.id,
          ],
        ).catch(() => null);
        results.push({
          postId: item.id,
          platform: item.platform,
          success: false,
          error: message,
          source: tableName,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failedCount = results.length - successCount;
    console.log(`[process-scheduled-posts] processed ${results.length}: ${successCount} ok, ${failedCount} failed`);

    return res.status(200).json({
      processed: results.length,
      success: successCount,
      failed: failedCount,
      results,
    });
  } catch (error: unknown) {
    console.error('[process-scheduled-posts] fatal:', error);
    return jsonError(res, 500, errorMessage(error) || 'Erro desconhecido');
  }
}
