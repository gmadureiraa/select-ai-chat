// Migrated from supabase/functions/fetch-twitter-apify/index.ts
import { authedPost } from '../_lib/handler.js';
import { getPool } from '../_lib/db.js';
import { assertClientAccess } from '../_lib/access.js';

function parseCount(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  const str = String(val).replace(/,/g, '');
  const num = parseInt(str, 10);
  return isNaN(num) ? 0 : num;
}

export default authedPost(async ({ body, user }) => {
  const { clientId, twitterHandle, maxResults: customMaxResults } = body;
  if (!clientId || !twitterHandle) throw new Error('clientId and twitterHandle are required');
  await assertClientAccess(user.id, clientId);

  const APIFY_API_TOKEN_1 = process.env.APIFY_API_TOKEN || process.env.APIFY_API_KEY;
  const APIFY_API_TOKEN_2 = process.env.APIFY_API_TOKEN_2;
  const apifyTokens = [APIFY_API_TOKEN_1, APIFY_API_TOKEN_2].filter(Boolean) as string[];
  if (apifyTokens.length === 0) throw new Error('No APIFY_API_TOKEN configured.');

  const handle = String(twitterHandle).trim().replace(/^@/, '').replace(/^https?:\/\/(x|twitter)\.com\//, '').replace(/\/.*$/, '');
  const actorId = 'xtdata~twitter-x-scraper';
  const maxItems = customMaxResults || 100;

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
        const startUrl = `https://api.apify.com/v2/acts/${actorId}/runs?token=${token}`;
        const sr = await fetch(startUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ twitterHandles: [handle], maxItems, sort: 'Latest' }),
        });
        if (!sr.ok) {
          const errText = await sr.text();
          if (sr.status === 429 || errText.includes('limit')) {
            lastError = `Token rate/quota limit`;
            if (errText.includes('hard limit') || errText.includes('platform-feature-disabled')) break;
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
        const maxWaitMs = 180_000;
        const startTime = Date.now();
        while (status !== 'SUCCEEDED' && status !== 'FAILED' && status !== 'ABORTED' && status !== 'TIMED-OUT') {
          if (Date.now() - startTime > maxWaitMs) {
            lastError = 'Scraping took too long';
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
    return { error: lastError || `Nenhum tweet encontrado para @${handle}.`, success: false };
  }

  const tweetItems = items.filter((it: any) => !it.error && (it.id || it.id_str || it.tweetId || it.url?.includes('/status/')));
  const pool = getPool();
  let tweetsUpserted = 0;

  for (const item of tweetItems) {
    let tweetId = item.id_str || item.id || item.tweetId || '';
    if (!tweetId && item.url) {
      const m = item.url.match(/status\/(\d+)/);
      if (m) tweetId = m[1];
    }
    if (!tweetId) continue;

    let postedAt: string | null = null;
    const dateStr = item.created_at || item.createdAt || item.date || item.timestamp;
    if (dateStr) { try { postedAt = new Date(dateStr).toISOString(); } catch {} }

    const likes = parseCount(item.favorite_count ?? item.likeCount ?? item.likes ?? 0);
    const retweets = parseCount(item.retweet_count ?? item.retweetCount ?? item.retweets ?? 0);
    const replies = parseCount(item.reply_count ?? item.replyCount ?? item.replies ?? 0);
    const impressions = parseCount(item.view_count ?? item.viewCount ?? item.views ?? item.impressions ?? 0);
    const bookmarks = parseCount(item.bookmark_count ?? item.bookmarkCount ?? item.bookmarks ?? 0);
    const engagements = likes + retweets + replies + bookmarks;
    const engagementRate = impressions > 0 ? (engagements / impressions) * 100 : 0;
    const content = item.full_text || item.text || item.content || null;

    const images: string[] = [];
    if (item.entities?.media) {
      for (const m of item.entities.media) if (m.media_url_https) images.push(m.media_url_https);
    }
    if (Array.isArray(item.media)) {
      for (const m of item.media) {
        const url = m.media_url_https || m.url || m.preview_image_url;
        if (url) images.push(url);
      }
    }

    try {
      await pool.query(
        `INSERT INTO twitter_posts (
           client_id, tweet_id, content, full_content, posted_at,
           impressions, engagements, engagement_rate, retweets, replies, likes,
           profile_clicks, url_clicks, hashtag_clicks, detail_expands, media_views, media_engagements,
           images, content_synced_at, metadata
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20::jsonb
         ) ON CONFLICT (client_id, tweet_id) DO UPDATE SET
           content = EXCLUDED.content, full_content = EXCLUDED.full_content,
           impressions = EXCLUDED.impressions, engagements = EXCLUDED.engagements,
           engagement_rate = EXCLUDED.engagement_rate, retweets = EXCLUDED.retweets,
           replies = EXCLUDED.replies, likes = EXCLUDED.likes, images = EXCLUDED.images,
           metadata = EXCLUDED.metadata, content_synced_at = EXCLUDED.content_synced_at`,
        [
          clientId, String(tweetId), content, content, postedAt,
          impressions, engagements, engagementRate, retweets, replies, likes,
          0, 0, 0, 0, 0, 0,
          images.length > 0 ? images : null,
          content ? new Date().toISOString() : null,
          JSON.stringify({ apify_source: true, scraped_at: new Date().toISOString(), bookmarks, author_handle: handle }),
        ]
      );
      tweetsUpserted++;
    } catch (e) {
      console.warn('[fetch-twitter-apify] upsert failed for', tweetId, e);
    }
  }

  return { success: true, tweetsFound: tweetItems.length, tweetsUpdated: tweetsUpserted, handle };
});
