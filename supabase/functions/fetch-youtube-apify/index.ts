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
    const { clientId, channelUrl, singleVideo, maxResults: customMaxResults } = await req.json();

    if (!clientId || !channelUrl) {
      return new Response(
        JSON.stringify({ error: "clientId and channelUrl are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const APIFY_API_TOKEN_1 = Deno.env.get("APIFY_API_TOKEN");
    const APIFY_API_TOKEN_2 = Deno.env.get("APIFY_API_TOKEN_2");
    if (!APIFY_API_TOKEN_1 && !APIFY_API_TOKEN_2) {
      return new Response(
        JSON.stringify({ error: "Nenhum APIFY_API_TOKEN configurado." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const apifyTokens = [APIFY_API_TOKEN_1, APIFY_API_TOKEN_2].filter(Boolean) as string[];

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Normalize URL
    let normalizedUrl = channelUrl.trim();
    if (!singleVideo) {
      if (normalizedUrl.startsWith("@")) {
        normalizedUrl = `https://www.youtube.com/${normalizedUrl}`;
      } else if (!normalizedUrl.startsWith("http")) {
        normalizedUrl = `https://www.youtube.com/@${normalizedUrl}`;
      }
    }

    console.log(`[fetch-youtube-apify] Starting for: ${normalizedUrl} (singleVideo: ${!!singleVideo})`);

    const actorId = "streamers~youtube-scraper";

    let items: any[] = [];
    let lastError = "";

    for (const APIFY_API_TOKEN of apifyTokens) {
      try {
        console.log(`[fetch-youtube-apify] Trying token ending ...${APIFY_API_TOKEN.slice(-4)}`);

        // Step 1: Start the actor run (async)
        const startUrl = `https://api.apify.com/v2/acts/${actorId}/runs?token=${APIFY_API_TOKEN}`;
        const startResponse = await fetch(startUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startUrls: [{ url: normalizedUrl }],
            maxResults: singleVideo ? 1 : (customMaxResults || 200),
            maxResultsShorts: 0,
            maxResultStreams: 0,
          }),
        });

        if (!startResponse.ok) {
          const errorText = await startResponse.text();
          console.error(`[fetch-youtube-apify] Start error (${startResponse.status}):`, errorText);
          if (startResponse.status === 429 || errorText.includes("limit")) {
            lastError = `Token ...${APIFY_API_TOKEN.slice(-4)} hit rate limit, trying next...`;
            continue;
          }
          lastError = `Apify start error: ${startResponse.status}`;
          continue;
        }

        const runData = await startResponse.json();
        const runId = runData.data?.id;
        const defaultDatasetId = runData.data?.defaultDatasetId;
        console.log(`[fetch-youtube-apify] Run started: ${runId}, dataset: ${defaultDatasetId}`);

        // Step 2: Poll for completion
        const maxWaitMs = 100_000;
        const pollIntervalMs = 5_000;
        const startTime = Date.now();
        let status = runData.data?.status;

        while (status !== "SUCCEEDED" && status !== "FAILED" && status !== "ABORTED" && status !== "TIMED-OUT") {
          if (Date.now() - startTime > maxWaitMs) {
            console.log(`[fetch-youtube-apify] Timeout waiting for run ${runId}`);
            lastError = "Scraping demorou demais. Tente novamente em alguns minutos.";
            break;
          }
          await new Promise(r => setTimeout(r, pollIntervalMs));
          const statusResponse = await fetch(
            `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_TOKEN}`
          );
          const statusData = await statusResponse.json();
          status = statusData.data?.status;
          console.log(`[fetch-youtube-apify] Poll status: ${status} (${Math.round((Date.now() - startTime) / 1000)}s)`);
        }

        if (status !== "SUCCEEDED") {
          lastError = `Apify run ${status}`;
          continue;
        }

        // Step 3: Get dataset items
        const datasetUrl = `https://api.apify.com/v2/datasets/${defaultDatasetId}/items?token=${APIFY_API_TOKEN}`;
        const datasetResponse = await fetch(datasetUrl);
        items = await datasetResponse.json();
        console.log(`[fetch-youtube-apify] Got ${items.length} items with token ...${APIFY_API_TOKEN.slice(-4)}`);
        break; // Success, exit the loop
      } catch (tokenErr) {
        console.error(`[fetch-youtube-apify] Token ...${APIFY_API_TOKEN.slice(-4)} failed:`, tokenErr);
        lastError = tokenErr instanceof Error ? tokenErr.message : "Unknown token error";
        continue;
      }
    }

    if (!Array.isArray(items) || items.length === 0) {
      return new Response(
        JSON.stringify({ error: lastError || "Nenhum vídeo encontrado." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log first item for debugging
    if (items.length > 0) {
      console.log(`[fetch-youtube-apify] Sample item keys:`, Object.keys(items[0]));
      console.log(`[fetch-youtube-apify] First item:`, JSON.stringify(items[0]).substring(0, 1500));
    }

    // Filter video items (skip errors/channel-info)
    const videoItems = items.filter((item: any) => 
      !item.error && (item.type === "video" || item.id || item.videoId || item.url?.includes("/watch") || (item.title && item.viewCount !== undefined))
    );

    console.log(`[fetch-youtube-apify] ${videoItems.length} video items to process`);

    let videosUpserted = 0;
    const batchSize = 50;

    for (let i = 0; i < videoItems.length; i += batchSize) {
      const batch = videoItems.slice(i, i + batchSize);
      
      const videosToUpsert = batch.map((item: any) => {
        const videoId = item.id || item.videoId || 
          (item.url?.match(/(?:v=|\/shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1]) || 
          `unknown-${Date.now()}-${Math.random()}`;

        let durationSeconds: number | null = null;
        if (item.duration) {
          if (typeof item.duration === "number") {
            durationSeconds = item.duration;
          } else if (typeof item.duration === "string") {
            const parts = item.duration.split(":").map(Number);
            if (parts.length === 3) durationSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
            else if (parts.length === 2) durationSeconds = parts[0] * 60 + parts[1];
          }
        }

        let publishedAt: string | null = null;
        if (item.date || item.uploadDate || item.publishedAt) {
          try {
            publishedAt = new Date(item.date || item.uploadDate || item.publishedAt).toISOString();
          } catch { publishedAt = null; }
        }

        return {
          client_id: clientId,
          video_id: videoId,
          title: item.title || item.text || "Sem título",
          total_views: item.viewCount ?? item.views ?? 0,
          likes: item.likes ?? item.likeCount ?? 0,
          comments: item.commentsCount ?? item.commentCount ?? item.numberOfComments ?? 0,
          published_at: publishedAt,
          duration_seconds: durationSeconds,
          thumbnail_url: item.thumbnailUrl || item.thumbnail || 
            (videoId && !videoId.startsWith("unknown-") ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null),
          impressions: null,
          click_rate: null,
          subscribers_gained: null,
          watch_hours: null,
          metadata: {
            apify_source: true,
            scraped_at: new Date().toISOString(),
            channel_name: item.channelName || item.channelTitle || null,
            channel_url: item.channelUrl || null,
            url: item.url || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : null),
          },
        };
      }).filter((v: any) => v.video_id && !v.video_id.startsWith("unknown-"));

      if (videosToUpsert.length > 0) {
        const { error: upsertError } = await supabase
          .from("youtube_videos")
          .upsert(videosToUpsert, { onConflict: "client_id,video_id" });

        if (upsertError) {
          console.error(`[fetch-youtube-apify] Upsert error batch ${i}:`, upsertError);
        } else {
          videosUpserted += videosToUpsert.length;
        }
      }
    }

    console.log(`[fetch-youtube-apify] Done. ${videosUpserted} videos upserted.`);

    return new Response(
      JSON.stringify({
        success: true,
        videosFound: videoItems.length,
        videosUpdated: videosUpserted,
        channelUrl: normalizedUrl,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[fetch-youtube-apify] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
