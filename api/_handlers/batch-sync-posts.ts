// Migrated from supabase/functions/batch-sync-posts/index.ts
// Batch syncs Instagram posts: extract images via Apify -> transcribe -> persist.
import { authedPost } from '../_lib/handler.js';
import { getPool, query, queryOne } from '../_lib/db.js';
import type { VercelRequest } from '@vercel/node';

interface InstagramPost {
  id: string;
  images: string[] | null;
  caption: string | null;
  post_type: string | null;
  permalink: string | null;
}

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

export default authedPost(async ({ body, req }) => {
  const { clientId, batchSize = 3 } = body as { clientId?: string; batchSize?: number };
  if (!clientId) {
    throw new Error('clientId is required');
  }

  // Posts that haven't been synced yet (no content_synced_at, with permalink)
  const posts = await query<InstagramPost>(
    `SELECT id, images, caption, post_type, permalink
     FROM instagram_posts
     WHERE client_id = $1
       AND content_synced_at IS NULL
       AND permalink IS NOT NULL
     ORDER BY posted_at DESC
     LIMIT $2`,
    [clientId, batchSize],
  );

  if (!posts || posts.length === 0) {
    const remaining = await queryOne<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM instagram_posts
       WHERE client_id = $1 AND content_synced_at IS NULL`,
      [clientId],
    );
    return {
      message: 'No posts to sync',
      processed: 0,
      remaining: remaining?.c || 0,
    };
  }

  const remaining = await queryOne<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM instagram_posts
     WHERE client_id = $1 AND content_synced_at IS NULL`,
    [clientId],
  );
  const totalRemaining = remaining?.c || 0;

  console.log(`[batch-sync-posts] processing ${posts.length} posts, ~${totalRemaining} remaining`);

  const results: { id: string; success: boolean; error?: string }[] = [];
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;

  for (const post of posts) {
    try {
      if (!post.permalink) {
        results.push({ id: post.id, success: false, error: 'No permalink' });
        continue;
      }
      const isVideo =
        post.post_type === 'reel' ||
        post.post_type === 'video' ||
        post.permalink.includes('/reel/');

      // 1. Extract via Apify -> in-process call to extract-instagram
      console.log(`[batch-sync-posts] ${post.id}: extracting from ${post.permalink}`);
      const extractResp = await callInternal(req, '/api/extract-instagram', {
        url: post.permalink,
        clientId,
        uploadToStorage: true,
      });

      if (!extractResp.ok) {
        const errMsg = extractResp.data?.error || `HTTP ${extractResp.status}`;
        console.warn(`[batch-sync-posts] ${post.id}: extract failed: ${errMsg}`);
        // Mark as synced with caption-only fallback
        const fallbackContent = post.caption || '[Sem conteúdo - extração falhou]';
        await getPool().query(
          `UPDATE instagram_posts SET full_content = $1, content_synced_at = NOW() WHERE id = $2`,
          [fallbackContent, post.id],
        );
        results.push({ id: post.id, success: false, error: `Extract: ${errMsg}` });
        continue;
      }

      const extractData = extractResp.data;
      const imageUrls: string[] = extractData?.images || [];
      const uploadedPaths: string[] = extractData?.uploadedPaths || [];
      const extractedCaption: string | null = extractData?.caption || post.caption;

      console.log(
        `[batch-sync-posts] ${post.id}: ${imageUrls.length} images, ${uploadedPaths.length} uploaded`,
      );

      // 2. Build thumbnail URL (Supabase storage public URL)
      let thumbnailUrl: string | null = null;
      if (uploadedPaths.length > 0 && SUPABASE_URL) {
        thumbnailUrl = `${SUPABASE_URL}/storage/v1/object/public/client-files/${uploadedPaths[0]}`;
      }

      // 3. Transcribe content
      let fullContent = '';
      let videoTranscript: string | null = null;

      if (isVideo) {
        if (imageUrls.length > 0) {
          try {
            const transcribeResp = await callInternal(req, '/api/transcribe-media', {
              url: imageUrls[0],
              fileName: `reels-${post.id}.mp4`,
              clientId,
            });
            if (transcribeResp.ok && transcribeResp.data?.text) {
              videoTranscript = transcribeResp.data.text;
            }
          } catch (e) {
            console.warn(`[batch-sync-posts] ${post.id}: video transcription failed`, e);
          }
        }
        const parts: string[] = [];
        if (extractedCaption) parts.push(`## Legenda\n\n${extractedCaption}`);
        if (videoTranscript) parts.push(`## Roteiro/Transcrição do Vídeo\n\n${videoTranscript}`);
        fullContent = parts.join('\n\n---\n\n');
      } else {
        const transcriptions: string[] = [];
        for (let i = 0; i < imageUrls.length; i++) {
          try {
            const transcribeResp = await callInternal(req, '/api/transcribe-images', {
              imageUrls: [imageUrls[i]],
              startIndex: i,
              userId: 'batch-sync',
              clientId,
            });
            if (transcribeResp.ok && transcribeResp.data?.transcription) {
              transcriptions.push(transcribeResp.data.transcription);
            }
          } catch (e) {
            console.warn(`[batch-sync-posts] ${post.id}: image ${i} transcription failed`, e);
          }
        }
        const parts: string[] = [];
        if (extractedCaption) parts.push(extractedCaption);
        if (transcriptions.length > 0) {
          parts.push('---\n\n## Transcrição das Imagens\n\n' + transcriptions.join('\n\n---\n\n'));
        }
        fullContent = parts.join('\n\n');
      }

      // 4. Update the post
      if (isVideo) {
        await getPool().query(
          `UPDATE instagram_posts
            SET full_content = $1, images = $2, thumbnail_url = $3,
                video_transcript = $4, content_synced_at = NOW()
            WHERE id = $5`,
          [
            fullContent || extractedCaption || '[Sem conteúdo]',
            uploadedPaths,
            thumbnailUrl,
            videoTranscript,
            post.id,
          ],
        );
      } else {
        await getPool().query(
          `UPDATE instagram_posts
            SET full_content = $1, images = $2, thumbnail_url = $3, content_synced_at = NOW()
            WHERE id = $4`,
          [
            fullContent || extractedCaption || '[Sem conteúdo]',
            uploadedPaths,
            thumbnailUrl,
            post.id,
          ],
        );
      }

      results.push({ id: post.id, success: true });
      console.log(
        `[batch-sync-posts] ${post.id}: synced (${uploadedPaths.length} images, thumb=${!!thumbnailUrl})`,
      );
    } catch (postError: any) {
      console.error(`[batch-sync-posts] ${post.id}: error:`, postError);
      results.push({
        id: post.id,
        success: false,
        error: postError?.message || 'Unknown',
      });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  console.log(`[batch-sync-posts] done: ${successCount}/${posts.length}`);

  return {
    processed: posts.length,
    successful: successCount,
    failed: posts.length - successCount,
    remaining: totalRemaining - posts.length,
    results,
  };
});
