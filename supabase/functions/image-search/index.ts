/**
 * image-search — busca imagens via Openverse (zero cadastro, CC-licensed)
 * com fallback opcional pra Pexels (se PEXELS_API_KEY estiver configurada).
 *
 * Openverse: API pública do WordPress/Wikimedia. Sem key. Conteúdo Creative Commons.
 *   https://api.openverse.engineering/v1/images/?q=...
 *
 * Pexels (opcional): banco profissional, requer API key gratuita.
 *
 * Body: { query: string, perPage?: number, source?: "openverse" | "pexels" }
 * Returns: { items: [{ id, url, thumbnail, attribution, sourceUrl, source }] }
 */
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

interface SearchBody {
  query: string;
  perPage?: number;
  source?: "openverse" | "pexels";
}

interface NormalizedImage {
  id: string;
  url: string;
  thumbnail: string;
  attribution: string;
  sourceUrl: string;
  source: "openverse" | "pexels";
}

async function searchOpenverse(query: string, perPage: number): Promise<NormalizedImage[]> {
  const url = new URL("https://api.openverse.org/v1/images/");
  url.searchParams.set("q", query);
  url.searchParams.set("page_size", String(perPage));
  url.searchParams.set("license_type", "all");

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": "KaiViralSequence/1.0 (kaleidos.com.br)",
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`Openverse ${res.status}`);
  }
  const data = await res.json();
  const results = (data.results ?? []) as Array<{
    id: string;
    url: string;
    thumbnail?: string;
    title?: string;
    creator?: string;
    license?: string;
    foreign_landing_url?: string;
  }>;
  return results.map((r) => ({
    id: `ov_${r.id}`,
    url: r.url,
    thumbnail: r.thumbnail || r.url,
    attribution: [r.creator, r.license ? `(${r.license.toUpperCase()})` : ""]
      .filter(Boolean)
      .join(" "),
    sourceUrl: r.foreign_landing_url || r.url,
    source: "openverse" as const,
  }));
}

async function searchPexels(query: string, perPage: number): Promise<NormalizedImage[]> {
  const apiKey = Deno.env.get("PEXELS_API_KEY");
  if (!apiKey) throw new Error("PEXELS_API_KEY não configurada");

  const url = new URL("https://api.pexels.com/v1/search");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", String(perPage));
  url.searchParams.set("orientation", "landscape");

  const res = await fetch(url.toString(), {
    headers: { Authorization: apiKey },
  });
  if (!res.ok) throw new Error(`Pexels ${res.status}`);
  const data = await res.json();
  const photos = (data.photos ?? []) as Array<{
    id: number;
    src: { large: string; medium: string };
    photographer: string;
    photographer_url: string;
    url: string;
  }>;
  return photos.map((p) => ({
    id: `px_${p.id}`,
    url: p.src.large,
    thumbnail: p.src.medium,
    attribution: `Foto: ${p.photographer} (Pexels)`,
    sourceUrl: p.url,
    source: "pexels" as const,
  }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Partial<SearchBody>;
    const query = (body.query ?? "").trim();
    if (!query) {
      return new Response(
        JSON.stringify({ error: "query é obrigatória" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const perPage = Math.min(Math.max(body.perPage ?? 12, 1), 24);
    const source = body.source ?? "openverse";

    let items: NormalizedImage[] = [];
    let usedSource: "openverse" | "pexels" = source;

    if (source === "pexels") {
      try {
        items = await searchPexels(query, perPage);
      } catch (err) {
        console.warn("[image-search] Pexels falhou, fallback p/ Openverse:", err);
        items = await searchOpenverse(query, perPage);
        usedSource = "openverse";
      }
    } else {
      items = await searchOpenverse(query, perPage);
    }

    return new Response(JSON.stringify({ items, source: usedSource }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[image-search] error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
