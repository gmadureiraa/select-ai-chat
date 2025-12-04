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
    console.log("Starting daily metrics collection...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all clients with Instagram configured
    const { data: clients, error: clientsError } = await supabase
      .from("clients")
      .select("id, name, social_media");

    if (clientsError) {
      throw clientsError;
    }

    const results: any[] = [];
    const apifyApiKey = Deno.env.get("APIFY_API_KEY");

    if (!apifyApiKey) {
      throw new Error("APIFY_API_KEY not configured");
    }

    for (const client of clients || []) {
      const socialMedia = client.social_media as any;
      const instagramUrl = socialMedia?.instagram || "";
      const username = instagramUrl.split("/").filter(Boolean).pop() || "";

      if (!username) {
        console.log(`Skipping ${client.name}: no Instagram configured`);
        continue;
      }

      try {
        console.log(`Fetching Instagram metrics for ${client.name} (@${username})`);

        // Use Apify Instagram Profile Scraper
        const actorId = "apify~instagram-profile-scraper";
        const runUrl = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${apifyApiKey}`;

        const apifyResponse = await fetch(runUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            usernames: [username],
            resultsLimit: 12,
          }),
        });

        if (!apifyResponse.ok) {
          console.error(`Apify error for ${username}: ${apifyResponse.status}`);
          results.push({ client: client.name, status: "error", error: "Apify request failed" });
          continue;
        }

        const apifyData = await apifyResponse.json();

        if (!apifyData || apifyData.length === 0) {
          console.error(`No data for ${username}`);
          results.push({ client: client.name, status: "error", error: "No data returned" });
          continue;
        }

        const profileData = apifyData[0];
        const recentPosts = profileData.latestPosts || [];

        let totalViews = 0;
        let totalLikes = 0;
        let totalComments = 0;

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
            likes,
            comments,
            views,
            caption: post.caption?.substring(0, 100),
          };
        });

        const followers = profileData.followersCount || 0;
        const engagementRate = followers > 0
          ? ((totalLikes + totalComments) / (recentPosts.length * followers) * 100).toFixed(2)
          : 0;

        const today = new Date().toISOString().split("T")[0];

        const { error: upsertError } = await supabase
          .from("platform_metrics")
          .upsert({
            client_id: client.id,
            platform: "instagram",
            metric_date: today,
            subscribers: followers,
            total_posts: profileData.postsCount || 0,
            views: totalViews,
            likes: totalLikes,
            comments: totalComments,
            shares: 0,
            engagement_rate: parseFloat(engagementRate as string),
            metadata: {
              following: profileData.followsCount || 0,
              recent_posts: postMetrics,
              bio: profileData.biography,
              is_verified: profileData.verified,
              fetched_at: new Date().toISOString(),
            },
          }, {
            onConflict: "client_id,platform,metric_date",
          });

        if (upsertError) {
          console.error(`Database error for ${client.name}:`, upsertError);
          results.push({ client: client.name, status: "error", error: upsertError.message });
        } else {
          console.log(`Successfully saved metrics for ${client.name}`);
          results.push({ client: client.name, status: "success", followers });
        }

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (err: any) {
        console.error(`Error processing ${client.name}:`, err);
        results.push({ client: client.name, status: "error", error: err.message });
      }
    }

    console.log("Daily metrics collection completed:", results);

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in daily metrics collection:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});