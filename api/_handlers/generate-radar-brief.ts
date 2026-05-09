// Migrated from supabase/functions/generate-radar-brief/index.ts
import { authedPost } from '../_lib/handler.js';
import { getPool, query, queryOne, insertRow } from '../_lib/db.js';

const GEMINI_MODEL = 'gemini-2.5-flash';

const SYSTEM_INSTRUCTION = `Você é o "Radar Viral" — analisa sinais de mercado em tempo real (notícias, vídeos virais, posts top de competidores, posts do próprio cliente) e gera um briefing operacional pro time de conteúdo.

REGRAS:
1. Trabalhe APENAS com os sinais reais fornecidos. NÃO invente fatos.
2. Cite fontes em narrativas/hot_topics (ex: "InfoMoney 04/05", "@investidor4.20").
3. Português brasileiro. Tom direto.
4. Foque no acionável nas próximas 24-48h.
5. Cross-pollination: tópicos em 2+ fontes simultâneas.
6. Carousel ideas: 3-5 com hook + ângulo.`;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    narratives: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          why: { type: 'string' },
          signals: { type: 'array', items: { type: 'string' } },
        },
        required: ['title', 'why', 'signals'],
      },
    },
    hot_topics: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          topic: { type: 'string' },
          signal_count: { type: 'integer' },
          source_summary: { type: 'string' },
        },
        required: ['topic', 'signal_count', 'source_summary'],
      },
    },
    carousel_ideas: {
      type: 'array',
      items: { type: 'object', properties: { hook: { type: 'string' }, angle: { type: 'string' } }, required: ['hook', 'angle'] },
    },
    cross_pollination: {
      type: 'array',
      items: {
        type: 'object',
        properties: { topic: { type: 'string' }, sources: { type: 'array', items: { type: 'string' } } },
        required: ['topic', 'sources'],
      },
    },
  },
  required: ['narratives', 'hot_topics', 'carousel_ideas', 'cross_pollination'],
};

const CURATED: Record<string, { igHandles: string[]; newsRss: { name: string; url: string }[] }> = {
  crypto: {
    igHandles: ['investidor4.20', 'leobueno_', 'mercadobitcoin', 'documentingbtc'],
    newsRss: [
      { name: 'Cointelegraph BR', url: 'https://br.cointelegraph.com/rss' },
      { name: 'Portal do Bitcoin', url: 'https://portaldobitcoin.uol.com.br/feed/' },
      { name: 'Livecoins', url: 'https://livecoins.com.br/feed/' },
      { name: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/' },
    ],
  },
  marketing: {
    igHandles: ['leadgenman', 'matheus.chibebe', 'hormozi', 'garyvee'],
    newsRss: [
      { name: 'Marketing Brew', url: 'https://www.marketingbrew.com/feed' },
      { name: 'Search Engine Land', url: 'https://searchengineland.com/feed' },
      { name: 'MeioMensagem', url: 'https://www.meioemensagem.com.br/feed/' },
    ],
  },
  ai: {
    igHandles: ['openai', 'anthropicai', 'ogmadureira', 'hugodoria'],
    newsRss: [
      { name: 'Hugging Face', url: 'https://huggingface.co/blog/feed.xml' },
      { name: 'OpenAI Blog', url: 'https://openai.com/blog/rss.xml' },
      { name: 'VentureBeat AI', url: 'https://venturebeat.com/category/ai/feed/' },
    ],
  },
};

function pickCuratedKey(niche: string): string {
  const n = (niche || '').toLowerCase();
  if (/(crypto|cripto|bitcoin|defi|web3|blockchain)/.test(n)) return 'crypto';
  if (/(ai|ia|llm|gpt|inteligência|inteligencia)/.test(n)) return 'ai';
  return 'marketing';
}

async function fetchRssFeed(name: string, url: string) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 kAI-Radar' } });
    if (!r.ok) return [];
    const xml = await r.text();
    const items: any[] = [];
    for (const block of (xml.match(/<item[\s\S]*?<\/item>/gi) ?? []).slice(0, 5)) {
      const title = (block.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? '').replace(/<!\[CDATA\[|\]\]>/g, '').trim();
      const link = (block.match(/<link>([\s\S]*?)<\/link>/i)?.[1] ?? '').trim();
      const pubDate = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1] ?? '').trim();
      if (title) items.push({ title, source: name, link, pubDate });
    }
    return items;
  } catch {
    return [];
  }
}

async function fetchCuratedRss(niche: string) {
  const c = CURATED[pickCuratedKey(niche)];
  if (!c) return [];
  const all = await Promise.all(c.newsRss.map((r) => fetchRssFeed(r.name, r.url)));
  return all.flat().slice(0, 25);
}

async function fetchGoogleNews(q: string) {
  try {
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=pt-BR&gl=BR&ceid=BR:pt`;
    const r = await fetch(rssUrl, { headers: { 'User-Agent': 'Mozilla/5.0 kAI-Radar' } });
    if (!r.ok) return [];
    const xml = await r.text();
    const items: any[] = [];
    for (const block of (xml.match(/<item[\s\S]*?<\/item>/gi) ?? []).slice(0, 15)) {
      const get = (tag: string) => {
        const m = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i').exec(block);
        return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';
      };
      const title = get('title');
      const source = title.split(' - ').pop() || 'Fonte';
      const realTitle = title.split(' - ').slice(0, -1).join(' - ') || title;
      if (title) items.push({ title: realTitle, source, url: get('link'), publishedAt: get('pubDate') });
    }
    return items;
  } catch {
    return [];
  }
}

async function callGemini(geminiKey: string, userPrompt: string) {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA, temperature: 0.6 },
      }),
    }
  );
  if (!r.ok) throw new Error(`Gemini failed [${r.status}]: ${await r.text()}`);
  const data = await r.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini retornou vazio');
  const usage = data?.usageMetadata ?? {};
  return { result: JSON.parse(text), tokens: usage.totalTokenCount ?? 0 };
}

export default authedPost(async ({ user, body }) => {
  const t0 = Date.now();
  const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_STUDIO_API_KEY;
  if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY não configurada');

  const { clientId, niche } = body;
  if (!clientId) throw new Error('clientId obrigatório');

  const client = await queryOne<any>(`SELECT workspace_id, name, tags FROM clients WHERE id = $1`, [clientId]);
  if (!client) throw new Error('Cliente não encontrado');
  let inferredIndustry: string | null = null;
  try {
    const t = client.tags ? (typeof client.tags === 'string' ? JSON.parse(client.tags) : client.tags) : null;
    inferredIndustry = t?.industry ?? t?.niche ?? null;
  } catch {}

  const kws = await query<any>(`SELECT keyword FROM client_viral_keywords WHERE client_id = $1`, [clientId]);
  const keywords = (kws ?? []).map((k: any) => k.keyword);
  if (keywords.length === 0) throw new Error('Cliente sem keywords. Cadastre na aba Viral Hunter primeiro.');

  const comps = await query<any>(`SELECT platform, handle FROM client_viral_competitors WHERE client_id = $1 LIMIT 20`, [clientId]);

  const briefNiche = niche || inferredIndustry || 'general';
  const brief = await insertRow<any>('viral_radar_briefs', {
    client_id: clientId,
    workspace_id: client.workspace_id,
    user_id: user.id,
    niche: briefNiche,
    status: 'processing',
  });
  const briefId = brief.id;

  try {
    const newsQuery = keywords.slice(0, 5).join(' OR ');
    const [news, igTop, curatedRss] = await Promise.all([
      fetchGoogleNews(newsQuery),
      query<any>(
        `SELECT caption,
                likes AS likes_count,
                comments AS comments_count,
                posted_at,
                permalink AS url
           FROM instagram_posts
          WHERE client_id = $1
          ORDER BY likes DESC NULLS LAST
          LIMIT 8`,
        [clientId]
      ),
      fetchCuratedRss(briefNiche),
    ]);

    const sourcesSummary = {
      news_count: news.length,
      youtube_count: 0,
      own_posts_count: igTop.length,
      curated_rss_count: curatedRss.length,
      curated_ig_count: 0,
      keywords,
      competitors: (comps ?? []).map((c: any) => `${c.platform}:${c.handle}`),
      curated_niche: pickCuratedKey(briefNiche),
    };

    const userPrompt = `# CONTEXTO DO CLIENTE
- Nome: ${client.name}
- Nicho: ${briefNiche} (curated key: ${sourcesSummary.curated_niche})
- Keywords monitoradas: ${keywords.join(', ')}
- Competitors: ${sourcesSummary.competitors.join(', ') || '(nenhum)'}

# SINAIS DE HOJE

## Notícias Google News — ${news.length} itens
${news.map((n: any, i: number) => `${i + 1}. [${n.source}] ${n.title}`).join('\n') || '(sem notícias)'}

## Feeds curados do nicho — ${curatedRss.length} itens
${curatedRss.map((r: any, i: number) => `${i + 1}. [${r.source}] ${r.title}`).join('\n') || '(sem feeds curados)'}

## Posts top do próprio cliente (Instagram) — ${igTop.length} itens
${(igTop as any[]).map((p, i) => `${i + 1}. ${(p.caption ?? '').slice(0, 120)}… — ${p.likes_count} likes / ${p.comments_count} comments`).join('\n') || '(sem posts sincronizados)'}

# TAREFA
Gere o briefing JSON. Foque no acionável nas próximas 24-48h.`;

    const { result, tokens } = await callGemini(GEMINI_KEY, userPrompt);
    const cost = (tokens / 1_000_000) * 0.3;
    const dur = Date.now() - t0;

    await getPool().query(
      `UPDATE viral_radar_briefs SET
         narratives = $1::jsonb, hot_topics = $2::jsonb,
         carousel_ideas = $3::jsonb, cross_pollination = $4::jsonb,
         sources_summary = $5::jsonb, model_used = $6, cost_usd = $7,
         duration_ms = $8, status = 'done'
       WHERE id = $9`,
      [
        JSON.stringify(result.narratives),
        JSON.stringify(result.hot_topics),
        JSON.stringify(result.carousel_ideas),
        JSON.stringify(result.cross_pollination),
        JSON.stringify(sourcesSummary),
        GEMINI_MODEL,
        cost,
        dur,
        briefId,
      ]
    );

    return { ok: true, briefId, brief: { ...result, sources_summary: sourcesSummary } };
  } catch (innerErr: any) {
    const msg = innerErr?.message ?? String(innerErr);
    await getPool().query(
      `UPDATE viral_radar_briefs SET status = 'error', error_message = $1, duration_ms = $2 WHERE id = $3`,
      [msg, Date.now() - t0, briefId]
    );
    throw innerErr;
  }
});
