// Cron job: poll Postiz Public API pra sync de status posts.
//
// Por que: a Public API do Postiz NÃO documenta webhooks (até 2026-05).
// Postiz pode chamar nosso /api/postiz-webhook em deploys self-host com config
// custom, mas pra Cloud o caminho confiável é polling. A cada 15min este cron:
//
//   1. Pega todos os planning_items com status='scheduled' OU 'publishing' que
//      têm `external_post_id` (postId do Postiz).
//   2. Lista posts no Postiz dos últimos 48h via GET /posts.
//   3. Cruza pelo postId e atualiza:
//      - status: PUBLISHED → 'published' + grava release_url + adiciona à library
//      - ERROR → 'failed' + error_message
//      - QUEUE/DRAFT → mantém 'scheduled'/'draft'
//
// Schedule: */15 * * * * (a cada 15min). Definir em vercel.json.
// Auth: header `Authorization: Bearer <CRON_SECRET>`.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight } from '../_lib/cors.js';
import { getPool, query, queryOne } from '../_lib/db.js';
import { getPostizConfig, listPosts } from '../_lib/integrations/postiz.js';

interface PostizPostState {
  id: string;
  state: 'QUEUE' | 'PUBLISHED' | 'ERROR' | 'DRAFT';
  releaseURL?: string | null;
  publishDate?: string;
  content?: string;
  integration?: { id: string; providerIdentifier: string; name: string };
  error?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res);

  // Auth: aceita Vercel cron header OU CRON_SECRET bearer manual.
  const authHeader = req.headers.authorization;
  const isVercelCron = !!req.headers['x-vercel-cron'];
  const isManualCron =
    authHeader === `Bearer ${process.env.CRON_SECRET}` && !!process.env.CRON_SECRET;
  if (!isVercelCron && !isManualCron) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let cfg;
  try {
    cfg = getPostizConfig();
  } catch (e: any) {
    return res.status(503).json({ error: 'Postiz not configured', detail: e.message });
  }

  const pool = getPool();
  const startedAt = Date.now();

  // 1. Pega planning_items pendentes com external_post_id Postiz.
  const pending = await query<any>(
    `SELECT id, client_id, workspace_id, status, external_post_id, metadata,
            platform, content, title, added_to_library
       FROM planning_items
      WHERE external_post_id IS NOT NULL
        AND status IN ('scheduled', 'publishing', 'partial')
        AND (metadata->>'provider' = 'postiz' OR metadata->>'provider' IS NULL)
        AND updated_at > NOW() - INTERVAL '7 days'
      ORDER BY updated_at DESC
      LIMIT 100`,
  );

  if (pending.length === 0) {
    return res.status(200).json({
      ok: true,
      message: 'no pending posts',
      durationMs: Date.now() - startedAt,
    });
  }

  // 2. Lista posts dos últimos 48h via Postiz.
  const startDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const endDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  let postizPosts: PostizPostState[] = [];
  try {
    const r = await listPosts(cfg, { startDate, endDate });
    postizPosts = r as PostizPostState[];
  } catch (e: any) {
    return res.status(502).json({
      ok: false,
      error: 'Failed to list Postiz posts',
      detail: e.message,
    });
  }

  // Indexa por id pra lookup O(1).
  const byId = new Map<string, PostizPostState>();
  for (const p of postizPosts) byId.set(p.id, p);

  let updated = 0;
  let failed = 0;
  let published = 0;
  const events: any[] = [];

  for (const item of pending) {
    const postId = item.external_post_id as string;
    const remote = byId.get(postId);
    if (!remote) {
      // Postiz não retornou esse postId no range — pode ter sido deletado ou está mais antigo.
      events.push({ id: item.id, postId, action: 'not_found' });
      continue;
    }

    if (remote.state === 'PUBLISHED' && item.status !== 'published') {
      const existingMeta = (item.metadata as any) || {};

      // Resolve coluna 'published' do workspace.
      let publishedColumnId: string | null = null;
      if (item.workspace_id) {
        const col = await queryOne<any>(
          `SELECT id FROM kanban_columns WHERE workspace_id = $1 AND column_type = 'published' LIMIT 1`,
          [item.workspace_id],
        );
        if (col) publishedColumnId = col.id;
      }

      const fields = [
        `status = 'published'`,
        `published_at = COALESCE(published_at, NOW())`,
        `error_message = NULL`,
        `metadata = $1::jsonb`,
        `updated_at = NOW()`,
      ];
      const values: any[] = [
        JSON.stringify({
          ...existingMeta,
          published_url: remote.releaseURL || existingMeta.published_url,
          postiz_state: 'PUBLISHED',
          postiz_synced_at: new Date().toISOString(),
          provider: 'postiz',
        }),
      ];
      let placeholderIdx = 2;
      if (publishedColumnId) {
        fields.push(`column_id = $${placeholderIdx++}`);
        values.push(publishedColumnId);
      }
      values.push(item.id);
      await pool.query(`UPDATE planning_items SET ${fields.join(', ')} WHERE id = $${placeholderIdx}`, values);

      // Adiciona à library se ainda não foi.
      if (!item.added_to_library && item.client_id) {
        const contentTypeMap: Record<string, string> = {
          twitter: 'tweet',
          x: 'tweet',
          linkedin: 'linkedin_post',
          instagram: 'instagram_post',
          'instagram-standalone': 'instagram_post',
          facebook: 'facebook_post',
          tiktok: 'tiktok_video',
          youtube: 'youtube_video',
          threads: 'threads_post',
        };
        try {
          await pool.query(
            `INSERT INTO client_content_library (client_id, title, content, content_type, content_url, metadata)
             VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
            [
              item.client_id,
              (item.content || item.title || '').substring(0, 100),
              item.content || item.title || '',
              contentTypeMap[item.platform || ''] || 'post',
              remote.releaseURL,
              JSON.stringify({
                platform: item.platform,
                posted_at: new Date().toISOString(),
                postiz_post_id: postId,
                via_polling: true,
                provider: 'postiz',
              }),
            ],
          );
          await pool.query(`UPDATE planning_items SET added_to_library = true WHERE id = $1`, [item.id]);
        } catch (e) {
          console.warn(`[cron-postiz-poll] library insert failed for ${item.id}:`, e);
        }
      }

      published++;
      updated++;
      events.push({ id: item.id, postId, action: 'published', url: remote.releaseURL });
    } else if (remote.state === 'ERROR' && item.status !== 'failed') {
      const existingMeta = (item.metadata as any) || {};
      await pool.query(
        `UPDATE planning_items
            SET status = 'failed',
                error_message = $1,
                metadata = $2::jsonb,
                updated_at = NOW()
          WHERE id = $3`,
        [
          remote.error || 'Falha ao publicar (sync via polling)',
          JSON.stringify({
            ...existingMeta,
            postiz_state: 'ERROR',
            postiz_synced_at: new Date().toISOString(),
            provider: 'postiz',
          }),
          item.id,
        ],
      );
      failed++;
      updated++;
      events.push({ id: item.id, postId, action: 'failed', error: remote.error });
    }
  }

  return res.status(200).json({
    ok: true,
    polled: pending.length,
    found: postizPosts.length,
    updated,
    published,
    failed,
    events,
    durationMs: Date.now() - startedAt,
  });
}
