// Migrated from supabase/functions/process-scheduled-posts/index.ts
// Cron worker that publishes due planning_items by calling late-post in-process.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';
import { getPool, query, queryOne } from '../_lib/db.js';
import { tryAuth } from '../_lib/auth.js';

const SUPPORTED_PLATFORMS = ['twitter', 'linkedin', 'instagram', 'tiktok', 'youtube', 'facebook', 'threads'];

function getOrigin(req: VercelRequest): string {
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
  const host = req.headers.host || 'localhost:3000';
  return `${proto}://${host}`;
}

async function callInternal(
  req: VercelRequest,
  path: string,
  body: any,
  authToken?: string,
): Promise<any> {
  const origin = getOrigin(req);
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    else if (req.headers.authorization) headers.Authorization = String(req.headers.authorization);
    const r = await fetch(`${origin}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const json = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, data: json };
  } catch (e: any) {
    console.warn(`[process-scheduled-posts] internal call ${path} failed:`, e.message);
    return { ok: false, status: 0, data: { error: e.message } };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res);
  if (req.method !== 'POST' && req.method !== 'GET') {
    return jsonError(res, 405, 'Method not allowed');
  }

  // Auth: vercel cron OR CRON_SECRET OR authed user
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.authorization;
  const isCron =
    req.headers['x-vercel-cron'] === '1' ||
    (cronSecret && auth === `Bearer ${cronSecret}`);
  if (!isCron) {
    const user = await tryAuth(req);
    if (!user) return jsonError(res, 401, 'Unauthorized');
  }

  try {
    const now = new Date();
    const marginTime = new Date(now.getTime() + 2 * 60 * 1000);
    console.log(`[process-scheduled-posts] running at ${now.toISOString()} margin=${marginTime.toISOString()}`);

    // Fetch planning_items due for publish, with retry-aware filter
    const planningItems = await query<any>(
      `SELECT pi.*, c.name AS client_name
       FROM planning_items pi
       LEFT JOIN clients c ON c.id = pi.client_id
       WHERE pi.status = 'scheduled'
         AND pi.scheduled_at <= $1
         AND COALESCE(pi.retry_count, 0) < 3
         AND (pi.next_retry_at IS NULL OR pi.next_retry_at <= $2)
       ORDER BY pi.scheduled_at ASC
       LIMIT 25`,
      [marginTime.toISOString(), now.toISOString()],
    );

    // Legacy scheduled_posts table (graceful fallback)
    let legacyPosts: any[] = [];
    try {
      legacyPosts = await query<any>(
        `SELECT *
         FROM scheduled_posts
         WHERE status = 'scheduled'
           AND scheduled_at <= $1
           AND COALESCE(retry_count, 0) < 3
           AND (next_retry_at IS NULL OR next_retry_at <= $2)
         ORDER BY scheduled_at ASC
         LIMIT 25`,
        [marginTime.toISOString(), now.toISOString()],
      );
    } catch (e: any) {
      console.log('[process-scheduled-posts] legacy table query skipped:', e?.message);
    }

    const allItems = [
      ...planningItems.map((it: any) => ({ ...it, source: 'planning_items' })),
      ...legacyPosts.map((p: any) => ({ ...p, source: 'scheduled_posts' })),
    ];

    if (allItems.length === 0) {
      console.log('[process-scheduled-posts] no items');
      return res.status(200).json({ processed: 0, message: 'No posts to process' });
    }

    console.log(`[process-scheduled-posts] ${allItems.length} item(s)`);
    const results: any[] = [];

    for (const item of allItems) {
      const tableName = item.source as 'planning_items' | 'scheduled_posts';
      try {
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
        const credentials = await queryOne<any>(
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
        const metadata = item.metadata as Record<string, any> | null;
        const threadTweets = metadata?.thread_tweets as Array<{ text: string; media_urls?: string[] }> | undefined;

        // Call late-post for all platforms
        const resp = await callInternal(req, '/api/late-post', {
          clientId: item.client_id,
          platform: item.platform,
          content: item.content || item.description || '',
          mediaUrls: item.media_urls || [],
          threadItems: threadTweets,
          planningItemId: item.id,
          publishNow: true,
        });
        const result = resp.data || {};

        if (resp.ok && result.success) {
          // Find published column
          let publishedColumnId: string | null = null;
          if (tableName === 'planning_items' && item.workspace_id) {
            const pubCol = await queryOne<any>(
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
              [result.externalId || null, publishedColumnId, item.id],
            );
          } else {
            await getPool().query(
              `UPDATE scheduled_posts SET status = 'published', published_at = NOW(),
                 external_post_id = $1, error_message = NULL
               WHERE id = $2`,
              [result.externalId || null, item.id],
            );
          }

          // Auto-save to content library on publish
          if (tableName === 'planning_items' && item.client_id && !item.added_to_library) {
            try {
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
              const saved = await queryOne<any>(
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
                    external_post_id: result.externalId || null,
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
            } catch (saveErr: any) {
              console.error('[process-scheduled-posts] library save error:', saveErr?.message);
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
              result.error || 'Erro desconhecido',
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
                const ws = await queryOne<any>(
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
                    result.error || 'Erro desconhecido após 3 tentativas',
                    JSON.stringify({
                      planning_item_id: item.id,
                      platform: item.platform,
                      client_id: item.client_id,
                      retry_count: newRetryCount,
                    }),
                  ],
                );
              }
            } catch (e: any) {
              console.warn('[process-scheduled-posts] notify error:', e.message);
            }
          }

          console.log(`[process-scheduled-posts] ${item.id} ${newStatus}: ${result.error}`);
          results.push({
            postId: item.id,
            platform: item.platform,
            success: false,
            error: result.error,
            source: tableName,
          });
        }
      } catch (err: any) {
        const message = err?.message || 'Erro desconhecido';
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
  } catch (error: any) {
    console.error('[process-scheduled-posts] fatal:', error);
    return jsonError(res, 500, error?.message || 'Erro desconhecido');
  }
}
