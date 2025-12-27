import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InstagramInsight {
  name: string;
  period: string;
  values: Array<{ value: number; end_time?: string }>;
  title: string;
  description: string;
  id: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('User not authenticated');
    }

    const { clientId } = await req.json();
    if (!clientId) {
      throw new Error('clientId is required');
    }

    // Get Instagram tokens for this client
    const { data: tokenData, error: tokenError } = await supabase
      .from('instagram_tokens')
      .select('*')
      .eq('client_id', clientId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (tokenError) {
      throw new Error('Error fetching Instagram credentials');
    }

    if (!tokenData) {
      return new Response(
        JSON.stringify({ needsAuth: true, message: 'Instagram not connected' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if token is expired
    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ needsAuth: true, message: 'Instagram token expired' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accessToken = tokenData.access_token;
    const instagramId = tokenData.instagram_business_id;

    console.log('Fetching Instagram metrics for:', tokenData.instagram_username);

    // Fetch basic profile info
    const profileResponse = await fetch(
      `https://graph.facebook.com/v18.0/${instagramId}?fields=followers_count,media_count,username,name&access_token=${accessToken}`
    );
    const profileData = await profileResponse.json();

    if (profileData.error) {
      console.error('Graph API error:', profileData.error);
      throw new Error(profileData.error.message || 'Failed to fetch Instagram profile');
    }

    // Fetch insights (last 30 days)
    const insightsMetrics = [
      'impressions',
      'reach',
      'profile_views',
      'website_clicks',
      'follower_count'
    ].join(',');

    const insightsResponse = await fetch(
      `https://graph.facebook.com/v18.0/${instagramId}/insights?metric=${insightsMetrics}&period=day&access_token=${accessToken}`
    );
    const insightsData = await insightsResponse.json();

    // Fetch recent media for engagement calculation
    const mediaResponse = await fetch(
      `https://graph.facebook.com/v18.0/${instagramId}/media?fields=id,timestamp,like_count,comments_count,media_type,caption,permalink,thumbnail_url,media_url&limit=25&access_token=${accessToken}`
    );
    const mediaData = await mediaResponse.json();

    // Calculate aggregated metrics
    let totalLikes = 0;
    let totalComments = 0;
    let postCount = 0;

    const recentPosts = [];
    for (const media of mediaData.data || []) {
      totalLikes += media.like_count || 0;
      totalComments += media.comments_count || 0;
      postCount++;

      recentPosts.push({
        post_id: media.id,
        caption: media.caption?.substring(0, 500),
        post_type: media.media_type?.toLowerCase(),
        permalink: media.permalink,
        thumbnail_url: media.thumbnail_url || media.media_url,
        likes: media.like_count || 0,
        comments: media.comments_count || 0,
        posted_at: media.timestamp
      });
    }

    // Calculate engagement rate
    const followers = profileData.followers_count || 1;
    const avgEngagement = postCount > 0 
      ? ((totalLikes + totalComments) / postCount / followers) * 100 
      : 0;

    // Process insights data
    let impressions = 0;
    let reach = 0;
    let profileViews = 0;

    if (insightsData.data) {
      for (const insight of insightsData.data as InstagramInsight[]) {
        const totalValue = insight.values?.reduce((sum, v) => sum + (v.value || 0), 0) || 0;
        
        switch (insight.name) {
          case 'impressions':
            impressions = totalValue;
            break;
          case 'reach':
            reach = totalValue;
            break;
          case 'profile_views':
            profileViews = totalValue;
            break;
        }
      }
    }

    // Save metrics to platform_metrics table
    const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey);
    const today = new Date().toISOString().split('T')[0];

    const { error: metricsError } = await serviceSupabase
      .from('platform_metrics')
      .upsert({
        client_id: clientId,
        platform: 'instagram',
        metric_date: today,
        subscribers: followers,
        views: impressions,
        likes: totalLikes,
        comments: totalComments,
        engagement_rate: parseFloat(avgEngagement.toFixed(2)),
        total_posts: profileData.media_count,
        metadata: {
          reach,
          profile_views: profileViews,
          username: tokenData.instagram_username,
          fetched_via: 'oauth'
        }
      }, {
        onConflict: 'client_id,platform,metric_date'
      });

    if (metricsError) {
      console.error('Error saving metrics:', metricsError);
    }

    // Save recent posts to instagram_posts table
    for (const post of recentPosts) {
      await serviceSupabase
        .from('instagram_posts')
        .upsert({
          client_id: clientId,
          post_id: post.post_id,
          caption: post.caption,
          post_type: post.post_type,
          permalink: post.permalink,
          thumbnail_url: post.thumbnail_url,
          likes: post.likes,
          comments: post.comments,
          posted_at: post.posted_at,
          analyzed_at: new Date().toISOString()
        }, {
          onConflict: 'client_id,post_id'
        });
    }

    console.log('Instagram metrics saved successfully');

    return new Response(
      JSON.stringify({
        success: true,
        profile: {
          username: profileData.username,
          name: profileData.name,
          followers: followers,
          mediaCount: profileData.media_count
        },
        metrics: {
          impressions,
          reach,
          profileViews,
          engagementRate: avgEngagement,
          totalLikes,
          totalComments,
          recentPostsAnalyzed: postCount
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Fetch Instagram metrics error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
