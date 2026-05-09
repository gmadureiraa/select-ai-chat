// Cron handler: daily brief generation per client.
// Schedule: daily 8:00 UTC (~5am BR).
// Auth: x-vercel-cron OR Bearer $CRON_SECRET.
//
// Pipeline (per client with active radar sources):
//  1. Aggregate signals from last 24h (filtered by client's niche when set):
//     - top news (12)
//     - top IG posts (10)
//     - top TikTok posts (10)
//     - top Threads posts (8)        ← added 2026-05-08
//     - top Twitter posts (10)        ← added 2026-05-08
//     - top LinkedIn posts (8)        ← added 2026-05-08
//  2. Build prompt → call Gemini 2.5 Flash → JSON brief.
//  3. UPSERT into viral_radar_briefs (one per client per day).
//
// Idempotência: skip se brief de hoje já existe pra esse client.
// Fail-safe: erros em 1 client não derrubam os demais.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';
import { query, queryOne } from '../_lib/db.js';
import {
  getClientContextServer,
  buildClientPromptContext,
} from '../_lib/shared/client-context.js';

const GEMINI_MODEL = 'gemini-2.5-flash';

const SYSTEM_INSTRUCTION =
  `Você é o "Radar Viral" — analisa sinais de mercado em tempo real (notícias, posts virais IG, TikTok, Threads, X/Twitter e LinkedIn) e gera um briefing operacional pro time de conteúdo do cliente.

REGRAS:
1. Use APENAS os sinais reais fornecidos. Não invente fatos.
2. Cite fontes em narrativas/hot_topics (ex: "CoinTelegraph 06/05", "@coinbureau", "LinkedIn Bernstein").
3. Português brasileiro. Tom direto.
4. Foco no acionável nas próximas 24-48h.
5. cross_pollination: tópicos que aparecem em 2+ plataformas (peso especial quando aparece em 3+).
6. carousel_ideas: 3-5 ideias com hook + ângulo claro.
7. Quando um sinal vier do LinkedIn ou X com autor verificado, considere peso institucional maior.`;

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
      items: {
        type: 'object',
        properties: { hook: { type: 'string' }, angle: { type: 'string' } },
        required: ['hook', 'angle'],
      },
    },
    cross_pollination: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          topic: { type: 'string' },
          sources: { type: 'array', items: { type: 'string' } },
        },
        required: ['topic', 'sources'],
      },
    },
  },
  required: ['narratives', 'hot_topics', 'carousel_ideas', 'cross_pollination'],
};

interface ClientRow {
  id: string;
  name: string;
  workspace_id: string;
  user_id: string;
  niche: string | null;
}

interface NewsRow {
  title: string;
  source_name: string | null;
  summary: string | null;
  url: string;
  published_at: string | null;
}

interface IgRow {
  caption: string | null;
  likes: number;
  comments: number;
  permalink: string | null;
  posted_at: string | null;
  owner: string | null;
}

interface TiktokRow {
  caption: string | null;
  views: number;
  likes: number;
  author: string | null;
  url: string;
  posted_at: string | null;
}

interface ThreadsRow {
  text_content: string | null;
  author_handle: string | null;
  likes: number;
  reposts: number;
  replies: number;
  url: string;
  posted_at: string | null;
}

interface TwitterRow {
  text_content: string | null;
  author_handle: string | null;
  is_thread: boolean;
  likes: number;
  retweets: number;
  views: number;
  url: string;
  posted_at: string | null;
}

interface LinkedInRow {
  text_content: string | null;
  author_name: string | null;
  author_headline: string | null;
  reactions: number;
  comments: number;
  shares: number;
  url: string;
  posted_at: string | null;
  post_type: string | null;
}

interface BriefResponse {
  narratives: Array<{ title: string; why: string; signals: string[] }>;
  hot_topics: Array<{ topic: string; signal_count: number; source_summary: string }>;
  carousel_ideas: Array<{ hook: string; angle: string }>;
  cross_pollination: Array<{ topic: string; sources: string[] }>;
}

const HOURS_BACK = 24;

// ─── Pickers ────────────────────────────────────────────────────────
// Phase E: gera brief pra TODOS clientes (Free/Starter/Pro/Enterprise),
// não só os com fontes per-client. Brief usa fontes globais como fallback,
// e quando o cliente tem fontes próprias, elas vão pro mesmo signal pool
// já que todas são lidas da mesma tabela.
async function pickClientsWithSources(): Promise<ClientRow[]> {
  // 1. Tenta clientes com fontes próprias (per-client) primeiro
  const withSources = await query<ClientRow>(
    `SELECT DISTINCT c.id, c.name, c.workspace_id, c.user_id,
            COALESCE(vts.niche, 'general') AS niche
       FROM clients c
       INNER JOIN viral_tracked_sources vts
         ON vts.client_id = c.id
        AND COALESCE(vts.is_active, true) = true
      ORDER BY c.name
      LIMIT 100`,
  ).catch(() => []);

  if (withSources.length > 0) {
    // Combinar com clientes sem fontes próprias mas com workspace ativo,
    // pra que TODOS planos recebam brief baseado em sinais globais.
    const withoutSources = await query<ClientRow>(
      `SELECT c.id, c.name, c.workspace_id, c.user_id, 'general' AS niche
         FROM clients c
        WHERE c.id NOT IN (
          SELECT DISTINCT client_id
            FROM viral_tracked_sources
           WHERE client_id IS NOT NULL
             AND COALESCE(is_active, true) = true
        )
        ORDER BY c.name
        LIMIT 50`,
    ).catch(() => []);
    return [...withSources, ...withoutSources];
  }

  // 2. Fallback: todos os clientes ativos (early-launch — sem fontes per-client ainda)
  const allClients = await query<ClientRow>(
    `SELECT c.id, c.name, c.workspace_id, c.user_id, 'general' AS niche
       FROM clients c
      ORDER BY c.name
      LIMIT 50`,
  ).catch(() => []);
  return allClients;
}

// ─── Push notification fan-out ──────────────────────────────────────
// Notifica todo workspace member quando o brief do dia fica pronto.
// Fire-and-forget (não bloqueia a geração dos próximos briefs).
async function notifyBriefReady(
  baseUrl: string,
  cronSecret: string,
  client: ClientRow,
  brief: BriefResponse,
): Promise<void> {
  try {
    const topNarrative = brief.narratives?.[0]?.title ?? null;
    const ideaCount = brief.carousel_ideas?.length ?? 0;
    const body = topNarrative
      ? `${topNarrative}${ideaCount > 0 ? ` • ${ideaCount} ideias` : ''}`
      : `Brief diário pronto${ideaCount > 0 ? ` • ${ideaCount} ideias` : ''}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    await fetch(`${baseUrl}/api/send-push-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cronSecret}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        workspaceId: client.workspace_id,
        payload: {
          title: `Radar Viral — ${client.name}`,
          body: body.slice(0, 140),
          tag: `radar-brief-${client.id}`,
          data: {
            type: 'radar_brief',
            client_id: client.id,
            url: `/clients/${client.id}/radar`,
          },
        },
      }),
    }).catch(() => null);
    clearTimeout(timeout);
  } catch {
    // ignore — notification is best-effort
  }
}

async function collectSignals(niche: string | null, keywords: string[] = []) {
  const cutoff = new Date(Date.now() - HOURS_BACK * 3_600_000).toISOString();
  const nicheFilter = niche ?? null;
  const kwFilter = keywords.length > 0 ? keywords : null;

  const [news, ig, tiktok, threads, twitter, linkedin] = await Promise.all([
    // News: filter by niche AND, when keywords are present, require at least one
    // keyword to be present in title/summary (case-insensitive). When no keywords
    // are configured we fall back to niche-only filter (legacy behavior).
    query<NewsRow>(
      `SELECT title, source_name, summary, url, published_at
         FROM viral_news_articles
        WHERE ($1::text IS NULL OR niche = $1)
          AND COALESCE(published_at, scraped_at) >= $2
          AND (
            $3::text[] IS NULL
            OR EXISTS (
              SELECT 1 FROM unnest($3::text[]) AS kw
               WHERE title ILIKE '%' || kw || '%'
                  OR COALESCE(summary, '') ILIKE '%' || kw || '%'
            )
          )
        ORDER BY COALESCE(published_at, scraped_at) DESC
        LIMIT 12`,
      [nicheFilter, cutoff, kwFilter],
    ).catch(() => []),
    query<IgRow>(
      `SELECT caption, likes, comments, permalink, posted_at,
              metadata->>'owner_username' AS owner
         FROM instagram_posts
        WHERE COALESCE(posted_at, created_at) >= $1
        ORDER BY likes DESC NULLS LAST
        LIMIT 10`,
      [cutoff],
    ).catch(() => []),
    query<TiktokRow>(
      `SELECT caption, COALESCE(views,0) AS views, COALESCE(likes,0) AS likes,
              author, url, posted_at
         FROM viral_tiktok_posts
        WHERE ($1::text IS NULL OR niche = $1)
          AND COALESCE(posted_at, scraped_at) >= $2
        ORDER BY views DESC NULLS LAST
        LIMIT 10`,
      [nicheFilter, cutoff],
    ).catch(() => []),
    query<ThreadsRow>(
      `SELECT text_content, author_handle,
              COALESCE(likes,0) AS likes, COALESCE(reposts,0) AS reposts,
              COALESCE(replies,0) AS replies, url, posted_at
         FROM viral_threads_posts
        WHERE ($1::text IS NULL OR niche = $1)
          AND COALESCE(posted_at, scraped_at) >= $2
        ORDER BY likes DESC NULLS LAST
        LIMIT 8`,
      [nicheFilter, cutoff],
    ).catch(() => []),
    query<TwitterRow>(
      `SELECT text_content, author_handle, COALESCE(is_thread,false) AS is_thread,
              COALESCE(likes,0) AS likes, COALESCE(retweets,0) AS retweets,
              COALESCE(views,0) AS views, url, posted_at
         FROM viral_twitter_posts
        WHERE ($1::text IS NULL OR niche = $1)
          AND COALESCE(posted_at, scraped_at) >= $2
        ORDER BY likes DESC NULLS LAST
        LIMIT 10`,
      [nicheFilter, cutoff],
    ).catch(() => []),
    query<LinkedInRow>(
      `SELECT text_content, author_name, author_headline,
              COALESCE(reactions,0) AS reactions,
              COALESCE(comments,0) AS comments,
              COALESCE(shares,0) AS shares,
              url, posted_at, post_type
         FROM viral_linkedin_posts
        WHERE ($1::text IS NULL OR niche = $1)
          AND COALESCE(posted_at, scraped_at) >= $2
        ORDER BY reactions DESC NULLS LAST
        LIMIT 8`,
      [nicheFilter, cutoff],
    ).catch(() => []),
  ]);

  return { news, ig, tiktok, threads, twitter, linkedin };
}

function buildPrompt(
  client: ClientRow,
  signals: Awaited<ReturnType<typeof collectSignals>>,
  contextBlock: string = ''
): string {
  const niche = client.niche || 'geral';
  return [
    contextBlock,
    `Cliente: ${client.name} | Nicho: ${niche}`,
    `Janela: últimas ${HOURS_BACK}h.`,
    '',
    `# 📰 Notícias (${signals.news.length})`,
    signals.news.length === 0
      ? '(sem notícias na janela)'
      : signals.news.map((n) =>
          `- [${n.source_name ?? 'fonte'}] ${n.title}${n.summary ? ` — ${n.summary.slice(0, 120)}` : ''}`,
        ).join('\n'),
    '',
    `# 📸 Instagram top posts (${signals.ig.length})`,
    signals.ig.length === 0
      ? '(sem posts IG na janela)'
      : signals.ig.map((p) =>
          `- @${p.owner ?? '?'} ❤${p.likes} 💬${p.comments} · ${(p.caption ?? '').slice(0, 140)}`,
        ).join('\n'),
    '',
    `# 🎵 TikTok top videos (${signals.tiktok.length})`,
    signals.tiktok.length === 0
      ? '(sem TikToks na janela)'
      : signals.tiktok.map((t) =>
          `- @${t.author ?? '?'} ▶${t.views} ❤${t.likes} · ${(t.caption ?? '').slice(0, 140)}`,
        ).join('\n'),
    '',
    `# 🧵 Threads top posts (${signals.threads.length})`,
    signals.threads.length === 0
      ? '(sem Threads na janela)'
      : signals.threads.map((t) =>
          `- @${t.author_handle ?? '?'} ❤${t.likes} 🔁${t.reposts} 💬${t.replies} · ${(t.text_content ?? '').slice(0, 140)}`,
        ).join('\n'),
    '',
    `# 🐦 X / Twitter top posts (${signals.twitter.length})`,
    signals.twitter.length === 0
      ? '(sem tweets na janela)'
      : signals.twitter.map((t) =>
          `- @${t.author_handle ?? '?'}${t.is_thread ? ' [thread]' : ''} ❤${t.likes} 🔁${t.retweets} ▶${t.views} · ${(t.text_content ?? '').slice(0, 140)}`,
        ).join('\n'),
    '',
    `# 💼 LinkedIn top posts (${signals.linkedin.length})`,
    signals.linkedin.length === 0
      ? '(sem posts LinkedIn na janela)'
      : signals.linkedin.map((p) =>
          `- ${p.author_name ?? '?'}${p.author_headline ? ` (${p.author_headline.slice(0, 50)})` : ''} 👍${p.reactions} 💬${p.comments} 🔁${p.shares} [${p.post_type ?? 'text'}] · ${(p.text_content ?? '').slice(0, 140)}`,
        ).join('\n'),
    '',
    'Gere o brief em JSON conforme schema fornecido.',
  ].join('\n');
}

async function generateBrief(
  client: ClientRow,
  signals: Awaited<ReturnType<typeof collectSignals>>,
  contextBlock: string = '',
): Promise<BriefResponse | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const prompt = buildPrompt(client, signals, contextBlock);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.7,
      topP: 0.9,
      maxOutputTokens: 4000,
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90_000),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    console.warn(`[brief] gemini ${res.status}: ${t.slice(0, 200)}`);
    return null;
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;
  try {
    return JSON.parse(text) as BriefResponse;
  } catch (err) {
    console.warn('[brief] JSON parse error', err);
    return null;
  }
}

// ─── Handler ────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res);
  if (req.method !== 'POST' && req.method !== 'GET') {
    return jsonError(res, 405, 'Method not allowed');
  }

  const cronSecret = process.env.CRON_SECRET;
  const isCron =
    req.headers['x-vercel-cron'] === '1' ||
    (cronSecret && req.headers.authorization === `Bearer ${cronSecret}`);
  if (!isCron) {
    return jsonError(res, 401, 'Unauthorized');
  }

  const t0 = Date.now();
  const dry = String(req.query.dry || '') === 'true';
  const today = new Date().toISOString().slice(0, 10);

  const proto = req.headers['x-forwarded-proto'] ?? 'https';
  const host = req.headers.host;
  const baseUrl = `${proto}://${host}`;

  const clients = await pickClientsWithSources();
  if (clients.length === 0) {
    return res.status(200).json({
      ok: true,
      skipped: 'No clients with active radar sources',
      duration_ms: Date.now() - t0,
    });
  }

  if (dry) {
    const sample = await Promise.all(clients.slice(0, 3).map(async (c) => {
      const ctx = await getClientContextServer(c.id).catch(() => null);
      const keywords = ctx?.keywords.map((k) => k.keyword) ?? [];
      const sig = await collectSignals(c.niche, keywords);
      return {
        client: c.name,
        niche: c.niche,
        keywords_count: keywords.length,
        signals: {
          news: sig.news.length,
          ig: sig.ig.length,
          tiktok: sig.tiktok.length,
          threads: sig.threads.length,
          twitter: sig.twitter.length,
          linkedin: sig.linkedin.length,
        },
      };
    }));
    return res.status(200).json({
      ok: true,
      dry: true,
      date: today,
      clients: clients.length,
      sample,
      duration_ms: Date.now() - t0,
    });
  }

  const detail: Array<{ client: string; status: string; counts?: any }> = [];
  let okCount = 0;
  let skippedCount = 0;
  let errCount = 0;

  for (const client of clients) {
    try {
      // Idempotency: skip if today's brief already exists
      const existing = await queryOne<{ id: string }>(
        `SELECT id FROM viral_radar_briefs
          WHERE client_id = $1 AND brief_date = $2::date
          LIMIT 1`,
        [client.id, today],
      ).catch(() => null);

      if (existing) {
        detail.push({ client: client.name, status: 'already_exists' });
        skippedCount++;
        continue;
      }

      // Per-client context: feeds keyword filter + voice-aware brief prompt
      const clientCtx = await getClientContextServer(client.id).catch(() => null);
      const keywords = clientCtx?.keywords.map((k) => k.keyword) ?? [];
      const signals = await collectSignals(client.niche, keywords);
      const total =
        signals.news.length + signals.ig.length + signals.tiktok.length +
        signals.threads.length + signals.twitter.length + signals.linkedin.length;
      // Threshold reduzido pra 1 (era 3) — clientes sem IG/TikTok scrapeados
      // ainda recebem brief baseado em news global. Sem isso, briefs nunca eram
      // criados pra clientes que só usam fontes RSS globais.
      if (total < 1) {
        detail.push({
          client: client.name,
          status: `skipped_low_signals_${total}`,
          counts: {
            news: signals.news.length,
            ig: signals.ig.length,
            tiktok: signals.tiktok.length,
            threads: signals.threads.length,
            twitter: signals.twitter.length,
            linkedin: signals.linkedin.length,
          },
        });
        skippedCount++;
        continue;
      }

      const contextBlock = buildClientPromptContext(clientCtx);
      const brief = await generateBrief(client, signals, contextBlock);
      if (!brief) {
        detail.push({ client: client.name, status: 'gemini_failed' });
        errCount++;
        continue;
      }

      const counts = {
        news: signals.news.length,
        ig: signals.ig.length,
        tiktok: signals.tiktok.length,
        threads: signals.threads.length,
        twitter: signals.twitter.length,
        linkedin: signals.linkedin.length,
      };

      await query(
        `INSERT INTO viral_radar_briefs (
           client_id, workspace_id, user_id, niche, brief_date,
           narratives, hot_topics, carousel_ideas, cross_pollination,
           sources_summary, model_used, cost_usd, duration_ms, status
         ) VALUES (
           $1, $2, $3, $4, $5::date,
           $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb,
           $10::jsonb, $11, $12, $13, 'done'
         )`,
        [
          client.id,
          client.workspace_id,
          client.user_id,
          client.niche ?? 'general',
          today,
          JSON.stringify(brief.narratives ?? []),
          JSON.stringify(brief.hot_topics ?? []),
          JSON.stringify(brief.carousel_ideas ?? []),
          JSON.stringify(brief.cross_pollination ?? []),
          JSON.stringify(counts),
          GEMINI_MODEL,
          0.0001,
          Date.now() - t0,
        ],
      );

      // Fire-and-forget push notification (best-effort; non-blocking)
      void notifyBriefReady(baseUrl, cronSecret ?? '', client, brief);

      detail.push({
        client: client.name,
        status: `ok (${brief.narratives?.length ?? 0}n / ${brief.hot_topics?.length ?? 0}t / ${brief.carousel_ideas?.length ?? 0}i)`,
        counts,
      });
      okCount++;
    } catch (err: any) {
      const msg = err?.message || String(err);
      detail.push({ client: client.name, status: `error: ${msg.slice(0, 100)}` });
      errCount++;
    }
  }

  return res.status(200).json({
    ok: true,
    date: today,
    clients: clients.length,
    ok_count: okCount,
    skipped: skippedCount,
    errors: errCount,
    detail,
    duration_ms: Date.now() - t0,
  });
}
