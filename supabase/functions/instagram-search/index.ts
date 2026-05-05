/**
 * instagram-search — busca posts/reels do Instagram por hashtag via Apify
 * (apify/instagram-hashtag-scraper) com paginação simulada (offset/cursor) +
 * cache automático em viral_search_cache.
 *
 * Body: { hashtag: string, limit?: number, offset?: number,
 *         clientId?: string, workspaceId?: string }
 *
 * Apify retorna até `limit` posts; pra "página 2" passamos offset = limit*page,
 * recalculando resultsLimit = offset + limit (Apify entrega top-N por relevância).
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { cacheViralSearch } from "../_shared/viralCache.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
  hashtag: string;
  limit?: number;
  offset?: number;
  clientId?: string;
  workspaceId?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "auth required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Validate user token
    const sbAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: u } = await sbAuth.auth.getUser();
    if (!u?.user) {
      return new Response(JSON.stringify({ error: "invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json().catch(() => ({}))) as Partial<Body>;
    const hashtag = (body.hashtag ?? "").trim().replace(/^#/, "");
    if (!hashtag) {
      return new Response(JSON.stringify({ error: "hashtag obrigatória" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const limit = Math.min(Math.max(body.limit ?? 12, 1), 30);
    const offset = Math.max(body.offset ?? 0, 0);
    const totalNeeded = offset + limit;

    const apifyKey = Deno.env.get("APIFY_API_KEY_INSTAGRAM") ?? Deno.env.get("APIFY_API_KEY");
    if (!apifyKey) {
      return new Response(JSON.stringify({ error: "APIFY_API_KEY_INSTAGRAM não configurada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Apify async start
    const startRes = await fetch(
      `https://api.apify.com/v2/acts/apify~instagram-hashtag-scraper/runs?token=${apifyKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hashtags: [hashtag],
          resultsLimit: totalNeeded,
        }),
      },
    );
    if (!startRes.ok) {
      const t = await startRes.text().catch(() => "");
      console.error("[instagram-search] start failed", startRes.status, t.slice(0, 300));
      return new Response(JSON.stringify({ error: `Apify start ${startRes.status}`, details: t.slice(0, 300) }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const startJson = await startRes.json();
    const runId = startJson?.data?.id;
    const datasetId = startJson?.data?.defaultDatasetId;
    let status = startJson?.data?.status;

    const deadline = Date.now() + 120_000;
    while (runId && Date.now() < deadline && !["SUCCEEDED","FAILED","ABORTED","TIMED-OUT"].includes(status)) {
      await new Promise((r) => setTimeout(r, 3000));
      const sRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${apifyKey}`);
      if (!sRes.ok) break;
      status = (await sRes.json())?.data?.status;
    }
    if (status !== "SUCCEEDED" || !datasetId) {
      return new Response(JSON.stringify({ error: `Apify run ${status}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyKey}&clean=true&format=json`);
    if (!dsRes.ok) {
      return new Response(JSON.stringify({ error: `Apify dataset ${dsRes.status}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const raw: any[] = await dsRes.json();
    const all = (Array.isArray(raw) ? raw : []).map((p) => ({
      id: p.id ?? p.shortCode ?? p.url,
      shortCode: p.shortCode ?? null,
      url: p.url ?? (p.shortCode ? `https://instagram.com/p/${p.shortCode}/` : ""),
      type: p.type ?? "Post", // "Image" | "Video" | "Sidecar"
      caption: p.caption ?? "",
      hashtags: Array.isArray(p.hashtags) ? p.hashtags : [],
      ownerUsername: p.ownerUsername ?? p.owner?.username ?? "",
      ownerFullName: p.ownerFullName ?? p.owner?.full_name ?? "",
      thumbnailUrl: p.displayUrl ?? p.thumbnailUrl ?? "",
      videoUrl: p.videoUrl ?? null,
      likesCount: typeof p.likesCount === "number" ? p.likesCount : null,
      commentsCount: typeof p.commentsCount === "number" ? p.commentsCount : null,
      videoPlayCount: typeof p.videoPlayCount === "number" ? p.videoPlayCount : null,
      videoViewCount: typeof p.videoViewCount === "number" ? p.videoViewCount : null,
      timestamp: p.timestamp ?? null,
    }));

    // Aplica offset client-side (Apify entrega top-N ordenado por relevância)
    const page = all.slice(offset, offset + limit);
    const hasMore = all.length >= totalNeeded && page.length === limit;

    await cacheViralSearch({
      workspaceId: body.workspaceId,
      clientId: body.clientId,
      source: "instagram",
      query: `#${hashtag}`,
      items: page,
      filters: { hashtag, limit, offset },
      isFallback: false,
      nextPageToken: hasMore ? String(offset + limit) : null,
      authHeader,
    });

    return new Response(JSON.stringify({
      items: page,
      nextPageToken: hasMore ? String(offset + limit) : null,
      source: "apify-instagram",
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[instagram-search] error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
