// cron-transcribe-recent-posts — roda 1x/dia às 12h.
// Lista posts recentes (últimos 7 dias) que ainda não têm transcription
// e dispara /api/transcribe-post pra cada um. Limit 20/run.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight } from '../_lib/cors.js';
import { query } from '../_lib/db.js';
import { assertCronAuth } from '../_lib/cron-auth.js';

const MAX_PER_RUN = 20;
const LOOKBACK_DAYS = 7;

function getOrigin(req: VercelRequest): string {
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
  const host = req.headers.host || 'localhost:3000';
  return `${proto}://${host}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res);

  if (!assertCronAuth(req, res)) return;

  const startedAt = Date.now();
  const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 86400000).toISOString();

  // Pega instagram_posts dos últimos 7d sem transcrição ainda.
  // (Outras redes podem ser adicionadas conforme tabelas existam.)
  const posts = await query<any>(
    `SELECT ip.id, ip.client_id, ip.post_id, ip.post_type, ip.caption, ip.thumbnail_url,
            ip.permalink, ip.metadata, ip.images, c.name AS client_name
       FROM instagram_posts ip
       LEFT JOIN clients c ON c.id = ip.client_id
      WHERE ip.posted_at >= $1
        AND NOT EXISTS (
          SELECT 1 FROM client_post_transcriptions t
           WHERE t.client_id = ip.client_id
             AND t.post_id = ip.post_id
             AND t.source = 'instagram_posts'
        )
      ORDER BY ip.posted_at DESC
      LIMIT $2`,
    [cutoff, MAX_PER_RUN],
  );

  if (posts.length === 0) {
    return res.status(200).json({
      ok: true,
      message: 'no posts pending transcription',
      durationMs: Date.now() - startedAt,
    });
  }

  console.log(`[cron-transcribe-recent-posts] processing ${posts.length} posts`);

  const results: { id: string; success: boolean; error?: string }[] = [];

  // Pós-migração Neon o cron-scrape-instagram grava `thumbnail_url` como URL
  // absoluta (IG CDN). Linhas legadas tinham `images` como array de paths
  // Supabase Storage `client-files/...`, mas esse bucket não está mais sendo
  // populado, então NÃO fazemos fallback pra Supabase. Se `images[i]` não
  // for URL absoluta, ignoramos e logamos.
  for (const post of posts) {
    if (!post.post_id) {
      results.push({ id: post.id, success: false, error: 'no post_id' });
      continue;
    }

    let imageUrls: string[] = [];
    if (Array.isArray(post.images) && post.images.length > 0) {
      const dropped: string[] = [];
      imageUrls = post.images
        .map((img: unknown) => (typeof img === 'string' ? img : ''))
        .filter((img: string) => {
          if (!img) return false;
          if (img.startsWith('http')) return true;
          dropped.push(img);
          return false;
        });
      if (dropped.length > 0) {
        console.warn(
          `[cron-transcribe-recent-posts] post ${post.id}: ${dropped.length} imagens legadas (Supabase paths) ignoradas`,
        );
      }
    }
    if (imageUrls.length === 0 && post.thumbnail_url) {
      imageUrls = [post.thumbnail_url];
    }

    let videoUrl: string | undefined;
    if (post.metadata && typeof post.metadata === 'object') {
      videoUrl = post.metadata.video_url || post.metadata.videoUrl || undefined;
    }

    try {
      const r = await fetch(`${getOrigin(req)}/api/transcribe-post`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-call': 'true',
          ...(process.env.CRON_SECRET
            ? { Authorization: `Bearer ${process.env.CRON_SECRET}` }
            : {}),
        },
        body: JSON.stringify({
          clientId: post.client_id,
          postId: post.post_id,
          source: 'instagram_posts',
          network: 'instagram',
          postType: post.post_type || 'post',
          imageUrls,
          videoUrl,
          caption: post.caption || '',
          force: false,
        }),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) {
        results.push({
          id: post.id,
          success: false,
          error: (json as any)?.error || `HTTP ${r.status}`,
        });
      } else {
        results.push({ id: post.id, success: true });
      }
      // Pequeno delay defensivo
      await new Promise((r) => setTimeout(r, 250));
    } catch (e: any) {
      console.warn(`[cron-transcribe-recent-posts] failed for ${post.id}:`, e?.message);
      results.push({ id: post.id, success: false, error: e?.message || 'unknown' });
    }
  }

  const success = results.filter((r) => r.success).length;
  const durationMs = Date.now() - startedAt;
  console.log(
    `[cron-transcribe-recent-posts] done: ${success}/${posts.length} (${durationMs}ms)`,
  );

  return res.status(200).json({
    ok: true,
    processed: posts.length,
    successful: success,
    failed: posts.length - success,
    durationMs,
    results,
  });
}
