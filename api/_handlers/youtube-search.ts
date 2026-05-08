// Migrated from supabase/functions/youtube-search/index.ts
import { anonPost } from '../_lib/handler.js';
import { getPool } from '../_lib/db.js';

const YT_API_BASE = 'https://www.googleapis.com/youtube/v3';

interface SearchBody {
  query: string;
  publishedAfter?: string;
  order?: 'relevance' | 'date' | 'viewCount' | 'rating';
  maxResults?: number;
  pageToken?: string;
  clientId?: string;
  workspaceId?: string;
}

function normalizeQuery(q: string) {
  return (q ?? '').toLowerCase().trim().replace(/\s+/g, ' ');
}

async function cacheViralSearch(args: {
  workspaceId?: string;
  clientId?: string;
  source: string;
  query: string;
  items: unknown[];
  filters?: Record<string, unknown>;
  isFallback?: boolean;
  nextPageToken?: string | null;
  userId?: string | null;
}) {
  if (!args.workspaceId || !args.clientId || !Array.isArray(args.items) || args.items.length === 0) return;
  try {
    await getPool().query(
      `INSERT INTO viral_search_cache (workspace_id, client_id, source, query, query_normalized, filters, items, item_count, is_fallback, next_page_token, created_by)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10,$11)`,
      [
        args.workspaceId,
        args.clientId,
        args.source,
        args.query,
        normalizeQuery(args.query),
        JSON.stringify(args.filters ?? {}),
        JSON.stringify(args.items),
        args.items.length,
        !!args.isFallback,
        args.nextPageToken ?? null,
        args.userId ?? null,
      ]
    );
  } catch (e) {
    console.warn(`[viralCache:${args.source}] insert failed:`, (e as Error).message);
  }
}

export default anonPost(async ({ user, body }) => {
  const apiKey = process.env.YOUTUBE_API_KEY ?? process.env.YT_API_KEY;
  if (!apiKey) {
    throw new Error('YOUTUBE_API_KEY não configurada');
  }
  const b = body as Partial<SearchBody>;
  const query = (b.query ?? '').trim();
  if (!query) throw new Error('query é obrigatória');
  const order = b.order ?? 'viewCount';
  const maxResults = Math.min(Math.max(b.maxResults ?? 12, 1), 50);

  const searchUrl = new URL(`${YT_API_BASE}/search`);
  searchUrl.searchParams.set('part', 'snippet');
  searchUrl.searchParams.set('type', 'video');
  searchUrl.searchParams.set('maxResults', String(maxResults));
  searchUrl.searchParams.set('order', order);
  searchUrl.searchParams.set('q', query);
  searchUrl.searchParams.set('key', apiKey);
  if (b.publishedAfter) searchUrl.searchParams.set('publishedAfter', b.publishedAfter);
  if (b.pageToken) searchUrl.searchParams.set('pageToken', b.pageToken);

  const r = await fetch(searchUrl.toString());
  if (!r.ok) {
    const errText = await r.text().catch(() => '');
    const apifyKey = process.env.APIFY_API_KEY ?? process.env.APIFY_API_TOKEN;
    if (apifyKey && (r.status === 403 || r.status === 429 || r.status === 400)) {
      console.log('[youtube-search] YT Data API failed, trying Apify fallback');
      try {
        const startRes = await fetch(`https://api.apify.com/v2/acts/streamers~youtube-scraper/runs?token=${apifyKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ searchQueries: [query], maxResults: Math.min(maxResults, 20), maxResultsShorts: 0, maxResultStreams: 0 }),
        });
        if (startRes.ok) {
          const startJson = await startRes.json();
          const runId = startJson?.data?.id;
          const datasetId = startJson?.data?.defaultDatasetId;
          let status = startJson?.data?.status;
          const deadline = Date.now() + 120_000;
          while (runId && Date.now() < deadline && !['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'].includes(status)) {
            await new Promise((rr) => setTimeout(rr, 3000));
            const sRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${apifyKey}`);
            if (!sRes.ok) break;
            const sJson = await sRes.json();
            status = sJson?.data?.status;
          }
          if (status === 'SUCCEEDED' && datasetId) {
            const dsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyKey}&clean=true&format=json`);
            if (dsRes.ok) {
              const apifyItems = await dsRes.json();
              const mapped = (Array.isArray(apifyItems) ? apifyItems : [])
                .filter((v: any) => v?.id || v?.url)
                .map((v: any) => {
                  const id = v.id ?? v.url?.match(/v=([^&]+)/)?.[1] ?? '';
                  return {
                    id,
                    title: v.title ?? '',
                    channelTitle: v.channelName ?? v.channel ?? '',
                    channelId: v.channelId ?? '',
                    thumbnailUrl: v.thumbnailUrl ?? (id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : ''),
                    publishedAt: v.date ?? v.uploadDate ?? new Date().toISOString(),
                    description: v.text ?? v.description ?? '',
                    url: v.url ?? `https://www.youtube.com/watch?v=${id}`,
                    viewCount: typeof v.viewCount === 'number' ? v.viewCount : (v.viewCountText ? parseInt(String(v.viewCountText).replace(/\D/g, ''), 10) || undefined : undefined),
                    likeCount: typeof v.likes === 'number' ? v.likes : undefined,
                    commentCount: typeof v.commentsCount === 'number' ? v.commentsCount : undefined,
                  };
                });
              await cacheViralSearch({
                workspaceId: b.workspaceId,
                clientId: b.clientId,
                source: 'youtube',
                query,
                items: mapped,
                isFallback: true,
                userId: user?.id ?? null,
                filters: { order, publishedAfter: b.publishedAfter, maxResults },
              });
              return { items: mapped, source: 'apify-fallback', nextPageToken: null };
            }
          }
        }
      } catch (apifyErr) {
        console.error('[youtube-search] Apify fallback exception:', apifyErr);
      }
    }
    throw new Error(`YouTube API ${r.status}: ${errText.slice(0, 500)}`);
  }

  const searchJson = await r.json();
  const nextPageToken = searchJson.nextPageToken ?? null;
  const items: any[] = searchJson.items ?? [];
  const videoIds = items.map((i: any) => i?.id?.videoId).filter(Boolean) as string[];

  const statsById = new Map<string, any>();
  if (videoIds.length > 0) {
    const videosUrl = new URL(`${YT_API_BASE}/videos`);
    videosUrl.searchParams.set('part', 'statistics');
    videosUrl.searchParams.set('id', videoIds.join(','));
    videosUrl.searchParams.set('key', apiKey);
    const vRes = await fetch(videosUrl.toString());
    if (vRes.ok) {
      const vjson = await vRes.json();
      for (const v of vjson.items ?? []) {
        statsById.set(v.id, v.statistics ?? {});
      }
    }
  }

  const results = items.filter((i: any) => i?.id?.videoId).map((i: any) => {
    const id = i.id.videoId;
    const stats = statsById.get(id);
    const thumb = i.snippet?.thumbnails?.high?.url ?? i.snippet?.thumbnails?.medium?.url ?? i.snippet?.thumbnails?.default?.url ?? '';
    return {
      id,
      title: i.snippet?.title,
      channelTitle: i.snippet?.channelTitle,
      channelId: i.snippet?.channelId,
      thumbnailUrl: thumb,
      publishedAt: i.snippet?.publishedAt,
      description: i.snippet?.description,
      url: `https://www.youtube.com/watch?v=${id}`,
      viewCount: stats?.viewCount ? parseInt(stats.viewCount, 10) : undefined,
      likeCount: stats?.likeCount ? parseInt(stats.likeCount, 10) : undefined,
      commentCount: stats?.commentCount ? parseInt(stats.commentCount, 10) : undefined,
    };
  });

  if (!b.pageToken) {
    await cacheViralSearch({
      workspaceId: b.workspaceId,
      clientId: b.clientId,
      source: 'youtube',
      query,
      items: results,
      isFallback: false,
      nextPageToken,
      userId: user?.id ?? null,
      filters: { order, publishedAfter: b.publishedAfter, maxResults },
    });
  }

  return { items: results, source: 'youtube-api', nextPageToken };
});
