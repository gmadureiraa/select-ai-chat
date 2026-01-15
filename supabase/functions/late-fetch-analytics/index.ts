import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LATE_API_BASE = "https://getlate.dev/api";

interface LateAnalyticsPost {
  _id: string;
  platform: string;
  platformPostId?: string;
  platformPostUrl?: string;
  content?: string;
  publishedAt?: string;
  analytics?: {
    likes?: number;
    comments?: number;
    shares?: number;
    impressions?: number;
    reach?: number;
    clicks?: number;
    saves?: number;
    views?: number;
    engagementRate?: number;
  };
}

interface LateFollowerStats {
  date: string;
  followers: number;
  followersGained?: number;
  followersLost?: number;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LATE_API_KEY = Deno.env.get("LATE_API_KEY");
    if (!LATE_API_KEY) {
      return new Response(JSON.stringify({ error: "LATE_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { clientId, platform, daysBack = 30, postId } = await req.json();

    if (!clientId) {
      return new Response(JSON.stringify({ error: "clientId é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Fetching Late analytics for:", { clientId, platform, daysBack, postId });

    // Get Late credentials for this client
    const { data: credentials, error: credError } = await supabase
      .from("client_social_credentials")
      .select("*")
      .eq("client_id", clientId)
      .eq("is_valid", true);

    if (credError) {
      console.error("Error fetching credentials:", credError);
      throw credError;
    }

    if (!credentials || credentials.length === 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: "Nenhuma conta conectada encontrada",
        syncedPosts: 0,
        syncedMetrics: 0,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the Late profile ID from credentials
    const lateProfileCredential = credentials.find(c => {
      const meta = c.metadata as Record<string, unknown> | null;
      return meta?.late_profile_id;
    });

    const lateProfileId = lateProfileCredential?.metadata?.late_profile_id as string | undefined;
    
    if (!lateProfileId) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: "Profile ID do Late não encontrado",
        syncedPosts: 0,
        syncedMetrics: 0,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Found Late profile ID:", lateProfileId);

    const results = {
      syncedPosts: 0,
      syncedMetrics: 0,
      platforms: [] as string[],
      errors: [] as string[],
    };

    // Calculate date range
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - daysBack);

    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    // Filter platforms if specified
    const platformsToSync = platform 
      ? [platform] 
      : ['instagram', 'twitter', 'linkedin', 'threads', 'facebook', 'tiktok'];

    for (const cred of credentials) {
      const credPlatform = cred.platform;
      
      // Skip if platform filter is specified and doesn't match
      if (platform && credPlatform !== platform) continue;
      if (!platformsToSync.includes(credPlatform)) continue;
      
      const lateAccountId = cred.account_id || (cred.metadata as Record<string, unknown>)?.late_account_id;
      
      if (!lateAccountId) {
        console.log(`No Late account ID for ${credPlatform}, skipping`);
        continue;
      }

      console.log(`Fetching analytics for ${credPlatform} (account: ${lateAccountId})`);

      try {
        // Fetch posts with analytics from Late API
        const analyticsUrl = `${LATE_API_BASE}/v1/posts?accountId=${lateAccountId}&fromDate=${formatDate(fromDate)}&toDate=${formatDate(toDate)}&includeAnalytics=true`;
        
        console.log("Fetching from:", analyticsUrl);
        
        const analyticsResponse = await fetch(analyticsUrl, {
          headers: {
            "Authorization": `Bearer ${LATE_API_KEY}`,
            "Content-Type": "application/json",
          },
        });

        if (!analyticsResponse.ok) {
          const errorText = await analyticsResponse.text();
          console.error(`Late API error for ${credPlatform}:`, errorText);
          results.errors.push(`${credPlatform}: ${errorText}`);
          continue;
        }

        const analyticsData = await analyticsResponse.json();
        const posts: LateAnalyticsPost[] = analyticsData.posts || [];
        
        console.log(`Found ${posts.length} posts for ${credPlatform}`);

        // Upsert posts to respective tables
        for (const post of posts) {
          if (!post.platformPostId && !post.platformPostUrl) continue;
          
          const postData = {
            client_id: clientId,
            post_id: post.platformPostId || post._id,
            content: post.content?.substring(0, 5000),
            posted_at: post.publishedAt,
            likes: post.analytics?.likes,
            comments: post.analytics?.comments,
            shares: post.analytics?.shares,
            impressions: post.analytics?.impressions,
            reach: post.analytics?.reach,
            engagement_rate: post.analytics?.engagementRate,
            updated_at: new Date().toISOString(),
            metadata: {
              late_post_id: post._id,
              synced_from_late: true,
              last_synced_at: new Date().toISOString(),
            },
          };

          let tableName: string;
          let extraFields: Record<string, unknown> = {};

          switch (credPlatform) {
            case 'instagram':
              tableName = 'instagram_posts';
              extraFields = {
                caption: post.content,
                saves: post.analytics?.saves,
                permalink: post.platformPostUrl,
              };
              break;
            case 'twitter':
              tableName = 'twitter_posts';
              extraFields = {
                text: post.content,
                retweets: post.analytics?.shares,
                replies: post.analytics?.comments,
                tweet_url: post.platformPostUrl,
              };
              break;
            case 'linkedin':
              tableName = 'linkedin_posts';
              extraFields = {
                content: post.content,
                clicks: post.analytics?.clicks,
                post_url: post.platformPostUrl,
                engagements: (post.analytics?.likes || 0) + (post.analytics?.comments || 0) + (post.analytics?.shares || 0),
              };
              break;
            default:
              continue; // Skip unsupported platforms for now
          }

          const { error: upsertError } = await supabase
            .from(tableName)
            .upsert({
              ...postData,
              ...extraFields,
            }, {
              onConflict: "client_id,post_id",
              ignoreDuplicates: false,
            });

          if (upsertError) {
            console.error(`Error upserting post to ${tableName}:`, upsertError);
          } else {
            results.syncedPosts++;
          }
        }

        // Try to fetch follower stats
        try {
          const followerStatsUrl = `${LATE_API_BASE}/v1/accounts/${lateAccountId}/follower-stats?granularity=daily&fromDate=${formatDate(fromDate)}&toDate=${formatDate(toDate)}`;
          
          const followerResponse = await fetch(followerStatsUrl, {
            headers: {
              "Authorization": `Bearer ${LATE_API_KEY}`,
              "Content-Type": "application/json",
            },
          });

          if (followerResponse.ok) {
            const followerData = await followerResponse.json();
            const stats: LateFollowerStats[] = followerData.stats || [];
            
            console.log(`Found ${stats.length} days of follower stats for ${credPlatform}`);

            for (const stat of stats) {
              const metricData = {
                client_id: clientId,
                platform: credPlatform,
                metric_date: stat.date,
                subscribers: stat.followersGained || 0,
                updated_at: new Date().toISOString(),
                metadata: {
                  total_followers: stat.followers,
                  followers_lost: stat.followersLost,
                  synced_from_late: true,
                  last_synced_at: new Date().toISOString(),
                },
              };

              const { error: metricError } = await supabase
                .from("platform_metrics")
                .upsert(metricData, {
                  onConflict: "client_id,platform,metric_date",
                  ignoreDuplicates: false,
                });

              if (!metricError) {
                results.syncedMetrics++;
              }
            }
          } else {
            console.log(`Follower stats not available for ${credPlatform} (this is normal for some platforms)`);
          }
        } catch (followerError) {
          console.log(`Could not fetch follower stats for ${credPlatform}:`, followerError);
        }

        results.platforms.push(credPlatform);

      } catch (platformError) {
        console.error(`Error syncing ${credPlatform}:`, platformError);
        results.errors.push(`${credPlatform}: ${platformError instanceof Error ? platformError.message : 'Unknown error'}`);
      }
    }

    // Update last sync timestamp in client credentials
    for (const cred of credentials) {
      if (results.platforms.includes(cred.platform)) {
        const existingMeta = (cred.metadata as Record<string, unknown>) || {};
        await supabase
          .from("client_social_credentials")
          .update({
            metadata: {
              ...existingMeta,
              last_analytics_sync: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", cred.id);
      }
    }

    console.log("Sync complete:", results);

    return new Response(JSON.stringify({
      success: true,
      ...results,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in late-fetch-analytics:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Erro desconhecido",
      success: false,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
