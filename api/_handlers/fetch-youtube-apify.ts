// Migrated from supabase/functions/fetch-youtube-apify/index.ts
import { authedPost } from '../_lib/handler.js';
import { getPool } from '../_lib/db.js';
import { assertClientAccess } from '../_lib/access.js';

function parseViewCount(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  const str = String(val).replace(/,/g, '').replace(/\s/g, '');
  const num = parseInt(str, 10);
  return isNaN(num) ? 0 : num;
}

export default authedPost(async ({ body, user }) => {
  const { clientId, channelUrl, singleVideo, maxResults: customMaxResults } = body;
  if (!clientId || !channelUrl) throw new Error('clientId and channelUrl are required');
  await assertClientAccess(user.id, clientId);

  const APIFY_API_TOKEN_1 = process.env.APIFY_API_TOKEN || process.env.APIFY_API_KEY;
  const APIFY_API_TOKEN_2 = process.env.APIFY_API_TOKEN_2;
  const apifyTokens = [APIFY_API_TOKEN_1, APIFY_API_TOKEN_2].filter(Boolean) as string[];
  if (apifyTokens.length === 0) throw new Error('Nenhum APIFY_API_TOKEN configurado.');

  let normalizedUrl = String(channelUrl).trim();
  if (!singleVideo) {
    if (normalizedUrl.startsWith('@')) normalizedUrl = `https://www.youtube.com/${normalizedUrl}`;
    else if (!normalizedUrl.startsWith('http')) normalizedUrl = `https://www.youtube.com/@${normalizedUrl}`;
  }

  const actorId = 'streamers~youtube-scraper';
  let items: any[] = [];
  let lastError = '';
  const MAX_RETRIES = 2;

  for (const token of apifyTokens) {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          const waitMs = Math.pow(2, attempt) * 3000 + Math.random() * 2000;
          await new Promise((r) => setTimeout(r, waitMs));
        }
        const sr = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${token}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            startUrls: [{ url: normalizedUrl }],
            maxResults: singleVideo ? 1 : (customMaxResults || 50),
            maxResultsShorts: 0,
            maxResultStreams: 0,
            scrapeComments: false,
          }),
        });
        if (!sr.ok) {
          const errText = await sr.text();
          if (sr.status === 429 || errText.includes('limit')) {
            lastError = `Token rate limit`;
            if (attempt < MAX_RETRIES) continue;
            break;
          }
          lastError = `Apify start error: ${sr.status}`;
          break;
        }
        const runData = await sr.json();
        const runId = runData.data?.id;
        const datasetId = runData.data?.defaultDatasetId;
        let status = runData.data?.status;
        const startTime = Date.now();
        const maxWaitMs = 180_000;
        while (status !== 'SUCCEEDED' && status !== 'FAILED' && status !== 'ABORTED' && status !== 'TIMED-OUT') {
          if (Date.now() - startTime > maxWaitMs) {
            lastError = 'Scraping demorou demais';
            break;
          }
          await new Promise((r) => setTimeout(r, 5000));
          const statusR = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${token}`);
          const sd = await statusR.json();
          status = sd.data?.status;
        }
        if (status !== 'SUCCEEDED') {
          lastError = `Apify run ${status}`;
          continue;
        }
        const dr = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}`);
        items = await dr.json();
        break;
      } catch (e: any) {
        lastError = e?.message || 'Unknown error';
        if (attempt < MAX_RETRIES) continue;
      }
    }
    if (items.length > 0) break;
  }

  if (!Array.isArray(items) || items.length === 0) {
    return { error: lastError || 'Nenhum vídeo encontrado.', success: false };
  }

  const videoItems = items.filter((it: any) =>
    !it.error && (it.type === 'video' || it.id || it.videoId || it.url?.includes('/watch') || (it.title && (it.viewCount !== undefined || it.views !== undefined || it.numberOfViews !== undefined)))
  );

  const pool = getPool();
  let videosUpserted = 0;

  for (const item of videoItems) {
    const videoId = item.id || item.videoId ||
      (item.url?.match(/(?:v=|\/shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1]) ||
      `unknown-${Date.now()}-${Math.random()}`;
    if (!videoId || videoId.startsWith('unknown-')) continue;

    let durationSeconds: number | null = null;
    if (item.duration) {
      if (typeof item.duration === 'number') durationSeconds = item.duration;
      else if (typeof item.duration === 'string') {
        const parts = item.duration.split(':').map(Number);
        if (parts.length === 3) durationSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
        else if (parts.length === 2) durationSeconds = parts[0] * 60 + parts[1];
      }
    }
    let publishedAt: string | null = null;
    if (item.date || item.uploadDate || item.publishedAt) {
      try { publishedAt = new Date(item.date || item.uploadDate || item.publishedAt).toISOString(); } catch {}
    }

    try {
      await pool.query(
        `INSERT INTO youtube_videos (
           client_id, video_id, title, total_views, likes, comments,
           published_at, duration_seconds, thumbnail_url, impressions, click_rate,
           subscribers_gained, watch_hours, metadata
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)
         ON CONFLICT (client_id, video_id) DO UPDATE SET
           title = EXCLUDED.title, total_views = EXCLUDED.total_views,
           likes = EXCLUDED.likes, comments = EXCLUDED.comments, metadata = EXCLUDED.metadata`,
        [
          clientId, videoId,
          item.title || item.text || 'Sem título',
          parseViewCount(item.viewCount ?? item.views ?? item.numberOfViews ?? 0),
          parseViewCount(item.likes ?? item.likeCount ?? item.numberOfLikes ?? 0),
          parseViewCount(item.commentsCount ?? item.commentCount ?? item.numberOfComments ?? 0),
          publishedAt, durationSeconds,
          item.thumbnailUrl || item.thumbnail || item.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          null, null, null, null,
          JSON.stringify({
            apify_source: true,
            scraped_at: new Date().toISOString(),
            channel_name: item.channelName || item.channelTitle || null,
            channel_url: item.channelUrl || null,
            url: item.url || `https://www.youtube.com/watch?v=${videoId}`,
            description: item.description?.substring(0, 500) || null,
          }),
        ]
      );
      videosUpserted++;
    } catch (e) {
      console.warn('[fetch-youtube-apify] upsert failed for', videoId, e);
    }
  }

  return { success: true, videosFound: videoItems.length, videosUpdated: videosUpserted, channelUrl: normalizedUrl };
});
