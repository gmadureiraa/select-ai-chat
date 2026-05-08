// Migrated from supabase/functions/late-analytics/index.ts
// @deprecated 2026-05-08: Postiz tem `getPlatformAnalytics(integrationId, days)` em
// _lib/integrations/postiz.ts. Criar handler dedicado quando o front migrar.
import { authedPost } from '../_lib/handler.js';
import { query } from '../_lib/db.js';

const LATE_API_BASE = 'https://getlate.dev/api/v1';

async function fetchAnalytics(profileId: string, apiKey: string, platform: string, fromDate: string, toDate: string) {
  const params = new URLSearchParams({ profileId, platform, fromDate, toDate, limit: '50' });
  const r = await fetch(`${LATE_API_BASE}/analytics?${params}`, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!r.ok) {
    if (r.status === 402) return { posts: [], error: 'ANALYTICS_ADDON_REQUIRED' };
    if (r.status === 404) return { posts: [] };
    return { posts: [], error: `API error ${r.status}` };
  }
  const data = await r.json();
  return { posts: data.posts || data.data || [] };
}

async function fetchFollowerStats(profileId: string, apiKey: string, fromDate: string, toDate: string) {
  const params = new URLSearchParams({ profileId, granularity: 'daily', fromDate, toDate });
  const r = await fetch(`${LATE_API_BASE}/accounts/follower-stats?${params}`, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!r.ok) return [];
  const data = await r.json();
  return data.accounts || data.data || [];
}

export default authedPost(async ({ body }) => {
  const lateApiKey = process.env.LATE_API_KEY;
  if (!lateApiKey) throw new Error('LATE_API_KEY not configured');

  const { clientId, period = 7 } = body;
  if (!clientId) throw new Error('clientId required');

  const credentials = await query<any>(
    `SELECT metadata, platform FROM client_social_credentials
     WHERE client_id = $1 AND metadata->>'late_profile_id' IS NOT NULL`,
    [clientId]
  );
  if (!credentials || credentials.length === 0) {
    return { success: true, platforms: {}, message: 'No Late profile connected' };
  }

  const profileIds = [...new Set(credentials.map((c) => (c.metadata as any)?.late_profile_id).filter(Boolean))] as string[];

  const today = new Date().toISOString().split('T')[0];
  const fromDate7d = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const fromDate30d = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

  const platforms: Record<string, any> = {};
  const supportedPlatforms = ['instagram', 'twitter', 'linkedin', 'tiktok', 'youtube', 'threads'];

  for (const profileId of profileIds) {
    const followerData = await fetchFollowerStats(profileId, lateApiKey, fromDate30d, today);

    for (const platform of supportedPlatforms) {
      const fromDate = period === 30 ? fromDate30d : fromDate7d;
      const analyticsResult = await fetchAnalytics(profileId, lateApiKey, platform, fromDate, today);
      if (analyticsResult.error === 'ANALYTICS_ADDON_REQUIRED') continue;

      const posts = analyticsResult.posts || [];
      if (posts.length === 0 && !followerData.find((f: any) => f.platform?.toLowerCase() === platform)) continue;

      let totalImpressions = 0, totalLikes = 0, totalComments = 0, totalShares = 0, totalReach = 0;
      const engagementRates: number[] = [];

      const recentPosts = posts.map((p: any) => {
        totalImpressions += p.impressions || 0;
        totalLikes += p.likes || 0;
        totalComments += p.comments || 0;
        totalShares += p.shares || 0;
        totalReach += p.reach || 0;
        if (p.engagementRate) engagementRates.push(p.engagementRate);
        return {
          id: p.id || p.externalId,
          content: (p.content || '').substring(0, 200),
          publishedAt: p.publishedAt,
          url: p.platformPostUrl || '',
          metrics: {
            impressions: p.impressions || 0,
            reach: p.reach || 0,
            likes: p.likes || 0,
            comments: p.comments || 0,
            shares: p.shares || 0,
            engagementRate: p.engagementRate || 0,
          },
        };
      }).sort((a: any, b: any) => (b.metrics.engagementRate || 0) - (a.metrics.engagementRate || 0)).slice(0, 10);

      const platformFollower = followerData.find((f: any) => f.platform?.toLowerCase() === platform);
      const followerStats = { current: 0, change7d: 0, change30d: 0, history: [] as any[] };
      if (platformFollower?.stats) {
        const statsDates = Object.keys(platformFollower.stats).sort();
        const latestDate = statsDates[statsDates.length - 1];
        const date7dAgo = statsDates.find((d: string) => d >= fromDate7d) || statsDates[0];
        followerStats.current = platformFollower.stats[latestDate]?.followers || 0;
        followerStats.change30d = followerStats.current - (platformFollower.stats[statsDates[0]]?.followers || followerStats.current);
        followerStats.change7d = followerStats.current - (platformFollower.stats[date7dAgo]?.followers || followerStats.current);
        followerStats.history = statsDates.slice(-30).map((d: string) => ({ date: d, followers: platformFollower.stats[d]?.followers || 0 }));
      }

      const avgEngagement = engagementRates.length > 0 ? engagementRates.reduce((a, b) => a + b, 0) / engagementRates.length : 0;

      if (platforms[platform]) {
        platforms[platform].recentPosts.push(...recentPosts);
        platforms[platform].aggregates.totalImpressions += totalImpressions;
        platforms[platform].aggregates.totalLikes += totalLikes;
        platforms[platform].aggregates.totalReach += totalReach;
      } else {
        platforms[platform] = {
          followerStats,
          recentPosts,
          aggregates: {
            avgEngagementRate: Math.round(avgEngagement * 100) / 100,
            totalImpressions,
            totalLikes,
            totalComments,
            totalShares,
            totalReach,
            postsCount: posts.length,
          },
        };
      }
    }
  }

  return { success: true, lastSyncedAt: new Date().toISOString(), platforms };
});
