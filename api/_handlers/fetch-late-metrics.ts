// Migrated from supabase/functions/fetch-late-metrics/index.ts
// Pulls analytics + follower stats from Late API and upserts into Neon tables.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';
import { getPool, query, queryOne } from '../_lib/db.js';
import { tryAuth } from '../_lib/auth.js';

const LATE_API_BASE = 'https://getlate.dev/api/v1';

interface LateAnalyticsPost {
  id: string;
  externalId?: string;
  platform: string;
  content?: string;
  publishedAt?: string;
  platformPostUrl?: string;
  impressions?: number;
  reach?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  clicks?: number;
  views?: number;
  engagementRate?: number;
}

interface LateFollowerStats {
  accountId: string;
  platform: string;
  stats: Record<string, { followers: number }>;
}

interface ProcessingResult {
  clientId: string;
  clientName: string;
  postsUpdated: { instagram: number; twitter: number; linkedin: number };
  postsCreated: { instagram: number; twitter: number; linkedin: number };
  metricsUpdated: number;
  errors: string[];
}

function extractStablePostId(platform: string, post: LateAnalyticsPost): string | null {
  if (post.externalId) return post.externalId;
  const url = post.platformPostUrl || '';
  switch (platform.toLowerCase()) {
    case 'twitter':
    case 'x': {
      const tweetMatch = url.match(/status\/(\d+)/);
      return tweetMatch ? tweetMatch[1] : post.id;
    }
    case 'instagram': {
      const igMatch = url.match(/\/p\/([^\/]+)/);
      return igMatch ? igMatch[1] : post.id;
    }
    case 'linkedin': {
      const liMatch = url.match(/activity[:\-](\d+)/);
      return liMatch ? liMatch[1] : post.id;
    }
    default:
      return post.id;
  }
}

async function fetchLateAnalytics(
  profileId: string,
  lateApiKey: string,
  options?: { platform?: string; fromDate?: string; toDate?: string; page?: number },
): Promise<{ posts: LateAnalyticsPost[]; hasMore: boolean }> {
  const params = new URLSearchParams({ profileId, limit: '100' });
  if (options?.platform) params.set('platform', options.platform);
  if (options?.fromDate) params.set('fromDate', options.fromDate);
  if (options?.toDate) params.set('toDate', options.toDate);
  if (options?.page) params.set('page', options.page.toString());

  const response = await fetch(`${LATE_API_BASE}/analytics?${params}`, {
    headers: { Authorization: `Bearer ${lateApiKey}` },
  });
  if (response.status === 402) throw new Error('ANALYTICS_ADDON_REQUIRED');
  if (response.status === 404) {
    console.log(`Profile ${profileId} not found in Late`);
    return { posts: [], hasMore: false };
  }
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Late API error ${response.status}: ${text}`);
  }
  const data = (await response.json()) as any;
  return { posts: data.posts || data.data || [], hasMore: data.hasMore || false };
}

async function fetchFollowerStats(
  profileId: string,
  lateApiKey: string,
  options?: { fromDate?: string; toDate?: string; granularity?: string },
): Promise<LateFollowerStats[]> {
  const params = new URLSearchParams({
    profileId,
    granularity: options?.granularity || 'daily',
  });
  if (options?.fromDate) params.set('fromDate', options.fromDate);
  if (options?.toDate) params.set('toDate', options.toDate);

  const response = await fetch(`${LATE_API_BASE}/accounts/follower-stats?${params}`, {
    headers: { Authorization: `Bearer ${lateApiKey}` },
  });
  if (response.status === 402) throw new Error('ANALYTICS_ADDON_REQUIRED');
  if (response.status === 404) return [];
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Late API follower-stats error ${response.status}: ${text}`);
  }
  const data = (await response.json()) as any;
  return data.accounts || data.data || [];
}

async function syncInstagramPosts(
  clientId: string,
  posts: LateAnalyticsPost[],
): Promise<{ updated: number; created: number; errors: string[] }> {
  let updated = 0;
  let created = 0;
  const errors: string[] = [];
  for (const post of posts) {
    const permalink = post.platformPostUrl;
    if (!permalink) continue;
    try {
      const existing = await queryOne<any>(
        `SELECT id, likes, impressions, reach, comments, shares, engagement_rate, metadata
         FROM instagram_posts
         WHERE client_id = $1 AND permalink = $2
         ORDER BY likes DESC NULLS LAST
         LIMIT 1`,
        [clientId, permalink],
      );
      if (existing) {
        const sets: string[] = [];
        const vals: any[] = [];
        let i = 1;
        const meta = {
          ...(existing.metadata || {}),
          late_post_id: post.id,
          late_synced_at: new Date().toISOString(),
        };
        sets.push(`updated_at = NOW()`);
        sets.push(`metadata = $${i++}::jsonb`);
        vals.push(JSON.stringify(meta));
        if (post.likes && post.likes > (existing.likes || 0)) {
          sets.push(`likes = $${i++}`);
          vals.push(post.likes);
        }
        if (post.impressions && post.impressions > (existing.impressions || 0)) {
          sets.push(`impressions = $${i++}`);
          vals.push(post.impressions);
        }
        if (post.reach && post.reach > (existing.reach || 0)) {
          sets.push(`reach = $${i++}`);
          vals.push(post.reach);
        }
        if (post.comments && post.comments > (existing.comments || 0)) {
          sets.push(`comments = $${i++}`);
          vals.push(post.comments);
        }
        if (post.shares && post.shares > (existing.shares || 0)) {
          sets.push(`shares = $${i++}`);
          vals.push(post.shares);
        }
        if (post.engagementRate && post.engagementRate > (existing.engagement_rate || 0)) {
          sets.push(`engagement_rate = $${i++}`);
          vals.push(post.engagementRate);
        }
        vals.push(existing.id);
        await getPool().query(
          `UPDATE instagram_posts SET ${sets.join(', ')} WHERE id = $${i}`,
          vals,
        );
        updated++;
      } else {
        await getPool().query(
          `INSERT INTO instagram_posts
            (client_id, post_id, permalink, caption, likes, comments, impressions, reach, shares,
             engagement_rate, posted_at, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)`,
          [
            clientId,
            extractStablePostId('instagram', post),
            permalink,
            post.content || null,
            post.likes || 0,
            post.comments || 0,
            post.impressions || 0,
            post.reach || 0,
            post.shares || 0,
            post.engagementRate || 0,
            post.publishedAt || null,
            JSON.stringify({
              late_post_id: post.id,
              late_synced_at: new Date().toISOString(),
            }),
          ],
        );
        created++;
      }
    } catch (err: any) {
      errors.push(`Instagram exception: ${err.message}`);
    }
  }
  return { updated, created, errors };
}

async function syncTwitterPosts(
  clientId: string,
  posts: LateAnalyticsPost[],
): Promise<{ updated: number; created: number; errors: string[] }> {
  let updated = 0;
  let created = 0;
  const errors: string[] = [];
  for (const post of posts) {
    const tweetUrl = post.platformPostUrl;
    const tweetId = extractStablePostId('twitter', post);
    if (!tweetId) continue;
    try {
      const existing = await queryOne<any>(
        `SELECT id, tweet_id, likes, impressions, retweets, replies, engagement_rate, metadata
         FROM twitter_posts
         WHERE client_id = $1 AND tweet_id = $2
         LIMIT 1`,
        [clientId, tweetId],
      );
      if (existing) {
        const sets: string[] = [`updated_at = NOW()`];
        const vals: any[] = [];
        let i = 1;
        const meta = {
          ...(existing.metadata || {}),
          late_post_id: post.id,
          late_synced_at: new Date().toISOString(),
          tweet_url: tweetUrl,
        };
        sets.push(`metadata = $${i++}::jsonb`);
        vals.push(JSON.stringify(meta));
        if (post.likes && post.likes > (existing.likes || 0)) {
          sets.push(`likes = $${i++}`);
          vals.push(post.likes);
        }
        if (post.impressions && post.impressions > (existing.impressions || 0)) {
          sets.push(`impressions = $${i++}`);
          vals.push(post.impressions);
        }
        if (post.shares && post.shares > (existing.retweets || 0)) {
          sets.push(`retweets = $${i++}`);
          vals.push(post.shares);
        }
        if (post.comments && post.comments > (existing.replies || 0)) {
          sets.push(`replies = $${i++}`);
          vals.push(post.comments);
        }
        if (post.engagementRate && post.engagementRate > (existing.engagement_rate || 0)) {
          sets.push(`engagement_rate = $${i++}`);
          vals.push(post.engagementRate);
        }
        vals.push(existing.id);
        await getPool().query(
          `UPDATE twitter_posts SET ${sets.join(', ')} WHERE id = $${i}`,
          vals,
        );
        updated++;
      } else {
        await getPool().query(
          `INSERT INTO twitter_posts
            (client_id, tweet_id, content, likes, impressions, retweets, replies,
             engagement_rate, posted_at, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)`,
          [
            clientId,
            tweetId,
            post.content || null,
            post.likes || 0,
            post.impressions || 0,
            post.shares || 0,
            post.comments || 0,
            post.engagementRate || 0,
            post.publishedAt || null,
            JSON.stringify({
              late_post_id: post.id,
              late_synced_at: new Date().toISOString(),
              tweet_url: tweetUrl,
            }),
          ],
        );
        created++;
      }
    } catch (err: any) {
      errors.push(`Twitter exception: ${err.message}`);
    }
  }
  return { updated, created, errors };
}

async function syncLinkedInPosts(
  clientId: string,
  posts: LateAnalyticsPost[],
): Promise<{ updated: number; created: number; errors: string[] }> {
  let updated = 0;
  let created = 0;
  const errors: string[] = [];
  for (const post of posts) {
    const postUrl = post.platformPostUrl;
    if (!postUrl) continue;
    try {
      const existing = await queryOne<any>(
        `SELECT id, post_id, likes, impressions, comments, shares, clicks, engagement_rate, metadata
         FROM linkedin_posts
         WHERE client_id = $1 AND post_url = $2
         ORDER BY likes DESC NULLS LAST
         LIMIT 1`,
        [clientId, postUrl],
      );
      if (existing) {
        const sets: string[] = [`updated_at = NOW()`];
        const vals: any[] = [];
        let i = 1;
        const meta = {
          ...(existing.metadata || {}),
          late_post_id: post.id,
          late_synced_at: new Date().toISOString(),
        };
        sets.push(`metadata = $${i++}::jsonb`);
        vals.push(JSON.stringify(meta));
        if (post.likes && post.likes > (existing.likes || 0)) {
          sets.push(`likes = $${i++}`);
          vals.push(post.likes);
        }
        if (post.impressions && post.impressions > (existing.impressions || 0)) {
          sets.push(`impressions = $${i++}`);
          vals.push(post.impressions);
        }
        if (post.comments && post.comments > (existing.comments || 0)) {
          sets.push(`comments = $${i++}`);
          vals.push(post.comments);
        }
        if (post.shares && post.shares > (existing.shares || 0)) {
          sets.push(`shares = $${i++}`);
          vals.push(post.shares);
        }
        if (post.clicks && post.clicks > (existing.clicks || 0)) {
          sets.push(`clicks = $${i++}`);
          vals.push(post.clicks);
        }
        if (post.engagementRate && post.engagementRate > (existing.engagement_rate || 0)) {
          sets.push(`engagement_rate = $${i++}`);
          vals.push(post.engagementRate);
        }
        vals.push(existing.id);
        await getPool().query(
          `UPDATE linkedin_posts SET ${sets.join(', ')} WHERE id = $${i}`,
          vals,
        );
        updated++;
      } else {
        await getPool().query(
          `INSERT INTO linkedin_posts
            (client_id, post_id, post_url, content, likes, impressions, comments, shares, clicks,
             engagement_rate, posted_at, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)`,
          [
            clientId,
            extractStablePostId('linkedin', post) || post.id,
            postUrl,
            post.content || null,
            post.likes || 0,
            post.impressions || 0,
            post.comments || 0,
            post.shares || 0,
            post.clicks || 0,
            post.engagementRate || 0,
            post.publishedAt || null,
            JSON.stringify({
              late_post_id: post.id,
              late_synced_at: new Date().toISOString(),
            }),
          ],
        );
        created++;
      }
    } catch (err: any) {
      errors.push(`LinkedIn exception: ${err.message}`);
    }
  }
  return { updated, created, errors };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res);
  if (req.method !== 'POST' && req.method !== 'GET') {
    return jsonError(res, 405, 'Method not allowed');
  }

  // Auth: cron OR authed user
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;
  const isCron =
    req.headers['x-vercel-cron'] === '1' ||
    (cronSecret && authHeader === `Bearer ${cronSecret}`);
  if (!isCron) {
    const user = await tryAuth(req);
    if (!user) return jsonError(res, 401, 'Unauthorized');
  }

  const startTime = Date.now();
  try {
    const lateApiKey = process.env.LATE_API_KEY;
    if (!lateApiKey) throw new Error('LATE_API_KEY not configured');

    const body =
      req.body && typeof req.body === 'object'
        ? req.body
        : req.body
        ? JSON.parse(req.body)
        : {};
    const targetClientId: string | undefined = body?.clientId;

    // Get clients with Late connected (have late_profile_id in metadata)
    const credentials = targetClientId
      ? await query<any>(
          `SELECT cc.client_id, cc.metadata, c.name AS client_name
           FROM client_social_credentials cc
           JOIN clients c ON c.id = cc.client_id
           WHERE cc.metadata->>'late_profile_id' IS NOT NULL
             AND cc.client_id = $1`,
          [targetClientId],
        )
      : await query<any>(
          `SELECT cc.client_id, cc.metadata, c.name AS client_name
           FROM client_social_credentials cc
           JOIN clients c ON c.id = cc.client_id
           WHERE cc.metadata->>'late_profile_id' IS NOT NULL`,
        );

    if (!credentials || credentials.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No clients with Late connected',
        clientsProcessed: 0,
        duration: Date.now() - startTime,
      });
    }

    const clientProfileMap = new Map<
      string,
      { clientId: string; clientName: string; profileIds: Set<string> }
    >();
    for (const cred of credentials) {
      const clientId = cred.client_id;
      const clientName = cred.client_name || 'Unknown';
      const profileId = cred.metadata?.late_profile_id;
      if (!profileId) continue;
      if (!clientProfileMap.has(clientId)) {
        clientProfileMap.set(clientId, { clientId, clientName, profileIds: new Set() });
      }
      clientProfileMap.get(clientId)!.profileIds.add(profileId);
    }

    const results: ProcessingResult[] = [];
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 90);
    const fromDateStr = fromDate.toISOString().split('T')[0];
    const toDateStr = new Date().toISOString().split('T')[0];

    for (const [clientId, clientData] of clientProfileMap) {
      const result: ProcessingResult = {
        clientId,
        clientName: clientData.clientName,
        postsUpdated: { instagram: 0, twitter: 0, linkedin: 0 },
        postsCreated: { instagram: 0, twitter: 0, linkedin: 0 },
        metricsUpdated: 0,
        errors: [],
      };

      for (const profileId of clientData.profileIds) {
        try {
          // 1. Follower stats -> upsert into platform_metrics
          const followerStats = await fetchFollowerStats(profileId, lateApiKey, {
            fromDate: fromDateStr,
            toDate: toDateStr,
            granularity: 'daily',
          });
          for (const account of followerStats) {
            const platform = account.platform?.toLowerCase();
            if (!platform || !account.stats) continue;
            for (const [date, data] of Object.entries(account.stats)) {
              try {
                await getPool().query(
                  `INSERT INTO platform_metrics
                    (client_id, platform, metric_date, subscribers, updated_at)
                   VALUES ($1, $2, $3, $4, NOW())
                   ON CONFLICT (client_id, platform, metric_date)
                   DO UPDATE SET subscribers = EXCLUDED.subscribers, updated_at = NOW()`,
                  [clientId, platform, date, data.followers || 0],
                );
                result.metricsUpdated++;
              } catch (e: any) {
                result.errors.push(`Metrics upsert: ${e.message}`);
              }
            }
          }

          // 2. Post analytics
          let page = 1;
          let hasMore = true;
          while (hasMore) {
            const { posts, hasMore: more } = await fetchLateAnalytics(profileId, lateApiKey, {
              fromDate: fromDateStr,
              toDate: toDateStr,
              page,
            });
            hasMore = more;
            page++;
            if (posts.length === 0) break;

            const ig: LateAnalyticsPost[] = [];
            const tw: LateAnalyticsPost[] = [];
            const li: LateAnalyticsPost[] = [];
            for (const p of posts) {
              const platform = p.platform?.toLowerCase();
              switch (platform) {
                case 'instagram':
                  ig.push(p);
                  break;
                case 'twitter':
                case 'x':
                  tw.push(p);
                  break;
                case 'linkedin':
                  li.push(p);
                  break;
              }
            }
            if (ig.length > 0) {
              const r = await syncInstagramPosts(clientId, ig);
              result.postsUpdated.instagram += r.updated;
              result.postsCreated.instagram += r.created;
              result.errors.push(...r.errors);
            }
            if (tw.length > 0) {
              const r = await syncTwitterPosts(clientId, tw);
              result.postsUpdated.twitter += r.updated;
              result.postsCreated.twitter += r.created;
              result.errors.push(...r.errors);
            }
            if (li.length > 0) {
              const r = await syncLinkedInPosts(clientId, li);
              result.postsUpdated.linkedin += r.updated;
              result.postsCreated.linkedin += r.created;
              result.errors.push(...r.errors);
            }
            if (posts.length < 100) break;
          }
        } catch (error: any) {
          if (error.message === 'ANALYTICS_ADDON_REQUIRED') {
            result.errors.push(`Profile ${profileId}: Analytics add-on required`);
          } else {
            result.errors.push(`Profile ${profileId}: ${error.message}`);
          }
        }
      }
      results.push(result);
      console.log(
        `[fetch-late-metrics] ${clientData.clientName}: updated=${JSON.stringify(result.postsUpdated)} created=${JSON.stringify(result.postsCreated)} metrics=${result.metricsUpdated}`,
      );
    }

    const duration = Date.now() - startTime;
    const totalUpdated = results.reduce(
      (s, r) => s + r.postsUpdated.instagram + r.postsUpdated.twitter + r.postsUpdated.linkedin,
      0,
    );
    const totalCreated = results.reduce(
      (s, r) => s + r.postsCreated.instagram + r.postsCreated.twitter + r.postsCreated.linkedin,
      0,
    );
    const totalMetrics = results.reduce((s, r) => s + r.metricsUpdated, 0);
    const totalErrors = results.reduce((s, r) => s + r.errors.length, 0);

    return res.status(200).json({
      success: true,
      clientsProcessed: results.length,
      totalPostsUpdated: totalUpdated,
      totalPostsCreated: totalCreated,
      totalMetricsUpdated: totalMetrics,
      totalErrors,
      duration,
      results,
    });
  } catch (error: any) {
    console.error('[fetch-late-metrics] fatal:', error);
    return jsonError(res, 500, error?.message || 'fatal', { duration: Date.now() - startTime });
  }
}
