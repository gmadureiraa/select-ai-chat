import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LATE_API_BASE = "https://getlate.dev/api/v1";

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
  postsUpdated: {
    instagram: number;
    twitter: number;
    linkedin: number;
  };
  postsCreated: {
    instagram: number;
    twitter: number;
    linkedin: number;
  };
  metricsUpdated: number;
  errors: string[];
}

// Extract stable post ID from platform URL or use externalId
function extractStablePostId(platform: string, post: LateAnalyticsPost): string | null {
  // Prefer externalId if available
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

// Fetch analytics from Late API with retry
async function fetchLateAnalytics(
  profileId: string, 
  lateApiKey: string, 
  options?: { platform?: string; fromDate?: string; toDate?: string; page?: number }
): Promise<{ posts: LateAnalyticsPost[]; hasMore: boolean }> {
  const params = new URLSearchParams({ profileId, limit: '100' });
  if (options?.platform) params.set('platform', options.platform);
  if (options?.fromDate) params.set('fromDate', options.fromDate);
  if (options?.toDate) params.set('toDate', options.toDate);
  if (options?.page) params.set('page', options.page.toString());
  
  const response = await fetch(`${LATE_API_BASE}/analytics?${params}`, {
    headers: { Authorization: `Bearer ${lateApiKey}` }
  });
  
  if (response.status === 402) {
    throw new Error('ANALYTICS_ADDON_REQUIRED');
  }
  
  if (response.status === 404) {
    console.log(`Profile ${profileId} not found in Late`);
    return { posts: [], hasMore: false };
  }
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Late API error ${response.status}: ${text}`);
  }
  
  const data = await response.json();
  return {
    posts: data.posts || data.data || [],
    hasMore: data.hasMore || false
  };
}

// Fetch follower stats from Late API
async function fetchFollowerStats(
  profileId: string,
  lateApiKey: string,
  options?: { fromDate?: string; toDate?: string; granularity?: string }
): Promise<LateFollowerStats[]> {
  const params = new URLSearchParams({ profileId, granularity: options?.granularity || 'daily' });
  if (options?.fromDate) params.set('fromDate', options.fromDate);
  if (options?.toDate) params.set('toDate', options.toDate);
  
  const response = await fetch(`${LATE_API_BASE}/accounts/follower-stats?${params}`, {
    headers: { Authorization: `Bearer ${lateApiKey}` }
  });
  
  if (response.status === 402) {
    throw new Error('ANALYTICS_ADDON_REQUIRED');
  }
  
  if (response.status === 404) {
    console.log(`Follower stats not found for profile ${profileId}`);
    return [];
  }
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Late API follower-stats error ${response.status}: ${text}`);
  }
  
  const data = await response.json();
  return data.accounts || data.data || [];
}

// Sync Instagram posts with URL-based deduplication
async function syncInstagramPosts(
  supabase: any,
  clientId: string,
  posts: LateAnalyticsPost[]
): Promise<{ updated: number; created: number; errors: string[] }> {
  let updated = 0;
  let created = 0;
  const errors: string[] = [];

  for (const post of posts) {
    const permalink = post.platformPostUrl;
    if (!permalink) continue;

    try {
      // Check if post exists by permalink (use limit(1) to handle duplicates gracefully)
      const { data: existingList, error: fetchError } = await supabase
        .from('instagram_posts')
        .select('id, likes, impressions, reach, comments, shares, engagement_rate, metadata')
        .eq('client_id', clientId)
        .eq('permalink', permalink)
        .order('likes', { ascending: false, nullsFirst: false })
        .limit(1);
      
      const existing = existingList?.[0] || null;

      if (fetchError) {
        console.error(`[fetch-late-metrics] Error fetching Instagram post:`, fetchError);
        errors.push(`Instagram fetch: ${fetchError.message}`);
        continue;
      }

      if (existing) {
        // Post exists - update metrics only if new values are greater
        const updates: Record<string, any> = { 
          updated_at: new Date().toISOString(),
          metadata: {
            ...(existing.metadata || {}),
            late_post_id: post.id,
            late_synced_at: new Date().toISOString()
          }
        };

        // Only update if Late has better data
        if (post.likes && post.likes > (existing.likes || 0)) updates.likes = post.likes;
        if (post.impressions && post.impressions > (existing.impressions || 0)) updates.impressions = post.impressions;
        if (post.reach && post.reach > (existing.reach || 0)) updates.reach = post.reach;
        if (post.comments && post.comments > (existing.comments || 0)) updates.comments = post.comments;
        if (post.shares && post.shares > (existing.shares || 0)) updates.shares = post.shares;
        if (post.engagementRate && post.engagementRate > (existing.engagement_rate || 0)) {
          updates.engagement_rate = post.engagementRate;
        }

        const { error: updateError } = await supabase
          .from('instagram_posts')
          .update(updates)
          .eq('id', existing.id);

        if (updateError) {
          console.error(`[fetch-late-metrics] Error updating Instagram post:`, updateError);
          errors.push(`Instagram update: ${updateError.message}`);
        } else {
          updated++;
        }
      } else {
        // Post doesn't exist - insert new
        const { error: insertError } = await supabase
          .from('instagram_posts')
          .insert({
            client_id: clientId,
            post_id: extractStablePostId('instagram', post),
            permalink,
            caption: post.content || null,
            likes: post.likes || 0,
            comments: post.comments || 0,
            impressions: post.impressions || 0,
            reach: post.reach || 0,
            shares: post.shares || 0,
            engagement_rate: post.engagementRate || 0,
            posted_at: post.publishedAt || null,
            metadata: { late_post_id: post.id, late_synced_at: new Date().toISOString() }
          });

        if (insertError) {
          console.error(`[fetch-late-metrics] Error inserting Instagram post:`, insertError);
          errors.push(`Instagram insert: ${insertError.message}`);
        } else {
          created++;
        }
      }
    } catch (err: any) {
      console.error(`[fetch-late-metrics] Exception syncing Instagram post:`, err);
      errors.push(`Instagram exception: ${err.message}`);
    }
  }

  return { updated, created, errors };
}

// Sync Twitter posts with URL-based deduplication
async function syncTwitterPosts(
  supabase: any,
  clientId: string,
  posts: LateAnalyticsPost[]
): Promise<{ updated: number; created: number; errors: string[] }> {
  let updated = 0;
  let created = 0;
  const errors: string[] = [];

  for (const post of posts) {
    const tweetUrl = post.platformPostUrl;
    const tweetId = extractStablePostId('twitter', post);
    if (!tweetId) continue;

    try {
      // Check if post exists by tweet_id (Twitter uses tweet_id as primary identifier)
      // Also check by URL if available
      let existing = null;
      
      if (tweetUrl) {
        // Try to find by URL pattern in metadata or by tweet_id
        const { data, error } = await supabase
          .from('twitter_posts')
          .select('id, tweet_id, likes, impressions, retweets, replies, engagement_rate, metadata')
          .eq('client_id', clientId)
          .eq('tweet_id', tweetId)
          .maybeSingle();
        
        if (!error) existing = data;
      }

      if (existing) {
        // Post exists - update metrics only if new values are greater
        const updates: Record<string, any> = { 
          updated_at: new Date().toISOString(),
          metadata: {
            ...(existing.metadata || {}),
            late_post_id: post.id,
            late_synced_at: new Date().toISOString(),
            tweet_url: tweetUrl
          }
        };

        if (post.likes && post.likes > (existing.likes || 0)) updates.likes = post.likes;
        if (post.impressions && post.impressions > (existing.impressions || 0)) updates.impressions = post.impressions;
        if (post.shares && post.shares > (existing.retweets || 0)) updates.retweets = post.shares;
        if (post.comments && post.comments > (existing.replies || 0)) updates.replies = post.comments;
        if (post.engagementRate && post.engagementRate > (existing.engagement_rate || 0)) {
          updates.engagement_rate = post.engagementRate;
        }

        const { error: updateError } = await supabase
          .from('twitter_posts')
          .update(updates)
          .eq('id', existing.id);

        if (updateError) {
          errors.push(`Twitter update: ${updateError.message}`);
        } else {
          updated++;
        }
      } else {
        // Post doesn't exist - insert new
        const { error: insertError } = await supabase
          .from('twitter_posts')
          .insert({
            client_id: clientId,
            tweet_id: tweetId,
            content: post.content || null,
            likes: post.likes || 0,
            impressions: post.impressions || 0,
            retweets: post.shares || 0,
            replies: post.comments || 0,
            engagement_rate: post.engagementRate || 0,
            posted_at: post.publishedAt || null,
            metadata: { 
              late_post_id: post.id, 
              late_synced_at: new Date().toISOString(),
              tweet_url: tweetUrl
            }
          });

        if (insertError) {
          errors.push(`Twitter insert: ${insertError.message}`);
        } else {
          created++;
        }
      }
    } catch (err: any) {
      errors.push(`Twitter exception: ${err.message}`);
    }
  }

  return { updated, created, errors };
}

// Sync LinkedIn posts with URL-based deduplication
async function syncLinkedInPosts(
  supabase: any,
  clientId: string,
  posts: LateAnalyticsPost[]
): Promise<{ updated: number; created: number; errors: string[] }> {
  let updated = 0;
  let created = 0;
  const errors: string[] = [];

  for (const post of posts) {
    const postUrl = post.platformPostUrl;
    if (!postUrl) continue;

    try {
      // Check if post exists by post_url (use limit(1) to handle duplicates gracefully)
      const { data: existingList, error: fetchError } = await supabase
        .from('linkedin_posts')
        .select('id, post_id, likes, impressions, comments, shares, clicks, engagement_rate, metadata')
        .eq('client_id', clientId)
        .eq('post_url', postUrl)
        .order('likes', { ascending: false, nullsFirst: false })
        .limit(1);
      
      const existing = existingList?.[0] || null;

      if (fetchError) {
        errors.push(`LinkedIn fetch: ${fetchError.message}`);
        continue;
      }

      if (existing) {
        // Post exists - update metrics only if new values are greater
        const updates: Record<string, any> = { 
          updated_at: new Date().toISOString(),
          metadata: {
            ...(existing.metadata || {}),
            late_post_id: post.id,
            late_synced_at: new Date().toISOString()
          }
        };

        if (post.likes && post.likes > (existing.likes || 0)) updates.likes = post.likes;
        if (post.impressions && post.impressions > (existing.impressions || 0)) updates.impressions = post.impressions;
        if (post.comments && post.comments > (existing.comments || 0)) updates.comments = post.comments;
        if (post.shares && post.shares > (existing.shares || 0)) updates.shares = post.shares;
        if (post.clicks && post.clicks > (existing.clicks || 0)) updates.clicks = post.clicks;
        if (post.engagementRate && post.engagementRate > (existing.engagement_rate || 0)) {
          updates.engagement_rate = post.engagementRate;
        }

        const { error: updateError } = await supabase
          .from('linkedin_posts')
          .update(updates)
          .eq('id', existing.id);

        if (updateError) {
          errors.push(`LinkedIn update: ${updateError.message}`);
        } else {
          updated++;
        }
      } else {
        // Post doesn't exist - insert new
        const { error: insertError } = await supabase
          .from('linkedin_posts')
          .insert({
            client_id: clientId,
            post_id: extractStablePostId('linkedin', post) || post.id,
            post_url: postUrl,
            content: post.content || null,
            likes: post.likes || 0,
            impressions: post.impressions || 0,
            comments: post.comments || 0,
            shares: post.shares || 0,
            clicks: post.clicks || 0,
            engagement_rate: post.engagementRate || 0,
            posted_at: post.publishedAt || null,
            metadata: { late_post_id: post.id, late_synced_at: new Date().toISOString() }
          });

        if (insertError) {
          errors.push(`LinkedIn insert: ${insertError.message}`);
        } else {
          created++;
        }
      }
    } catch (err: any) {
      errors.push(`LinkedIn exception: ${err.message}`);
    }
  }

  return { updated, created, errors };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  const startTime = Date.now();
  console.log('[fetch-late-metrics] Starting...');
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lateApiKey = Deno.env.get('LATE_API_KEY');
    
    if (!lateApiKey) {
      throw new Error('LATE_API_KEY not configured');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Parse optional clientId from body
    let targetClientId: string | undefined;
    try {
      const body = await req.json();
      targetClientId = body?.clientId;
    } catch {
      // No body or invalid JSON - process all clients
    }
    
    // Get clients with Late connected (have late_profile_id in metadata)
    let query = supabase
      .from('client_social_credentials')
      .select('client_id, metadata, clients!inner(id, name)')
      .not('metadata->late_profile_id', 'is', null);
    
    if (targetClientId) {
      query = query.eq('client_id', targetClientId);
    }
    
    const { data: credentials, error: credError } = await query;
    
    if (credError) {
      console.error('[fetch-late-metrics] Error fetching credentials:', credError);
      throw credError;
    }
    
    if (!credentials || credentials.length === 0) {
      console.log('[fetch-late-metrics] No clients with Late connected');
      return new Response(JSON.stringify({
        success: true,
        message: 'No clients with Late connected',
        clientsProcessed: 0,
        duration: Date.now() - startTime
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    // Group by client and get unique profile IDs
    const clientProfileMap = new Map<string, { clientId: string; clientName: string; profileIds: Set<string> }>();
    
    for (const cred of credentials) {
      const clientId = cred.client_id;
      const clientName = (cred.clients as any)?.name || 'Unknown';
      const profileId = (cred.metadata as any)?.late_profile_id;
      
      if (!profileId) continue;
      
      if (!clientProfileMap.has(clientId)) {
        clientProfileMap.set(clientId, { clientId, clientName, profileIds: new Set() });
      }
      clientProfileMap.get(clientId)!.profileIds.add(profileId);
    }
    
    console.log(`[fetch-late-metrics] Processing ${clientProfileMap.size} clients`);
    
    const results: ProcessingResult[] = [];
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 90); // Last 90 days
    const fromDateStr = fromDate.toISOString().split('T')[0];
    const toDateStr = new Date().toISOString().split('T')[0];
    
    // Process each client
    for (const [clientId, clientData] of clientProfileMap) {
      const result: ProcessingResult = {
        clientId,
        clientName: clientData.clientName,
        postsUpdated: { instagram: 0, twitter: 0, linkedin: 0 },
        postsCreated: { instagram: 0, twitter: 0, linkedin: 0 },
        metricsUpdated: 0,
        errors: []
      };
      
      for (const profileId of clientData.profileIds) {
        console.log(`[fetch-late-metrics] Processing profile ${profileId} for client ${clientData.clientName}`);
        
        try {
          // 1. Fetch and upsert follower stats
          const followerStats = await fetchFollowerStats(profileId, lateApiKey, {
            fromDate: fromDateStr,
            toDate: toDateStr,
            granularity: 'daily'
          });
          
          for (const account of followerStats) {
            const platform = account.platform?.toLowerCase();
            if (!platform || !account.stats) continue;
            
            const metricsToUpsert = Object.entries(account.stats).map(([date, data]) => ({
              client_id: clientId,
              platform,
              metric_date: date,
              subscribers: data.followers || 0,
              updated_at: new Date().toISOString()
            }));
            
            if (metricsToUpsert.length > 0) {
              const { error: metricsError } = await supabase
                .from('platform_metrics')
                .upsert(metricsToUpsert, { 
                  onConflict: 'client_id,platform,metric_date',
                  ignoreDuplicates: false 
                });
              
              if (metricsError) {
                console.error(`[fetch-late-metrics] Error upserting metrics:`, metricsError);
                result.errors.push(`Metrics upsert error: ${metricsError.message}`);
              } else {
                result.metricsUpdated += metricsToUpsert.length;
              }
            }
          }
          
          // 2. Fetch post analytics
          let page = 1;
          let hasMore = true;
          
          while (hasMore) {
            const { posts, hasMore: more } = await fetchLateAnalytics(profileId, lateApiKey, {
              fromDate: fromDateStr,
              toDate: toDateStr,
              page
            });
            
            hasMore = more;
            page++;
            
            if (posts.length === 0) break;
            
            // Group posts by platform
            const instagramPosts: LateAnalyticsPost[] = [];
            const twitterPosts: LateAnalyticsPost[] = [];
            const linkedinPosts: LateAnalyticsPost[] = [];
            
            for (const post of posts) {
              const platform = post.platform?.toLowerCase();
              switch (platform) {
                case 'instagram':
                  instagramPosts.push(post);
                  break;
                case 'twitter':
                case 'x':
                  twitterPosts.push(post);
                  break;
                case 'linkedin':
                  linkedinPosts.push(post);
                  break;
              }
            }
            
            // Sync each platform with URL-based deduplication
            if (instagramPosts.length > 0) {
              const igResult = await syncInstagramPosts(supabase, clientId, instagramPosts);
              result.postsUpdated.instagram += igResult.updated;
              result.postsCreated.instagram += igResult.created;
              result.errors.push(...igResult.errors);
            }
            
            if (twitterPosts.length > 0) {
              const twResult = await syncTwitterPosts(supabase, clientId, twitterPosts);
              result.postsUpdated.twitter += twResult.updated;
              result.postsCreated.twitter += twResult.created;
              result.errors.push(...twResult.errors);
            }
            
            if (linkedinPosts.length > 0) {
              const liResult = await syncLinkedInPosts(supabase, clientId, linkedinPosts);
              result.postsUpdated.linkedin += liResult.updated;
              result.postsCreated.linkedin += liResult.created;
              result.errors.push(...liResult.errors);
            }
            
            // Stop if no more pages
            if (posts.length < 100) break;
          }
          
        } catch (error: any) {
          console.error(`[fetch-late-metrics] Error processing profile ${profileId}:`, error);
          
          if (error.message === 'ANALYTICS_ADDON_REQUIRED') {
            result.errors.push(`Profile ${profileId}: Analytics add-on required`);
          } else {
            result.errors.push(`Profile ${profileId}: ${error.message}`);
          }
        }
      }
      
      results.push(result);
      console.log(`[fetch-late-metrics] Client ${clientData.clientName}: updated=${JSON.stringify(result.postsUpdated)}, created=${JSON.stringify(result.postsCreated)}, metrics=${result.metricsUpdated}`);
    }
    
    const duration = Date.now() - startTime;
    const totalUpdated = results.reduce((sum, r) => 
      sum + r.postsUpdated.instagram + r.postsUpdated.twitter + r.postsUpdated.linkedin, 0);
    const totalCreated = results.reduce((sum, r) => 
      sum + r.postsCreated.instagram + r.postsCreated.twitter + r.postsCreated.linkedin, 0);
    const totalMetrics = results.reduce((sum, r) => sum + r.metricsUpdated, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
    
    console.log(`[fetch-late-metrics] Completed in ${duration}ms. Updated: ${totalUpdated}, Created: ${totalCreated}, Metrics: ${totalMetrics}, Errors: ${totalErrors}`);
    
    return new Response(JSON.stringify({
      success: true,
      clientsProcessed: results.length,
      totalPostsUpdated: totalUpdated,
      totalPostsCreated: totalCreated,
      totalMetricsUpdated: totalMetrics,
      totalErrors,
      duration,
      results
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    
  } catch (error: any) {
    console.error('[fetch-late-metrics] Fatal error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      duration: Date.now() - startTime
    }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
