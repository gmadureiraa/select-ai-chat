// Cron: a cada 15min sync status posts agendados via Metricool /v2/scheduler/posts.
//
// Fluxo:
//   1. Pega todos clientes com metricool_blog_id mapeado
//   2. Pra cada blogId único, lista posts dos últimos 48h via API
//   3. Pra cada planning_item.external_post_id que matchear, atualiza status
//   4. PUBLISHED: marca published + url + adiciona library
//   5. ERROR: marca failed + error_message
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight } from '../_lib/cors.js';
import { getPool, query, queryOne } from '../_lib/db.js';
import { getMetricoolConfig, listScheduledPosts } from '../_lib/integrations/metricool.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res);

  const authHeader = req.headers.authorization;
  const isVercelCron = !!req.headers['x-vercel-cron'];
  const isManualCron = authHeader === `Bearer ${process.env.CRON_SECRET}` && !!process.env.CRON_SECRET;
  if (!isVercelCron && !isManualCron) return res.status(401).json({ error: 'Unauthorized' });

  let cfg;
  try {
    cfg = getMetricoolConfig();
  } catch (e: any) {
    return res.status(503).json({ error: 'Metricool not configured', detail: e.message });
  }

  const pool = getPool();
  const startedAt = Date.now();

  // 1. Lista blogIds únicos com pelo menos 1 cliente mapeado
  const blogIds = await query<any>(
    `SELECT DISTINCT metadata->>'metricool_blog_id' AS blog_id
       FROM client_social_credentials
      WHERE metadata->>'metricool_blog_id' IS NOT NULL`,
  );
  if (blogIds.length === 0) {
    return res.status(200).json({ ok: true, message: 'no metricool blogs mapped', durationMs: Date.now() - startedAt });
  }

  // 2. Pega planning_items pendentes recentes
  const pending = await query<any>(
    `SELECT id, client_id, workspace_id, status, external_post_id, metadata,
            platform, content, title, added_to_library
       FROM planning_items
      WHERE external_post_id IS NOT NULL
        AND status IN ('scheduled', 'publishing', 'partial')
        AND metadata->>'provider' = 'metricool'
        AND updated_at > NOW() - INTERVAL '7 days'
      LIMIT 100`,
  );

  if (pending.length === 0) {
    return res.status(200).json({ ok: true, message: 'no pending metricool posts', durationMs: Date.now() - startedAt });
  }

  // 3. Pra cada blogId, lista posts e indexa por id
  // Gap #4 — janela dinâmica: startDate volta 7d (cobre re-posts/edits) e endDate
  // estica até o último scheduled_at no DB +1d (capped em 30d pra não passar limites
  // de range Metricool). Antes era hardcoded -48h/+24h, deixava agendamentos >24h invisíveis.
  const maxScheduledRow = await queryOne<any>(
    `SELECT MAX(scheduled_at) as max_scheduled FROM planning_items
       WHERE status IN ('scheduled', 'publishing') AND external_post_id IS NOT NULL
         AND scheduled_at > NOW()`,
  );
  const fallbackEnd = new Date(Date.now() + 30 * 86400_000);
  const maxScheduled = maxScheduledRow?.max_scheduled
    ? new Date(maxScheduledRow.max_scheduled)
    : fallbackEnd;
  const endTs = Math.min(maxScheduled.getTime() + 86400_000, fallbackEnd.getTime());
  const startDate = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 19);
  const endDate = new Date(endTs).toISOString().slice(0, 19);
  const allPostsById = new Map<string, any>();
  for (const { blog_id } of blogIds) {
    try {
      const posts = await listScheduledPosts(cfg, blog_id, startDate, endDate);
      for (const p of posts) {
        if (p.id) allPostsById.set(String(p.id), p);
      }
    } catch (e: any) {
      console.warn(`[cron-metricool-poll] failed for blog ${blog_id}:`, e.message);
    }
  }

  let updated = 0, published = 0, failed = 0;
  const events: any[] = [];

  for (const item of pending) {
    const postId = item.external_post_id as string;
    const remote = allPostsById.get(postId);
    if (!remote) {
      events.push({ id: item.id, postId, action: 'not_found' });
      continue;
    }

    // Cada Metricool post tem providers[] — pega status agregado
    const providers = (remote.providers || []) as any[];
    const allPublished = providers.length > 0 && providers.every((p) => p.status === 'PUBLISHED');
    const anyError = providers.some((p) => p.status === 'ERROR');
    const publicUrl = providers.find((p) => p.publicUrl)?.publicUrl || null;

    if (allPublished && item.status !== 'published') {
      const existingMeta = (item.metadata as any) || {};
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
          published_url: publicUrl || existingMeta.published_url,
          providers_status: providers,
          metricool_state: 'PUBLISHED',
          metricool_synced_at: new Date().toISOString(),
        }),
      ];
      let idx = 2;
      if (publishedColumnId) {
        fields.push(`column_id = $${idx++}`);
        values.push(publishedColumnId);
      }
      values.push(item.id);
      await pool.query(`UPDATE planning_items SET ${fields.join(', ')} WHERE id = $${idx}`, values);

      if (!item.added_to_library && item.client_id) {
        const ctMap: Record<string, string> = {
          twitter: 'tweet', instagram: 'instagram_post', facebook: 'facebook_post',
          linkedin: 'linkedin_post', tiktok: 'tiktok_video', youtube: 'youtube_video', threads: 'threads_post',
        };
        try {
          await pool.query(
            `INSERT INTO client_content_library (client_id, title, content, content_type, content_url, metadata)
             VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
            [
              item.client_id,
              (item.content || item.title || '').substring(0, 100),
              item.content || item.title || '',
              ctMap[item.platform || ''] || 'post',
              publicUrl,
              JSON.stringify({ platform: item.platform, posted_at: new Date().toISOString(), metricool_post_id: postId, via_polling: true, provider: 'metricool' }),
            ],
          );
          await pool.query(`UPDATE planning_items SET added_to_library = true WHERE id = $1`, [item.id]);
        } catch (e) {
          console.warn(`[cron-metricool-poll] library insert failed:`, e);
        }
      }
      published++; updated++;
      events.push({ id: item.id, postId, action: 'published', url: publicUrl });
    } else if (anyError && item.status !== 'failed') {
      const errProvider = providers.find((p) => p.status === 'ERROR');
      const existingMeta = (item.metadata as any) || {};
      await pool.query(
        `UPDATE planning_items SET status = 'failed', error_message = $1, metadata = $2::jsonb, updated_at = NOW() WHERE id = $3`,
        [
          errProvider?.detailedStatus || 'Falha ao publicar (sync via polling Metricool)',
          JSON.stringify({ ...existingMeta, providers_status: providers, metricool_state: 'ERROR', metricool_synced_at: new Date().toISOString() }),
          item.id,
        ],
      );
      failed++; updated++;
      events.push({ id: item.id, postId, action: 'failed', error: errProvider?.detailedStatus });
    }
  }

  return res.status(200).json({
    ok: true,
    polled: pending.length,
    blogsScanned: blogIds.length,
    found: allPostsById.size,
    updated, published, failed, events,
    durationMs: Date.now() - startedAt,
  });
}
