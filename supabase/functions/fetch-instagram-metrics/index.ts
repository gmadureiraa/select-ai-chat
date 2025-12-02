import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clientId, username } = await req.json();
    
    if (!clientId || !username) {
      throw new Error("clientId and username are required");
    }

    const apifyApiKey = Deno.env.get("APIFY_API_KEY");
    if (!apifyApiKey) {
      throw new Error("APIFY_API_KEY not configured");
    }

    console.log(`Fetching Instagram metrics for @${username}`);

    // Use Apify Instagram Profile Scraper
    const actorId = "apify~instagram-profile-scraper";
    const runUrl = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${apifyApiKey}`;

    const apifyResponse = await fetch(runUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        usernames: [username],
        resultsLimit: 12, // Get last 12 posts for metrics
      }),
    });

    if (!apifyResponse.ok) {
      const errorText = await apifyResponse.text();
      console.error("Apify error:", errorText);
      throw new Error(`Apify request failed: ${apifyResponse.status}`);
    }

    const apifyData = await apifyResponse.json();
    console.log("Apify response received:", apifyData?.length, "items");

    if (!apifyData || apifyData.length === 0) {
      throw new Error("No data returned from Apify");
    }

    const profileData = apifyData[0];
    
    // Calculate aggregated metrics from recent posts
    const recentPosts = profileData.latestPosts || [];
    
    let totalViews = 0;
    let totalLikes = 0;
    let totalComments = 0;
    let totalShares = 0;

    const postMetrics = recentPosts.slice(0, 12).map((post: any) => {
      const views = post.videoViewCount || post.playCount || 0;
      const likes = post.likesCount || 0;
      const comments = post.commentsCount || 0;
      
      totalViews += views;
      totalLikes += likes;
      totalComments += comments;

      return {
        id: post.id,
        shortcode: post.shortCode,
        type: post.type,
        timestamp: post.timestamp,
        likes: likes,
        comments: comments,
        views: views,
        caption: post.caption?.substring(0, 100),
        url: post.url,
      };
    });

    // Calculate engagement rate
    const followers = profileData.followersCount || 0;
    const engagementRate = followers > 0 
      ? ((totalLikes + totalComments) / (recentPosts.length * followers) * 100).toFixed(2)
      : 0;

    const metrics = {
      followers: followers,
      following: profileData.followsCount || 0,
      posts_count: profileData.postsCount || 0,
      total_views: totalViews,
      total_likes: totalLikes,
      total_comments: totalComments,
      total_shares: totalShares,
      engagement_rate: parseFloat(engagementRate as string),
      recent_posts: postMetrics,
      bio: profileData.biography,
      profile_pic: profileData.profilePicUrl,
      is_verified: profileData.verified,
      fetched_at: new Date().toISOString(),
    };

    // Save to database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const today = new Date().toISOString().split('T')[0];

    const { error: upsertError } = await supabase
      .from("platform_metrics")
      .upsert({
        client_id: clientId,
        platform: "instagram",
        metric_date: today,
        subscribers: metrics.followers,
        total_posts: metrics.posts_count,
        views: metrics.total_views,
        likes: metrics.total_likes,
        comments: metrics.total_comments,
        shares: metrics.total_shares,
        engagement_rate: metrics.engagement_rate,
        metadata: {
          following: metrics.following,
          recent_posts: metrics.recent_posts,
          bio: metrics.bio,
          profile_pic: metrics.profile_pic,
          is_verified: metrics.is_verified,
          fetched_at: metrics.fetched_at,
        },
      }, {
        onConflict: "client_id,platform,metric_date",
      });

    if (upsertError) {
      console.error("Database error:", upsertError);
      throw upsertError;
    }

    console.log("Instagram metrics saved successfully");

    return new Response(JSON.stringify({ success: true, metrics }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error fetching Instagram metrics:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
