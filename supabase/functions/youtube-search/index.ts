/**
 * youtube-search — proxy server-side pra YouTube Data API v3 com paginação +
 * cache automático em viral_search_cache.
 *
 * Body:
 *   { query: string, publishedAfter?: string, order?: string,
 *     maxResults?: number, pageToken?: string,
 *     clientId?: string, workspaceId?: string }  // pra cache
 */
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const YT_API_BASE = "https://www.googleapis.com/youtube/v3";

interface SearchBody {
  query: string;
  publishedAfter?: string;
  order?: "relevance" | "date" | "viewCount" | "rating";
  maxResults?: number;
  pageToken?: string;
  clientId?: string;
  workspaceId?: string;
}

async function cacheItems(args: {
  clientId?: string; workspaceId?: string; query: string;
  items: any[]; isFallback: boolean; nextPageToken?: string | null;
  authHeader?: string | null;
}) {
  if (!args.clientId || !args.workspaceId || args.items.length === 0) return;
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);
    let userId: string | null = null;
    if (args.authHeader) {
      const token = args.authHeader.replace("Bearer ", "");
      const { data } = await sb.auth.getUser(token);
      userId = data.user?.id ?? null;
    }
    await sb.from("viral_search_cache").insert({
      workspace_id: args.workspaceId,
      client_id: args.clientId,
      source: "youtube",
      query: args.query,
      items: args.items,
      item_count: args.items.length,
      is_fallback: args.isFallback,
      next_page_token: args.nextPageToken ?? null,
      created_by: userId,
    });
  } catch (e) {
    console.warn("[youtube-search] cache insert failed:", (e as Error).message);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("YOUTUBE_API_KEY") ?? Deno.env.get("YT_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "YOUTUBE_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = (await req.json().catch(() => ({}))) as Partial<SearchBody>;
    const query = (body.query ?? "").trim();
    if (!query) {
      return new Response(
        JSON.stringify({ error: "query é obrigatória" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const order = body.order ?? "viewCount";
    const maxResults = Math.min(Math.max(body.maxResults ?? 12, 1), 50);
    const authHeader = req.headers.get("authorization");

    // 1. Search (com pageToken)
    const searchUrl = new URL(`${YT_API_BASE}/search`);
    searchUrl.searchParams.set("part", "snippet");
    searchUrl.searchParams.set("type", "video");
    searchUrl.searchParams.set("maxResults", String(maxResults));
    searchUrl.searchParams.set("order", order);
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("key", apiKey);
    if (body.publishedAfter) searchUrl.searchParams.set("publishedAfter", body.publishedAfter);
    if (body.pageToken) searchUrl.searchParams.set("pageToken", body.pageToken);

    const searchRes = await fetch(searchUrl.toString());

    if (!searchRes.ok) {
      const errText = await searchRes.text().catch(() => "");
      const apifyKey = Deno.env.get("APIFY_API_KEY") ?? Deno.env.get("APIFY_API_TOKEN");
      if (apifyKey && (searchRes.status === 403 || searchRes.status === 429 || searchRes.status === 400)) {
        console.log("[youtube-search] YT Data API failed, trying Apify fallback");
        try {
          const startRes = await fetch(
            `https://api.apify.com/v2/acts/streamers~youtube-scraper/runs?token=${apifyKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                searchQueries: [query],
                maxResults: Math.min(maxResults, 20),
                maxResultsShorts: 0,
                maxResultStreams: 0,
              }),
            },
          );
          if (startRes.ok) {
            const startJson = await startRes.json();
            const runId = startJson?.data?.id;
            const datasetId = startJson?.data?.defaultDatasetId;
            let status = startJson?.data?.status;
            const deadline = Date.now() + 120_000;
            while (runId && Date.now() < deadline && !["SUCCEEDED","FAILED","ABORTED","TIMED-OUT"].includes(status)) {
              await new Promise((r) => setTimeout(r, 3000));
              const sRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${apifyKey}`);
              if (!sRes.ok) { await sRes.text().catch(() => ""); break; }
              const sJson = await sRes.json();
              status = sJson?.data?.status;
            }
            if (status === "SUCCEEDED" && datasetId) {
              const dsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyKey}&clean=true&format=json`);
              if (dsRes.ok) {
                const apifyItems = await dsRes.json();
                const mapped = (Array.isArray(apifyItems) ? apifyItems : [])
                  .filter((v: any) => v?.id || v?.url)
                  .map((v: any) => {
                    const id = v.id ?? v.url?.match(/v=([^&]+)/)?.[1] ?? "";
                    return {
                      id,
                      title: v.title ?? "",
                      channelTitle: v.channelName ?? v.channel ?? "",
                      channelId: v.channelId ?? "",
                      thumbnailUrl: v.thumbnailUrl ?? (id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : ""),
                      publishedAt: v.date ?? v.uploadDate ?? new Date().toISOString(),
                      description: v.text ?? v.description ?? "",
                      url: v.url ?? `https://www.youtube.com/watch?v=${id}`,
                      viewCount: typeof v.viewCount === "number" ? v.viewCount : (v.viewCountText ? parseInt(String(v.viewCountText).replace(/\D/g, ""), 10) || undefined : undefined),
                      likeCount: typeof v.likes === "number" ? v.likes : undefined,
                      commentCount: typeof v.commentsCount === "number" ? v.commentsCount : undefined,
                    };
                  });
                console.log(`[youtube-search] Apify fallback returned ${mapped.length} items`);
                await cacheItems({
                  clientId: body.clientId, workspaceId: body.workspaceId, query,
                  items: mapped, isFallback: true, authHeader,
                });
                return new Response(JSON.stringify({ items: mapped, source: "apify-fallback", nextPageToken: null }), {
                  status: 200,
                  headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
              }
            }
            console.error(`[youtube-search] Apify run ended status=${status}`);
          } else {
            const t = await startRes.text().catch(() => "");
            console.error("[youtube-search] Apify start failed", startRes.status, t.slice(0, 300));
          }
        } catch (apifyErr) {
          console.error("[youtube-search] Apify fallback exception:", apifyErr);
        }
      }
      return new Response(
        JSON.stringify({
          error: `YouTube API ${searchRes.status}`,
          details: errText.slice(0, 500),
          hint: searchRes.status === 403
            ? "YouTube Data API v3 está bloqueada para esta key. Habilite no console.cloud.google.com ou configure APIFY_API_KEY pra fallback."
            : undefined,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const searchJson = await searchRes.json();
    const nextPageToken = searchJson.nextPageToken ?? null;
    interface YTSearchItem {
      id: { videoId?: string };
      snippet: {
        publishedAt: string; channelId: string; title: string; description: string;
        thumbnails: Record<string, { url: string }>; channelTitle: string;
      };
    }
    const items: YTSearchItem[] = searchJson.items ?? [];
    const videoIds = items.map((i) => i.id.videoId).filter(Boolean) as string[];

    let statsById = new Map<string, { viewCount?: string; likeCount?: string; commentCount?: string }>();
    if (videoIds.length > 0) {
      const videosUrl = new URL(`${YT_API_BASE}/videos`);
      videosUrl.searchParams.set("part", "statistics");
      videosUrl.searchParams.set("id", videoIds.join(","));
      videosUrl.searchParams.set("key", apiKey);
      const videosRes = await fetch(videosUrl.toString());
      if (videosRes.ok) {
        const vjson = await videosRes.json();
        for (const v of (vjson.items ?? []) as { id: string; statistics?: Record<string, string> }[]) {
          statsById.set(v.id, v.statistics ?? {});
        }
      }
    }

    const results = items.filter((i) => i.id.videoId).map((i) => {
      const id = i.id.videoId!;
      const stats = statsById.get(id);
      const thumb = i.snippet.thumbnails.high?.url ?? i.snippet.thumbnails.medium?.url ?? i.snippet.thumbnails.default?.url ?? "";
      return {
        id,
        title: i.snippet.title,
        channelTitle: i.snippet.channelTitle,
        channelId: i.snippet.channelId,
        thumbnailUrl: thumb,
        publishedAt: i.snippet.publishedAt,
        description: i.snippet.description,
        url: `https://www.youtube.com/watch?v=${id}`,
        viewCount: stats?.viewCount ? parseInt(stats.viewCount, 10) : undefined,
        likeCount: stats?.likeCount ? parseInt(stats.likeCount, 10) : undefined,
        commentCount: stats?.commentCount ? parseInt(stats.commentCount, 10) : undefined,
      };
    });

    // Cache só na primeira página pra não duplicar
    if (!body.pageToken) {
      await cacheItems({
        clientId: body.clientId, workspaceId: body.workspaceId, query,
        items: results, isFallback: false, nextPageToken, authHeader,
      });
    }

    return new Response(JSON.stringify({ items: results, source: "youtube-api", nextPageToken }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[youtube-search] error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
