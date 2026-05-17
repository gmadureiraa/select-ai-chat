// Migrated from supabase/functions/batch-transcribe-posts/index.ts
// Iterates pending instagram_posts, OCRs each image and writes full_content.
import { authedPost } from '../_lib/handler.js';
import { getPool, query, queryOne } from '../_lib/db.js';
import { assertClientAccess } from '../_lib/access.js';
import type { VercelRequest } from '@vercel/node';

function getOrigin(req: VercelRequest): string {
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
  const host = req.headers.host || 'localhost:3000';
  return `${proto}://${host}`;
}

async function callInternal(
  req: VercelRequest,
  path: string,
  body: any,
): Promise<{ ok: boolean; status: number; data: any }> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (req.headers.authorization) headers.Authorization = String(req.headers.authorization);
    const r = await fetch(`${getOrigin(req)}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const json = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, data: json };
  } catch (e: any) {
    return { ok: false, status: 0, data: { error: e.message } };
  }
}

export default authedPost(async ({ body, req, user }) => {
  const { clientId, batchSize = 5, postTypes } = body as {
    clientId?: string;
    batchSize?: number;
    postTypes?: string[];
  };
  if (!clientId) {
    throw new Error('clientId is required');
  }
  await assertClientAccess(user.id, clientId);

  // Pending posts: have images but full_content empty
  const finalSql = postTypes && postTypes.length > 0
    ? `SELECT id, images, caption, post_type, permalink
       FROM instagram_posts
       WHERE client_id = $1
         AND (full_content IS NULL OR full_content = '')
         AND post_type = ANY($2)
       ORDER BY posted_at DESC
       LIMIT $3`
    : `SELECT id, images, caption, post_type, permalink
       FROM instagram_posts
       WHERE client_id = $1
         AND (full_content IS NULL OR full_content = '')
       ORDER BY posted_at DESC
       LIMIT $2`;
  const finalParams = postTypes && postTypes.length > 0
    ? [clientId, postTypes, batchSize]
    : [clientId, batchSize];

  const posts = await query<any>(finalSql, finalParams);

  if (!posts || posts.length === 0) {
    return {
      message: 'No posts to transcribe',
      processed: 0,
      remaining: 0,
    };
  }

  const remainingRow = await queryOne<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM instagram_posts
     WHERE client_id = $1 AND (full_content IS NULL OR full_content = '')`,
    [clientId],
  );
  const remaining = remainingRow?.c || 0;

  console.log(`[batch-transcribe-posts] ${posts.length} posts, ~${remaining} remaining`);

  const results: { id: string; success: boolean; error?: string }[] = [];

  for (const post of posts) {
    try {
      const rawImages = (post.images as string[]) || null;
      // Pós-Neon: só URLs absolutas funcionam. Paths Supabase legados são
      // ignorados (bucket não populado mais).
      const images = Array.isArray(rawImages)
        ? rawImages.filter((img): img is string => typeof img === 'string' && img.startsWith('http'))
        : [];
      const droppedLegacy = (rawImages?.length ?? 0) - images.length;
      if (droppedLegacy > 0) {
        console.warn(
          `[batch-transcribe-posts] ${post.id}: ${droppedLegacy} imagens legadas (Supabase paths) ignoradas`,
        );
      }
      if (images.length === 0) {
        await getPool().query(
          `UPDATE instagram_posts SET full_content = $1, content_synced_at = NOW() WHERE id = $2`,
          [post.caption || '[Sem conteúdo visual]', post.id],
        );
        results.push({ id: post.id, success: true });
        continue;
      }

      const transcriptions: string[] = [];
      for (let i = 0; i < images.length; i++) {
        const transcribeResp = await callInternal(req, '/api/transcribe-images', {
          imageUrls: [images[i]],
          startIndex: i,
          // userId real do user autenticado (era hardcoded 'batch-process',
          // o que quebrava log de uso porque transcribe-images espera UUID).
          userId: user.id,
          clientId,
        });
        if (transcribeResp.ok && transcribeResp.data?.transcription) {
          transcriptions.push(transcribeResp.data.transcription);
        } else {
          console.warn(
            `[batch-transcribe-posts] image ${i + 1}/${images.length} failed for ${post.id}`,
          );
        }
      }
      const transcription =
        transcriptions.join('\n\n---\n\n') || post.caption || '[Sem conteúdo]';
      // thumbnail_url já vem absoluta do cron-scrape-instagram; só atualiza
      // se images[0] for absoluta (e diferente do que já tem).
      const thumbnailUrl = images[0] ?? null;
      await getPool().query(
        `UPDATE instagram_posts
          SET full_content = $1, content_synced_at = NOW(), thumbnail_url = COALESCE($2, thumbnail_url)
          WHERE id = $3`,
        [transcription, thumbnailUrl, post.id],
      );
      results.push({ id: post.id, success: true });
      console.log(`[batch-transcribe-posts] ${post.id}: transcribed ${images.length} imgs`);
    } catch (postError: any) {
      console.error(`[batch-transcribe-posts] error ${post.id}:`, postError);
      results.push({
        id: post.id,
        success: false,
        error: postError?.message || 'Unknown',
      });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  console.log(`[batch-transcribe-posts] done: ${successCount}/${posts.length}`);

  return {
    processed: posts.length,
    successful: successCount,
    failed: posts.length - successCount,
    remaining: remaining - posts.length,
    results,
  };
});
