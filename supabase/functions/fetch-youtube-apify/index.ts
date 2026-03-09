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
    const { clientId, channelUrl, singleVideo } = await req.json();

    if (!clientId || !channelUrl) {
      return new Response(
        JSON.stringify({ error: "clientId and channelUrl are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN");
    if (!APIFY_API_TOKEN) {
      return new Response(
        JSON.stringify({ error: "APIFY_API_TOKEN not configured. Add it in Settings." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Normalize channel URL
    let normalizedUrl = channelUrl.trim();
    if (!singleVideo) {
      if (normalizedUrl.startsWith("@")) {
        normalizedUrl = `https://www.youtube.com/${normalizedUrl}`;
      } else if (!normalizedUrl.startsWith("http")) {
        normalizedUrl = `https://www.youtube.com/@${normalizedUrl}`;
      }
    }

    console.log(`[fetch-youtube-apify] Starting Apify scrape for: ${normalizedUrl} (singleVideo: ${!!singleVideo})`);

    // Run the Apify YouTube Channel Scraper actor synchronously
    const actorId = "streamers~youtube-scraper";
    const runUrl = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${APIFY_API_TOKEN}&timeout=120`;

    const apifyBody: Record<string, unknown> = {
      startUrls: [{ url: normalizedUrl }],
      maxResults: singleVideo ? 1 : 200,
      maxResultsShorts: 0,
      maxResultStreams: 0,
    };

    const apifyResponse = await fetch(runUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(apifyBody),
    });

    if (!apifyResponse.ok) {
      const errorText = await apifyResponse.text();
      console.error(`[fetch-youtube-apify] Apify error (${apifyResponse.status}):`, errorText);
      
      if (apifyResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos do Apify insuficientes. Verifique seu plano em apify.com" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: `Apify error: ${apifyResponse.status}`, details: errorText.substring(0, 500) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const items = await apifyResponse.json();
    console.log(`[fetch-youtube-apify] Got ${items.length} items from Apify`);

    if (!Array.isArray(items) || items.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nenhum vídeo encontrado. Verifique a URL." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter only video items (not channel info)
    const videoItems = items.filter((item: any) => 
      item.type === "video" || item.id || item.url?.includes("/watch")
    );

    console.log(`[fetch-youtube-apify] ${videoItems.length} video items to process`);

    let videosUpserted = 0;
    const batchSize = 50;

    for (let i = 0; i < videoItems.length; i += batchSize) {
      const batch = videoItems.slice(i, i + batchSize);
      
      const videosToUpsert = batch.map((item: any) => {
        // Extract video ID from various possible fields
        const videoId = item.id || item.videoId || 
          (item.url?.match(/(?:v=|\/shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1]) || 
          `unknown-${Date.now()}-${Math.random()}`;

        // Parse duration from various formats
        let durationSeconds: number | null = null;
        if (item.duration) {
          if (typeof item.duration === "number") {
            durationSeconds = item.duration;
          } else if (typeof item.duration === "string") {
            // Parse "HH:MM:SS" or "MM:SS" format
            const parts = item.duration.split(":").map(Number);
            if (parts.length === 3) durationSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
            else if (parts.length === 2) durationSeconds = parts[0] * 60 + parts[1];
          }
        }

        // Parse date
        let publishedAt: string | null = null;
        if (item.date || item.uploadDate || item.publishedAt) {
          const dateStr = item.date || item.uploadDate || item.publishedAt;
          try {
            publishedAt = new Date(dateStr).toISOString();
          } catch {
            publishedAt = null;
          }
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
            (videoId !== `unknown-${Date.now()}` ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null),
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
