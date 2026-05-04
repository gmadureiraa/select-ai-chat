/**
 * generate-radar-brief
 * ============================================================================
 * Radar Viral — gera o briefing diário de inteligência por nicho.
 *
 * Adaptado de github.com/gmadureiraa/radar-viral (app/api/cron/brief).
 * Diferença: aqui é por client_id (não por user/niche global). O LLM recebe:
 *   - notícias do Google News (últimas 24h) por keywords do cliente
 *   - top vídeos YouTube (Apify ou Data API) por keywords
 *   - posts top do próprio cliente (instagram_posts/linkedin_posts)
 *   - competitors cadastrados pra contexto
 *
 * Output JSON estrito (schema): narratives, hot_topics, carousel_ideas,
 * cross_pollination. Salva em viral_radar_briefs.
 *
 * Auth: JWT do usuário.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_MODEL = "gemini-2.5-flash";

const SYSTEM_INSTRUCTION = `Você é o "Radar Viral" — analisa sinais de mercado em tempo real (notícias, vídeos virais, posts top de competidores, posts do próprio cliente) e gera um briefing operacional pro time de conteúdo.

REGRAS:
1. Trabalhe APENAS com os sinais reais fornecidos no briefing. NÃO invente fatos, métricas ou eventos.
2. Cite fontes: cada narrativa/hot_topic precisa apontar de onde veio (ex: "InfoMoney 04/05", "@investidor4.20").
3. Português brasileiro. Tom direto, sem clichê de marketing.
4. Foque no que é ACIONÁVEL hoje — o que o time pode publicar nas próximas 24-48h pra surfar a onda.
5. Identifique cross-pollination: tópicos que aparecem em múltiplas fontes simultâneas (= sinal forte).
6. Carousel ideas: 3-5 ideias prontas com hook + ângulo, não temas vagos.`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    narratives: {
      type: "array",
      description: "3-5 narrativas dominantes do nicho hoje",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          why: { type: "string", description: "Por que está pegando agora" },
          signals: { type: "array", items: { type: "string" }, description: "Fontes/sinais que sustentam" },
        },
        required: ["title", "why", "signals"],
      },
    },
    hot_topics: {
      type: "array",
      description: "5-10 tópicos quentes, ranqueados",
      items: {
        type: "object",
        properties: {
          topic: { type: "string" },
          signal_count: { type: "integer" },
          source_summary: { type: "string" },
        },
        required: ["topic", "signal_count", "source_summary"],
      },
    },
    carousel_ideas: {
      type: "array",
      description: "3-5 ideias prontas pra virar carrossel",
      items: {
        type: "object",
        properties: {
          hook: { type: "string", description: "Frase de capa do carrossel" },
          angle: { type: "string", description: "Ângulo/desenvolvimento" },
        },
        required: ["hook", "angle"],
      },
    },
    cross_pollination: {
      type: "array",
      description: "Tópicos que aparecem em 2+ fontes diferentes (sinal forte)",
      items: {
        type: "object",
        properties: {
          topic: { type: "string" },
          sources: { type: "array", items: { type: "string" } },
        },
        required: ["topic", "sources"],
      },
    },
  },
  required: ["narratives", "hot_topics", "carousel_ideas", "cross_pollination"],
};

interface NewsItem { title: string; source: string; publishedAt: string; url: string; }
interface YTItem { title: string; channelTitle: string; viewCount?: number; publishedAt: string; }
interface RssItem { title: string; source: string; pubDate: string; link: string; }
interface IgPost { ownerUsername: string; caption?: string; likesCount?: number; commentsCount?: number; videoPlayCount?: number; url?: string; }

// ─── Curated sources (espelha radar-viral/lib/sources-curated.ts) ─────
const CURATED: Record<string, { igHandles: string[]; newsRss: { name: string; url: string }[] }> = {
  crypto: {
    igHandles: ["investidor4.20", "leobueno_", "mercadobitcoin", "documentingbtc"],
    newsRss: [
      { name: "Cointelegraph BR", url: "https://br.cointelegraph.com/rss" },
      { name: "Portal do Bitcoin", url: "https://portaldobitcoin.uol.com.br/feed/" },
      { name: "Livecoins", url: "https://livecoins.com.br/feed/" },
      { name: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/" },
      { name: "The Block", url: "https://www.theblock.co/rss.xml" },
    ],
  },
  marketing: {
    igHandles: ["leadgenman", "matheus.chibebe", "hormozi", "garyvee"],
    newsRss: [
      { name: "Marketing Brew", url: "https://www.marketingbrew.com/feed" },
      { name: "Search Engine Land", url: "https://searchengineland.com/feed" },
      { name: "MeioMensagem", url: "https://www.meioemensagem.com.br/feed/" },
      { name: "B9", url: "https://www.b9.com.br/feed/" },
    ],
  },
  ai: {
    igHandles: ["openai", "anthropicai", "ogmadureira", "hugodoria"],
    newsRss: [
      { name: "Hugging Face", url: "https://huggingface.co/blog/feed.xml" },
      { name: "OpenAI Blog", url: "https://openai.com/blog/rss.xml" },
      { name: "VentureBeat AI", url: "https://venturebeat.com/category/ai/feed/" },
    ],
  },
};

function pickCuratedKey(niche: string): string {
  const n = (niche || "").toLowerCase();
  if (/(crypto|cripto|bitcoin|defi|web3|blockchain)/.test(n)) return "crypto";
  if (/(ai|ia|llm|gpt|inteligência|inteligencia)/.test(n)) return "ai";
  return "marketing";
}

async function fetchNews(supabaseUrl: string, anon: string, query: string): Promise<NewsItem[]> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/google-news-search`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${anon}` },
      body: JSON.stringify({ query, lang: "pt-BR", region: "BR" }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.items ?? []).slice(0, 15);
  } catch { return []; }
}

async function fetchYouTube(supabaseUrl: string, anon: string, query: string): Promise<YTItem[]> {
  try {
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    const res = await fetch(`${supabaseUrl}/functions/v1/youtube-search`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${anon}` },
      body: JSON.stringify({ query, maxResults: 10, order: "viewCount", publishedAfter: since }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.items ?? []).slice(0, 10);
  } catch { return []; }
}

async function fetchRssFeed(name: string, url: string): Promise<RssItem[]> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 kAI-Radar" } });
    if (!res.ok) return [];
    const xml = await res.text();
    const items: RssItem[] = [];
    const re = /<item[\s\S]*?<\/item>/gi;
    const matches = xml.match(re) ?? [];
    for (const block of matches.slice(0, 5)) {
      const title = (block.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "")
        .replace(/<!\[CDATA\[|\]\]>/g, "").trim();
      const link = (block.match(/<link>([\s\S]*?)<\/link>/i)?.[1] ?? "").trim();
      const pubDate = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1] ?? "").trim();
      if (title) items.push({ title, source: name, link, pubDate });
    }
    return items;
  } catch { return []; }
}

async function fetchCuratedRss(niche: string): Promise<RssItem[]> {
  const c = CURATED[pickCuratedKey(niche)];
  if (!c) return [];
  const all = await Promise.all(c.newsRss.map((r) => fetchRssFeed(r.name, r.url)));
  return all.flat().slice(0, 25);
}

async function fetchTopIgFromCurated(apifyKey: string | undefined, niche: string, extra: string[]): Promise<IgPost[]> {
  if (!apifyKey) return [];
  const c = CURATED[pickCuratedKey(niche)];
  const handles = Array.from(new Set([...(c?.igHandles ?? []), ...extra])).slice(0, 5);
  if (handles.length === 0) return [];
  try {
    const endpoint = `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${apifyKey}&timeout=45`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        directUrls: handles.map((h) => `https://www.instagram.com/${h.replace(/^@/, "")}/`),
        resultsType: "posts",
        resultsLimit: 3,
        addParentData: false,
      }),
    });
    if (!res.ok) return [];
    const items = await res.json();
    if (!Array.isArray(items)) return [];
    return items.slice(0, 15).map((it: any) => ({
      ownerUsername: it.ownerUsername ?? "",
      caption: it.caption,
      likesCount: it.likesCount,
      commentsCount: it.commentsCount,
      videoPlayCount: it.videoPlayCount,
      url: it.url,
    }));
  } catch { return []; }
}


async function callGemini(geminiKey: string, userPrompt: string) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0.6,
        },
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini failed [${res.status}]: ${await res.text()}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini retornou vazio");
  const usage = data?.usageMetadata ?? {};
  return { result: JSON.parse(text), tokens: usage.totalTokenCount ?? 0 };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const t0 = Date.now();

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_AI_STUDIO_API_KEY");
    if (!GEMINI_KEY) throw new Error("GEMINI_API_KEY não configurada");

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { clientId, niche } = await req.json();
    if (!clientId) {
      return new Response(JSON.stringify({ error: "clientId obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: client } = await admin
      .from("clients").select("workspace_id, name, tags").eq("id", clientId).single();
    if (!client) throw new Error("Cliente não encontrado");
    let inferredIndustry: string | null = null;
    try {
      const t = client.tags ? (typeof client.tags === "string" ? JSON.parse(client.tags) : client.tags) : null;
      inferredIndustry = t?.industry ?? t?.niche ?? null;
    } catch { /* ignore */ }

    // Coleta sinais
    const { data: kws } = await admin.from("client_viral_keywords").select("keyword").eq("client_id", clientId);
    const keywords = (kws ?? []).map((k: any) => k.keyword as string);
    if (keywords.length === 0) {
      return new Response(JSON.stringify({ error: "Cliente sem keywords. Cadastre na aba Viral Hunter primeiro." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: comps } = await admin.from("client_viral_competitors")
      .select("platform, handle").eq("client_id", clientId).limit(20);

    // Insert pending
    const briefNiche = niche || inferredIndustry || "general";
    const { data: brief, error: insertErr } = await admin
      .from("viral_radar_briefs")
      .insert({
        client_id: clientId,
        workspace_id: client.workspace_id,
        user_id: userId,
        niche: briefNiche,
        status: "processing",
      })
      .select("id").single();
    if (insertErr) throw insertErr;
    const briefId = brief.id;

    try {
      const newsQuery = keywords.slice(0, 5).join(" OR ");
      const ytQuery = keywords.slice(0, 3).join(" | ");
      const competitorIgHandles = (comps ?? [])
        .filter((c: any) => c.platform === "instagram")
        .map((c: any) => c.handle);

      const [news, ytVideos, igTop, curatedRss, curatedIg] = await Promise.all([
        fetchNews(SUPABASE_URL, SUPABASE_ANON, newsQuery),
        fetchYouTube(SUPABASE_URL, SUPABASE_ANON, ytQuery),
        admin.from("instagram_posts")
          .select("caption, likes_count, comments_count, posted_at, url")
          .eq("client_id", clientId)
          .order("likes_count", { ascending: false })
          .limit(8)
          .then((r: any) => r.data ?? []),
        fetchCuratedRss(briefNiche),
        fetchTopIgFromCurated(APIFY_KEY, briefNiche, competitorIgHandles),
      ]);

      const sourcesSummary = {
        news_count: news.length,
        youtube_count: ytVideos.length,
        own_posts_count: igTop.length,
        curated_rss_count: curatedRss.length,
        curated_ig_count: curatedIg.length,
        keywords,
        competitors: (comps ?? []).map((c: any) => `${c.platform}:${c.handle}`),
        curated_niche: pickCuratedKey(briefNiche),
      };

      const userPrompt = `# CONTEXTO DO CLIENTE
- Nome: ${client.name}
- Nicho: ${briefNiche} (curated key: ${sourcesSummary.curated_niche})
- Keywords monitoradas: ${keywords.join(", ")}
- Competitors: ${sourcesSummary.competitors.join(", ") || "(nenhum)"}

# SINAIS DE HOJE

## 📰 Notícias Google News — ${news.length} itens
${news.map((n, i) => `${i + 1}. [${n.source}] ${n.title} (${new Date(n.publishedAt).toLocaleDateString("pt-BR")})`).join("\n") || "(sem notícias)"}

## 📡 Feeds curados do nicho — ${curatedRss.length} itens
${curatedRss.map((r, i) => `${i + 1}. [${r.source}] ${r.title}`).join("\n") || "(sem feeds curados)"}

## 🎬 YouTube top views (últimos 7 dias) — ${ytVideos.length} itens
${ytVideos.map((v, i) => `${i + 1}. [${v.channelTitle}] ${v.title} — ${v.viewCount?.toLocaleString() ?? "?"} views`).join("\n") || "(sem dados YouTube — API pode estar bloqueada)"}

## 🌐 Posts top de referência IG (curated + competitors) — ${curatedIg.length} itens
${curatedIg.map((p, i) => `${i + 1}. @${p.ownerUsername} (${p.likesCount?.toLocaleString() ?? "?"} likes): ${(p.caption ?? "").slice(0, 140).replace(/\n/g, " ")}…`).join("\n") || "(sem dados Apify)"}

## 📸 Posts top do próprio cliente (Instagram) — ${igTop.length} itens
${(igTop as any[]).map((p, i) => `${i + 1}. ${(p.caption ?? "").slice(0, 120)}… — ${p.likes_count} likes / ${p.comments_count} comments`).join("\n") || "(sem posts sincronizados)"}

# TAREFA
Gere o briefing JSON conforme schema. Foque no que é acionável nas próximas 24-48h.
Em cross_pollination identifique tópicos que aparecem em 2+ FONTES DIFERENTES (ex: news + YouTube + IG curated).`;


      const { result, tokens } = await callGemini(GEMINI_KEY, userPrompt);

      const cost = (tokens / 1_000_000) * 0.30; // gemini 2.5 flash blended
      const dur = Date.now() - t0;

      await admin
        .from("viral_radar_briefs")
        .update({
          narratives: result.narratives,
          hot_topics: result.hot_topics,
          carousel_ideas: result.carousel_ideas,
          cross_pollination: result.cross_pollination,
          sources_summary: sourcesSummary,
          model_used: GEMINI_MODEL,
          cost_usd: cost,
          duration_ms: dur,
          status: "done",
        })
        .eq("id", briefId);

      // Log AI usage
      await admin.from("ai_usage_logs").insert({
        client_id: clientId,
        feature: "generate-radar-brief",
        model: GEMINI_MODEL,
        tokens_used: tokens,
        cost_usd: cost,
      }).then(() => {}).catch(() => {});

      return new Response(
        JSON.stringify({ ok: true, briefId, brief: { ...result, sources_summary: sourcesSummary } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (innerErr: any) {
      const msg = innerErr?.message ?? String(innerErr);
      await admin.from("viral_radar_briefs")
        .update({ status: "error", error_message: msg, duration_ms: Date.now() - t0 })
        .eq("id", briefId);
      throw innerErr;
    }
  } catch (err: any) {
    console.error("[generate-radar-brief]", err);
    return new Response(JSON.stringify({ error: err?.message ?? "Erro inesperado" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
