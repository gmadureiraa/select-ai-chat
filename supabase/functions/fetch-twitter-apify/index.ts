import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clientId, twitterHandle, maxResults: customMaxResults } = await req.json();

    if (!clientId || !twitterHandle) {
      return new Response(
        JSON.stringify({ error: "clientId and twitterHandle are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const APIFY_API_TOKEN_1 = Deno.env.get("APIFY_API_TOKEN");
    const APIFY_API_TOKEN_2 = Deno.env.get("APIFY_API_TOKEN_2");
    if (!APIFY_API_TOKEN_1 && !APIFY_API_TOKEN_2) {
      return new Response(
        JSON.stringify({ error: "No APIFY_API_TOKEN configured." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const apifyTokens = [APIFY_API_TOKEN_1, APIFY_API_TOKEN_2].filter(Boolean) as string[];

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Normalize handle
    let handle = twitterHandle.trim().replace(/^@/, "").replace(/^https?:\/\/(x|twitter)\.com\//, "").replace(/\/.*$/, "");
    
    console.log(`[fetch-twitter-apify] Starting for handle: ${handle}`);

    const actorId = "quacker~twitter-scraper";
    const maxTweets = customMaxResults || 100;

    let items: any[] = [];
    let lastError = "";
    const MAX_RETRIES = 2;

    for (const APIFY_API_TOKEN of apifyTokens) {
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          if (attempt > 0) {
            const waitMs = Math.pow(2, attempt) * 3000 + Math.random() * 2000;
            console.log(`[fetch-twitter-apify] Retry ${attempt}, waiting ${Math.round(waitMs)}ms...`);
            await new Promise(r => setTimeout(r, waitMs));
          }
          console.log(`[fetch-twitter-apify] Trying token ...${APIFY_API_TOKEN.slice(-4)} (attempt ${attempt + 1})`);

          const startUrl = `https://api.apify.com/v2/acts/${actorId}/runs?token=${APIFY_API_TOKEN}`;
          const startResponse = await fetch(startUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              twitterHandles: [handle],
              maxTweets,
              proxyConfiguration: { useApifyProxy: true },
            }),
          });

          if (!startResponse.ok) {
            const errorText = await startResponse.text();
            console.error(`[fetch-twitter-apify] Start error (${startResponse.status}):`, errorText);
            if (startResponse.status === 429 || errorText.includes("limit")) {
              lastError = `Token ...${APIFY_API_TOKEN.slice(-4)} hit rate limit`;
              if (attempt < MAX_RETRIES) continue;
              break;
            }
            lastError = `Apify start error: ${startResponse.status}`;
            break;
          }

          const runData = await startResponse.json();
          const runId = runData.data?.id;
          const defaultDatasetId = runData.data?.defaultDatasetId;
          console.log(`[fetch-twitter-apify] Run started: ${runId}, dataset: ${defaultDatasetId}`);

          // Poll for completion
          const maxWaitMs = 180_000;
          const pollIntervalMs = 5_000;
          const startTime = Date.now();
          let status = runData.data?.status;

          while (status !== "SUCCEEDED" && status !== "FAILED" && status !== "ABORTED" && status !== "TIMED-OUT") {
            if (Date.now() - startTime > maxWaitMs) {
              lastError = "Scraping took too long. Try again later.";
              break;
            }
            await new Promise(r => setTimeout(r, pollIntervalMs));
            const statusResponse = await fetch(
              `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_TOKEN}`
            );
            const statusData = await statusResponse.json();
            status = statusData.data?.status;
            console.log(`[fetch-twitter-apify] Poll status: ${status} (${Math.round((Date.now() - startTime) / 1000)}s)`);
          }

          if (status !== "SUCCEEDED") {
            lastError = `Apify run ${status}`;
            continue;
          }

          const datasetUrl = `https://api.apify.com/v2/datasets/${defaultDatasetId}/items?token=${APIFY_API_TOKEN}`;
          const datasetResponse = await fetch(datasetUrl);
          items = await datasetResponse.json();
          console.log(`[fetch-twitter-apify] Got ${items.length} items`);
          break;
        } catch (tokenErr) {
          console.error(`[fetch-twitter-apify] Token ...${APIFY_API_TOKEN.slice(-4)} attempt ${attempt + 1} failed:`, tokenErr);
          lastError = tokenErr instanceof Error ? tokenErr.message : "Unknown error";
          if (attempt < MAX_RETRIES) continue;
        }
      }
      if (items.length > 0) break;
    }

    if (!Array.isArray(items) || items.length === 0) {
      return new Response(
        JSON.stringify({ error: lastError || "No tweets found." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log sample for debugging
    if (items.length > 0) {
      console.log(`[fetch-twitter-apify] Sample keys:`, JSON.stringify(Object.keys(items[0])));
      console.log(`[fetch-twitter-apify] First item (truncated):`, JSON.stringify(items[0]).substring(0, 1500));
    }

    function parseCount(val: any): number {
      if (val === null || val === undefined) return 0;
      if (typeof val === 'number') return val;
      const str = String(val).replace(/,/g, '');
      const num = parseInt(str, 10);
      return isNaN(num) ? 0 : num;
    }

    // Filter tweet items
    const tweetItems = items.filter((item: any) =>
      !item.error && (item.id || item.id_str || item.tweetId || item.url?.includes("/status/"))
    );

    console.log(`[fetch-twitter-apify] ${tweetItems.length} tweet items to process`);

    let tweetsUpserted = 0;
    const batchSize = 50;

    for (let i = 0; i < tweetItems.length; i += batchSize) {
      const batch = tweetItems.slice(i, i + batchSize);

      const tweetsToUpsert = batch.map((item: any) => {
        // Extract tweet ID
        let tweetId = item.id_str || item.id || item.tweetId || "";
        if (!tweetId && item.url) {
          const match = item.url.match(/status\/(\d+)/);
          if (match) tweetId = match[1];
        }
        if (!tweetId) return null;

        // Parse date
        let postedAt: string | null = null;
        const dateStr = item.created_at || item.createdAt || item.date || item.timestamp;
        if (dateStr) {
          try {
            postedAt = new Date(dateStr).toISOString();
          } catch { postedAt = null; }
        }

        const likes = parseCount(item.favorite_count ?? item.likeCount ?? item.likes ?? 0);
        const retweets = parseCount(item.retweet_count ?? item.retweetCount ?? item.retweets ?? 0);
        const replies = parseCount(item.reply_count ?? item.replyCount ?? item.replies ?? 0);
        const impressions = parseCount(item.view_count ?? item.viewCount ?? item.views ?? item.impressions ?? 0);
        const bookmarks = parseCount(item.bookmark_count ?? item.bookmarkCount ?? item.bookmarks ?? 0);

        const engagements = likes + retweets + replies + bookmarks;
        const engagementRate = impressions > 0 ? (engagements / impressions) * 100 : 0;

        const content = item.full_text || item.text || item.content || null;

        // Extract images
        const images: string[] = [];
        if (item.entities?.media) {
          for (const m of item.entities.media) {
            if (m.media_url_https) images.push(m.media_url_https);
          }
        }
        if (item.media && Array.isArray(item.media)) {
          for (const m of item.media) {
            const url = m.media_url_https || m.url || m.preview_image_url;
            if (url) images.push(url);
          }
        }

        return {
          client_id: clientId,
          tweet_id: String(tweetId),
          content,
          full_content: content,
          posted_at: postedAt,
          impressions,
          engagements,
          engagement_rate: engagementRate,
          retweets,
          replies,
          likes,
          profile_clicks: 0,
          url_clicks: 0,
          hashtag_clicks: 0,
          detail_expands: 0,
          media_views: 0,
          media_engagements: 0,
          images: images.length > 0 ? images : null,
          content_synced_at: content ? new Date().toISOString() : null,
          metadata: {
            apify_source: true,
            scraped_at: new Date().toISOString(),
            bookmarks,
            author_handle: handle,
          },
        };
      }).filter(Boolean);

      if (tweetsToUpsert.length > 0) {
        const { error: upsertError } = await supabase
          .from("twitter_posts")
          .upsert(tweetsToUpsert as any[], { onConflict: "client_id,tweet_id" });

        if (upsertError) {
          console.error(`[fetch-twitter-apify] Upsert error batch ${i}:`, upsertError);
        } else {
          tweetsUpserted += tweetsToUpsert.length;
        }
      }
    }

    console.log(`[fetch-twitter-apify] Done. ${tweetsUpserted} tweets upserted.`);

    return new Response(
      JSON.stringify({
        success: true,
        tweetsFound: tweetItems.length,
        tweetsUpdated: tweetsUpserted,
        handle,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[fetch-twitter-apify] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
