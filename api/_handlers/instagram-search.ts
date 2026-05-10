// Migrated from supabase/functions/instagram-search/index.ts
import { authedPost } from '../_lib/handler.js';
import { cacheViralSearch } from '../_lib/shared/viral-cache.js';
import { assertClientAccess } from '../_lib/access.js';

export default authedPost(async ({ user, body }) => {
  const hashtag = (body?.hashtag ?? '').trim().replace(/^#/, '');
  if (!hashtag) throw new Error('hashtag obrigatória');
  if (body?.clientId) await assertClientAccess(user.id, body.clientId);

  const limit = Math.min(Math.max(body?.limit ?? 12, 1), 30);
  const offset = Math.max(body?.offset ?? 0, 0);
  const totalNeeded = offset + limit;

  const apifyKey = process.env.APIFY_API_KEY_INSTAGRAM ?? process.env.APIFY_API_KEY ?? process.env.APIFY_API_TOKEN;
  if (!apifyKey) throw new Error('APIFY_API_KEY_INSTAGRAM não configurada');

  const startRes = await fetch(
    `https://api.apify.com/v2/acts/apify~instagram-hashtag-scraper/runs?token=${apifyKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hashtags: [hashtag], resultsLimit: totalNeeded }),
    }
  );
  if (!startRes.ok) {
    const t = await startRes.text().catch(() => '');
    throw new Error(`Apify start ${startRes.status}: ${t.slice(0, 300)}`);
  }
  const startJson = await startRes.json();
  const runId = startJson?.data?.id;
  const datasetId = startJson?.data?.defaultDatasetId;
  let status = startJson?.data?.status;

  const deadline = Date.now() + 120_000;
  while (runId && Date.now() < deadline && !['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'].includes(status)) {
    await new Promise((r) => setTimeout(r, 3000));
    const sRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${apifyKey}`);
    if (!sRes.ok) break;
    status = (await sRes.json())?.data?.status;
  }
  if (status !== 'SUCCEEDED' || !datasetId) throw new Error(`Apify run ${status}`);

  const dsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyKey}&clean=true&format=json`);
  if (!dsRes.ok) throw new Error(`Apify dataset ${dsRes.status}`);
  const raw: any[] = await dsRes.json();
  const all = (Array.isArray(raw) ? raw : []).map((p: any) => ({
    id: p.id ?? p.shortCode ?? p.url,
    shortCode: p.shortCode ?? null,
    url: p.url ?? (p.shortCode ? `https://instagram.com/p/${p.shortCode}/` : ''),
    type: p.type ?? 'Post',
    caption: p.caption ?? '',
    hashtags: Array.isArray(p.hashtags) ? p.hashtags : [],
    ownerUsername: p.ownerUsername ?? p.owner?.username ?? '',
    ownerFullName: p.ownerFullName ?? p.owner?.full_name ?? '',
    thumbnailUrl: p.displayUrl ?? p.thumbnailUrl ?? '',
    videoUrl: p.videoUrl ?? null,
    likesCount: typeof p.likesCount === 'number' ? p.likesCount : null,
    commentsCount: typeof p.commentsCount === 'number' ? p.commentsCount : null,
    videoPlayCount: typeof p.videoPlayCount === 'number' ? p.videoPlayCount : null,
    videoViewCount: typeof p.videoViewCount === 'number' ? p.videoViewCount : null,
    timestamp: p.timestamp ?? null,
  }));

  const page = all.slice(offset, offset + limit);
  const hasMore = all.length >= totalNeeded && page.length === limit;

  await cacheViralSearch({
    workspaceId: body?.workspaceId,
    clientId: body?.clientId,
    source: 'instagram',
    query: `#${hashtag}`,
    items: page,
    filters: { hashtag, limit, offset },
    isFallback: false,
    nextPageToken: hasMore ? String(offset + limit) : null,
    userId: user.id,
  });

  return {
    items: page,
    nextPageToken: hasMore ? String(offset + limit) : null,
    source: 'apify-instagram',
  };
});
