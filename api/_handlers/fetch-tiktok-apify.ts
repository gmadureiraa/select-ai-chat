// Migrated from supabase/functions/fetch-tiktok-apify/index.ts
// Scrapes TikTok profile via Apify clockworks scraper, upserts platform_metrics.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';
import { getPool } from '../_lib/db.js';
import { tryAuth, type AuthUser } from '../_lib/auth.js';
import { assertClientAccess } from '../_lib/access.js';

function extractTikTokUsername(input: string): string {
  if (!input) return '';
  const cleaned = input.trim().replace(/^@/, '');
  const match = cleaned.match(/tiktok\.com\/@?([^/?#]+)/i);
  return (match ? match[1] : cleaned).replace(/^@/, '');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res);
  if (req.method !== 'POST') return jsonError(res, 405, 'Method not allowed');

  // Auth: cron OR authed user
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;
  const isCron =
    req.headers['x-vercel-cron'] === '1' ||
    (cronSecret && authHeader === `Bearer ${cronSecret}`);
  let authedUser: AuthUser | null = null;
  if (!isCron) {
    authedUser = await tryAuth(req);
    if (!authedUser) return jsonError(res, 401, 'Unauthorized');
  }

  const startedAt = Date.now();
  try {
    const body =
      req.body && typeof req.body === 'object'
        ? req.body
        : req.body
        ? JSON.parse(req.body)
        : {};
    const { clientId, username: rawUsername } = body as { clientId?: string; username?: string };
    if (!clientId || !rawUsername) throw new Error('clientId and username are required');
    if (authedUser && clientId) await assertClientAccess(authedUser.id, clientId);

    const username = extractTikTokUsername(rawUsername);
    const apifyApiKey = process.env.APIFY_API_KEY || process.env.APIFY_API_TOKEN;
    if (!apifyApiKey) throw new Error('APIFY_API_KEY not configured');

    console.log(`[fetch-tiktok-apify] @${username}`);

    const actorId = 'clockworks~tiktok-scraper';
    const runUrl = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${apifyApiKey}&timeout=120`;
    const apifyResponse = await fetch(runUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profiles: [username],
        resultsPerPage: 10,
        shouldDownloadVideos: false,
        shouldDownloadCovers: false,
        shouldDownloadSubtitles: false,
        shouldDownloadSlideshowImages: false,
      }),
    });
    if (!apifyResponse.ok) {
      const errorText = await apifyResponse.text();
      console.error('[fetch-tiktok-apify] apify error:', errorText);
      if (apifyResponse.status === 429 || apifyResponse.status === 402) {
        return res.status(200).json({
          success: false,
          error: 'Apify rate limit / payment required',
          retryable: true,
        });
      }
      throw new Error(`Apify request failed: ${apifyResponse.status}`);
    }
    const items = await apifyResponse.json();
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('No data returned from Apify TikTok scraper');
    }

    const first = items[0];
    const authorMeta = first?.authorMeta || first?.author || {};
    const followers = authorMeta.fans || authorMeta.followerCount || 0;
    const following = authorMeta.following || authorMeta.followingCount || 0;
    const totalVideos = authorMeta.video || authorMeta.videoCount || items.length;

    let totalViews = 0;
    let totalLikes = 0;
    let totalComments = 0;
    let totalShares = 0;
    const recent = items.slice(0, 10).map((v: any) => {
      const views = v.playCount || 0;
      const likes = v.diggCount || v.likesCount || 0;
      const comments = v.commentCount || 0;
      const shares = v.shareCount || 0;
      totalViews += views;
      totalLikes += likes;
      totalComments += comments;
      totalShares += shares;
      return {
        id: v.id,
        url: v.webVideoUrl,
        timestamp: v.createTimeISO || v.createTime,
        views,
        likes,
        comments,
        shares,
        caption: (v.text || '').substring(0, 200),
      };
    });

    const denom = recent.length * Math.max(followers, 1);
    const engagementRate =
      followers > 0
        ? Number((((totalLikes + totalComments + totalShares) / denom) * 100).toFixed(2))
        : 0;

    const today = new Date().toISOString().split('T')[0];
    const metadata = {
      following,
      username,
      recent_posts: recent,
      nickname: authorMeta.nickName,
      verified: authorMeta.verified,
      fetched_at: new Date().toISOString(),
    };

    await getPool().query(
      `INSERT INTO platform_metrics
        (client_id, platform, metric_date, subscribers, total_posts, views, likes, comments, shares,
         engagement_rate, metadata)
       VALUES ($1, 'tiktok', $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
       ON CONFLICT (client_id, platform, metric_date) DO UPDATE SET
         subscribers = EXCLUDED.subscribers,
         total_posts = EXCLUDED.total_posts,
         views = EXCLUDED.views,
         likes = EXCLUDED.likes,
         comments = EXCLUDED.comments,
         shares = EXCLUDED.shares,
         engagement_rate = EXCLUDED.engagement_rate,
         metadata = EXCLUDED.metadata`,
      [
        clientId,
        today,
        followers,
        totalVideos,
        totalViews,
        totalLikes,
        totalComments,
        totalShares,
        engagementRate,
        JSON.stringify(metadata),
      ],
    );

    return res.status(200).json({
      success: true,
      duration_ms: Date.now() - startedAt,
      items_synced: recent.length,
      estimated_cost_usd: 0.01,
    });
  } catch (err: any) {
    console.error('[fetch-tiktok-apify] error:', err);
    return res.status(500).json({
      success: false,
      error: err.message,
      duration_ms: Date.now() - startedAt,
    });
  }
}
