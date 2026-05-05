/**
 * google-news-search — proxy pra Google News RSS.
 * Substitui rss2json.com (proxy de terceiro frágil) por parsing direto.
 *
 * Body: { query: string, lang?: string, region?: string }
 */
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { cacheViralSearch } from "../_shared/viralCache.ts";

interface NewsBody {
  query: string;
  lang?: string;
  region?: string;
  clientId?: string;
  workspaceId?: string;
}

function parseRSS(xml: string) {
  const items: Array<{
    title: string;
    link: string;
    pubDate: string;
    description: string;
    guid?: string;
  }> = [];

  // Extract <item>...</item> blocks (não-greedy)
  const itemRegex = /<item\b[^>]*>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRegex.exec(xml)) !== null) {
    const block = m[1];
    const get = (tag: string) => {
      const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "i");
      const r = re.exec(block);
      if (!r) return "";
      let v = r[1].trim();
      // strip CDATA
      v = v.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
      return v;
    };
    items.push({
      title: get("title"),
      link: get("link"),
      pubDate: get("pubDate"),
      description: get("description"),
      guid: get("guid"),
    });
  }
  return items;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Partial<NewsBody>;
    const query = (body.query ?? "").trim();
    if (!query) {
      return new Response(
        JSON.stringify({ error: "query é obrigatória" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const lang = body.lang ?? "pt-BR";
    const region = body.region ?? "BR";
    const langShort = lang.split("-")[0];

    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(
      query,
    )}&hl=${lang}&gl=${region}&ceid=${region}:${langShort}`;

    const res = await fetch(rssUrl, {
      headers: {
        // Some Google endpoints respond differently w/o a UA
        "User-Agent":
          "Mozilla/5.0 (compatible; KaiViralHunter/1.0; +https://kaleidos.com.br)",
      },
    });
    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: `Google News ${res.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const xml = await res.text();
    const rawItems = parseRSS(xml).slice(0, 24);

    const items = rawItems.map((it, i) => {
      const parts = it.title.split(" - ");
      const source = parts.length > 1 ? parts[parts.length - 1] : "Fonte desconhecida";
      const title = parts.length > 1 ? parts.slice(0, -1).join(" - ") : it.title;
      const snippet = it.description
        .replace(/<[^>]+>/g, "")
        .slice(0, 280)
        .trim();
      return {
        id: it.guid || `${it.link}-${i}`,
        title,
        source,
        url: it.link,
        publishedAt: it.pubDate,
        snippet,
      };
    });

    await cacheViralSearch({
      workspaceId: body.workspaceId, clientId: body.clientId, source: "news",
      query, items, isFallback: false,
      filters: { lang, region },
      authHeader: req.headers.get("authorization"),
    });

    return new Response(JSON.stringify({ items }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[google-news-search] error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
