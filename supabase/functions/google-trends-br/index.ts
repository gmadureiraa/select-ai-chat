/**
 * google-trends-br
 * Lista as buscas em alta do Brasil via Google Trends RSS público.
 * Salva opcionalmente no viral_search_cache se clientId+workspaceId vierem no body.
 */
import { cacheViralSearch } from "../_shared/viralCache.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FEED = "https://trends.google.com/trending/rss?geo=BR";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const res = await fetch(FEED, { headers: { "User-Agent": "Mozilla/5.0 kAI-Trends" } });
    if (!res.ok) throw new Error(`Trends HTTP ${res.status}`);
    const xml = await res.text();
    const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
    const items = blocks.slice(0, 30).map((b) => {
      const get = (re: RegExp) => (b.match(re)?.[1] ?? "").replace(/<!\[CDATA\[|\]\]>/g, "").trim();
      return {
        title: get(/<title>([\s\S]*?)<\/title>/i),
        traffic: get(/<ht:approx_traffic>([\s\S]*?)<\/ht:approx_traffic>/i),
        pubDate: get(/<pubDate>([\s\S]*?)<\/pubDate>/i),
        picture: get(/<ht:picture>([\s\S]*?)<\/ht:picture>/i),
        link: get(/<link>([\s\S]*?)<\/link>/i),
      };
    });

    await cacheViralSearch({
      workspaceId: body?.workspaceId as string | undefined,
      clientId: body?.clientId as string | undefined,
      source: "trends",
      query: "google-trends-br",
      items,
      filters: { geo: "BR" },
      authHeader: req.headers.get("authorization"),
    });

    return new Response(JSON.stringify({ items }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error)?.message ?? "erro", items: [] }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
