import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const LATE_API_BASE = "https://getlate.dev/api/v1";

async function fetchAnalytics(profileId: string, apiKey: string, platform: string, fromDate: string, toDate: string) {
  const params = new URLSearchParams({ profileId, platform, fromDate, toDate, limit: '50' });
  const res = await fetch(`${LATE_API_BASE}/analytics?${params}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    if (res.status === 402) return { posts: [], error: 'ANALYTICS_ADDON_REQUIRED' };
    if (res.status === 404) return { posts: [] };
    return { posts: [], error: `API error ${res.status}` };
  }
  const data = await res.json();
  return { posts: data.posts || data.data || [] };
}

async function fetchFollowerStats(profileId: string, apiKey: string, fromDate: string, toDate: string) {
  const params = new URLSearchParams({ profileId, granularity: 'daily', fromDate, toDate });
  const res = await fetch(`${LATE_API_BASE}/accounts/follower-stats?${params}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.accounts || data.data || [];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lateApiKey = Deno.env.get("LATE_API_KEY");

    if (!lateApiKey) {
      return new Response(JSON.stringify({ error: "LATE_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate user
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader || "" } },
    });
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { clientId, period = 7 } = await req.json();
    if (!clientId) {
      return new Response(JSON.stringify({ error: "clientId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get late_profile_id from client_social_credentials
    const { data: credentials } = await supabase
      .from('client_social_credentials')
      .select('metadata, platform')
      .eq('client_id', clientId)
      .not('metadata->late_profile_id', 'is', null);

    if (!credentials || credentials.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        platforms: {}, 
        message: "No Late profile connected" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get unique profile IDs
    const profileIds = [...new Set(
      credentials.map(c => (c.metadata as any)?.late_profile_id).filter(Boolean)
    )] as string[];

    const today = new Date().toISOString().split('T')[0];
    const fromDate7d = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const fromDate30d = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

    const platforms: Record<string, any> = {};
    const supportedPlatforms = ['instagram', 'twitter', 'linkedin', 'tiktok', 'youtube', 'threads'];

    for (const profileId of profileIds) {
      // Fetch follower stats (30d)
      const followerData = await fetchFollowerStats(profileId, lateApiKey, fromDate30d, today);

      for (const platform of supportedPlatforms) {
        // Fetch analytics posts (7d or custom period)
        const fromDate = period === 30 ? fromDate30d : fromDate7d;
        const analyticsResult = await fetchAnalytics(profileId, lateApiKey, platform, fromDate, today);

        if (analyticsResult.error === 'ANALYTICS_ADDON_REQUIRED') {
          continue;
        }

        const posts = analyticsResult.posts || [];
        if (posts.length === 0 && !followerData.find((f: any) => f.platform?.toLowerCase() === platform)) {
          continue;
        }

        // Calculate aggregates
        let totalImpressions = 0, totalLikes = 0, totalComments = 0, totalShares = 0, totalReach = 0;
        let engagementRates: number[] = [];

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
        }).sort((a: any, b: any) => (b.metrics.engagementRate || 0) - (a.metrics.engagementRate || 0))
          .slice(0, 10);

        // Follower stats for this platform
        const platformFollower = followerData.find((f: any) => 
          f.platform?.toLowerCase() === platform
        );

        let followerStats = { current: 0, change7d: 0, change30d: 0, history: [] as any[] };
        if (platformFollower?.stats) {
          const statsDates = Object.keys(platformFollower.stats).sort();
          const latestDate = statsDates[statsDates.length - 1];
          const date7dAgo = statsDates.find((d: string) => d >= fromDate7d) || statsDates[0];
          
          followerStats.current = platformFollower.stats[latestDate]?.followers || 0;
          followerStats.change30d = followerStats.current - (platformFollower.stats[statsDates[0]]?.followers || followerStats.current);
          followerStats.change7d = followerStats.current - (platformFollower.stats[date7dAgo]?.followers || followerStats.current);
          
          // Last 30 days history for sparkline
          followerStats.history = statsDates.slice(-30).map((d: string) => ({
            date: d,
            followers: platformFollower.stats[d]?.followers || 0,
          }));
        }

        const avgEngagement = engagementRates.length > 0 
          ? engagementRates.reduce((a, b) => a + b, 0) / engagementRates.length 
          : 0;

        if (platforms[platform]) {
          // Merge data from multiple profiles
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

    return new Response(JSON.stringify({
      success: true,
      lastSyncedAt: new Date().toISOString(),
      platforms,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[late-analytics] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
