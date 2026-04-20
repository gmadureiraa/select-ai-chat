/**
 * youtube-search — proxy server-side pra YouTube Data API v3.
 * Tira a chave do bundle do client (segurança) e centraliza erros.
 *
 * Body: { query: string, publishedAfter?: string, order?: string, maxResults?: number }
 */
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const YT_API_BASE = "https://www.googleapis.com/youtube/v3";

interface SearchBody {
  query: string;
  publishedAfter?: string;
  order?: "relevance" | "date" | "viewCount" | "rating";
  maxResults?: number;
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
    const maxResults = Math.min(Math.max(body.maxResults ?? 12, 1), 25);

    // 1. Search
    const searchUrl = new URL(`${YT_API_BASE}/search`);
    searchUrl.searchParams.set("part", "snippet");
    searchUrl.searchParams.set("type", "video");
    searchUrl.searchParams.set("maxResults", String(maxResults));
    searchUrl.searchParams.set("order", order);
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("key", apiKey);
    if (body.publishedAfter) searchUrl.searchParams.set("publishedAfter", body.publishedAfter);

    const searchRes = await fetch(searchUrl.toString());
    if (!searchRes.ok) {
      const errText = await searchRes.text().catch(() => "");
      return new Response(
        JSON.stringify({ error: `YouTube API ${searchRes.status}`, details: errText.slice(0, 500) }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const searchJson = await searchRes.json();
    interface YTSearchItem {
      id: { videoId?: string };
      snippet: {
        publishedAt: string;
        channelId: string;
        title: string;
        description: string;
        thumbnails: Record<string, { url: string }>;
        channelTitle: string;
      };
    }
    const items: YTSearchItem[] = searchJson.items ?? [];
    const videoIds = items.map((i) => i.id.videoId).filter(Boolean) as string[];

    // 2. Stats
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

    const results = items
      .filter((i) => i.id.videoId)
      .map((i) => {
        const id = i.id.videoId!;
        const stats = statsById.get(id);
        const thumb =
          i.snippet.thumbnails.high?.url ??
          i.snippet.thumbnails.medium?.url ??
          i.snippet.thumbnails.default?.url ??
          "";
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

    return new Response(JSON.stringify({ items: results }), {
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
