import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function extractTikTokUsername(input: string): string {
  if (!input) return "";
  const cleaned = input.trim().replace(/^@/, "");
  const match = cleaned.match(/tiktok\.com\/@?([^/?#]+)/i);
  return (match ? match[1] : cleaned).replace(/^@/, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startedAt = Date.now();
  try {
    const { clientId, username: rawUsername } = await req.json();
    if (!clientId || !rawUsername) throw new Error("clientId and username are required");

    const username = extractTikTokUsername(rawUsername);
    const apifyApiKey = Deno.env.get("APIFY_API_KEY") || Deno.env.get("APIFY_API_TOKEN");
    if (!apifyApiKey) throw new Error("APIFY_API_KEY not configured");

    console.log(`[tiktok] Fetching @${username}`);

    // clockworks/tiktok-scraper - cheap and reliable
    const actorId = "clockworks~tiktok-scraper";
    const runUrl = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${apifyApiKey}&timeout=120`;

    const apifyResponse = await fetch(runUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
      console.error("[tiktok] Apify error:", errorText);
      // Graceful failure on rate limit
      if (apifyResponse.status === 429 || apifyResponse.status === 402) {
        return new Response(JSON.stringify({ success: false, error: "Apify rate limit / payment required", retryable: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error(`Apify request failed: ${apifyResponse.status}`);
    }

    const items = await apifyResponse.json();
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("No data returned from Apify TikTok scraper");
    }

    // First item carries authorMeta (followers, etc.)
    const first = items[0];
    const authorMeta = first?.authorMeta || first?.author || {};
    const followers = authorMeta.fans || authorMeta.followerCount || 0;
    const following = authorMeta.following || authorMeta.followingCount || 0;
    const totalVideos = authorMeta.video || authorMeta.videoCount || items.length;

    let totalViews = 0, totalLikes = 0, totalComments = 0, totalShares = 0;
    const recent = items.slice(0, 10).map((v: any) => {
      const views = v.playCount || 0;
      const likes = v.diggCount || v.likesCount || 0;
      const comments = v.commentCount || 0;
      const shares = v.shareCount || 0;
      totalViews += views; totalLikes += likes; totalComments += comments; totalShares += shares;
      return {
        id: v.id, url: v.webVideoUrl, timestamp: v.createTimeISO || v.createTime,
        views, likes, comments, shares,
        caption: (v.text || "").substring(0, 200),
      };
    });

    const denom = recent.length * Math.max(followers, 1);
    const engagementRate = followers > 0
      ? Number((((totalLikes + totalComments + totalShares) / denom) * 100).toFixed(2))
      : 0;

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const today = new Date().toISOString().split("T")[0];

    const { error } = await supabase.from("platform_metrics").upsert({
      client_id: clientId,
      platform: "tiktok",
      metric_date: today,
      subscribers: followers,
      total_posts: totalVideos,
      views: totalViews,
      likes: totalLikes,
      comments: totalComments,
      shares: totalShares,
      engagement_rate: engagementRate,
      metadata: {
        following,
        username,
        recent_posts: recent,
        nickname: authorMeta.nickName,
        verified: authorMeta.verified,
        fetched_at: new Date().toISOString(),
      },
    }, { onConflict: "client_id,platform,metric_date" });

    if (error) throw error;

    return new Response(JSON.stringify({
      success: true,
      duration_ms: Date.now() - startedAt,
      items_synced: recent.length,
      estimated_cost_usd: 0.01,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("[tiktok] error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message, duration_ms: Date.now() - startedAt }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
