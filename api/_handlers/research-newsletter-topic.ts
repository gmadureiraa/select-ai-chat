// Migrated from supabase/functions/research-newsletter-topic/index.ts
// Pesquisa em tempo real um tópico (foco cripto) usando Gemini com Google
// Search Grounding e enriquece com newsletter examples do client_content_library.
import { authedPost } from '../_lib/handler.js';
import { query } from '../_lib/db.js';
import { assertClientAccess } from '../_lib/access.js';
import { rateLimit, getRateLimitKey } from '../_lib/shared/rate-limit.js';

interface StatusError extends Error {
  status?: number;
  statusCode?: number;
}

type JsonRecord = Record<string, unknown>;

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
    groundingMetadata?: {
      groundingChunks?: Array<{
        web?: { uri?: string };
      }>;
    };
  }>;
}

interface NewsletterExampleRow {
  title: string;
  content: string | null;
}

function withStatus(err: Error, status: number): StatusError {
  const statusErr = err as StatusError;
  statusErr.status = status;
  statusErr.statusCode = status;
  return statusErr;
}

interface ResearchBody {
  topic: string;
  client_id: string;
  depth?: 'quick' | 'standard' | 'deep';
  include_newsletter_examples?: boolean;
  additional_queries?: string[];
}

interface ResearchResult {
  success: boolean;
  briefing: string;
  market_data: {
    prices: string[];
    metrics: string[];
    news: string[];
  };
  sources: string[];
  newsletter_examples: string[];
}

async function callGeminiGrounding(
  prompt: string,
  systemContext?: string
): Promise<{ content: string; sources: string[] }> {
  const apiKey =
    process.env.GOOGLE_AI_STUDIO_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_AI_STUDIO_API_KEY não configurada');

  const requestBody: JsonRecord = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    tools: [{ google_search: {} }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
  };
  if (systemContext) {
    requestBody.systemInstruction = { parts: [{ text: systemContext }] };
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    }
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Gemini grounding error ${response.status}: ${errorText.slice(0, 200)}`);
  }

  const result = await response.json() as GeminiResponse;
  const content = result?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const sources: string[] = [];
  const groundingMetadata = result?.candidates?.[0]?.groundingMetadata;
  if (groundingMetadata?.groundingChunks) {
    for (const chunk of groundingMetadata.groundingChunks) {
      if (chunk.web?.uri) sources.push(chunk.web.uri);
    }
  }
  return { content, sources };
}

export default authedPost(async ({ body, user, req, res }) => {
  const {
    topic,
    client_id,
    depth = 'standard',
    include_newsletter_examples = true,
    additional_queries = [],
  } = body as ResearchBody;

  if (!topic) throw new Error('topic is required');

  // SEC 2026-05-18 audit P1: handler aceitava `client_id` arbitrário e fazia
  // SELECT em client_content_library, vazando newsletters favoritas de outros
  // clientes pra qualquer user autenticado.
  if (client_id) {
    await assertClientAccess(user.id, client_id);
  }

  // Rate limit: cap 10/min — pesquisa dispara N Gemini grounding searches
  // (preço + métricas + news + queries adicionais).
  const rlKey = getRateLimitKey(req, 'research-newsletter', user.id);
  const rl = await rateLimit({ key: rlKey, limit: 10, windowMs: 60_000 });
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfterSec));
    throw withStatus(new Error(`Rate limit excedido (10/min). Tente em ${rl.retryAfterSec}s.`), 429);
  }

  console.log(`[research] starting for topic "${topic}" (depth: ${depth})`);

  // ===================================================
  // STEP 1: NEWSLETTER EXAMPLES FROM LIBRARY
  // ===================================================
  const newsletterExamples: string[] = [];
  if (include_newsletter_examples && client_id) {
    console.log('[research] fetching newsletter examples');
    const favorites = await query<NewsletterExampleRow>(
      `SELECT title, content
         FROM client_content_library
        WHERE client_id = $1
          AND content_type = 'newsletter'
          AND is_favorite = true
        ORDER BY created_at DESC
        LIMIT 3`,
      [client_id]
    );
    for (const fav of favorites) {
      newsletterExamples.push(
        `### ${fav.title}\n${(fav.content ?? '').substring(0, 2000)}`
      );
    }
    console.log(`[research] favorites: ${favorites.length}`);

    if (newsletterExamples.length < 2) {
      const recent = await query<NewsletterExampleRow>(
        `SELECT title, content
           FROM client_content_library
          WHERE client_id = $1
            AND content_type = 'newsletter'
          ORDER BY created_at DESC
          LIMIT $2`,
        [client_id, 5 - newsletterExamples.length]
      );
      for (const item of recent) {
        if (!newsletterExamples.some((e) => e.includes(item.title))) {
          newsletterExamples.push(
            `### ${item.title}\n${(item.content ?? '').substring(0, 2000)}`
          );
        }
      }
      console.log(`[research] total examples: ${newsletterExamples.length}`);
    }
  }

  // ===================================================
  // STEP 2: BUILD QUERIES
  // ===================================================
  const queries: string[] = [];

  const primaryQuery = `
Pesquise dados ATUAIS sobre: ${topic}

RETORNE OBRIGATORIAMENTE em formato estruturado:

## PREÇOS ATUAIS
- Bitcoin (BTC): preço atual em USD, variação 24h
- Ethereum (ETH): preço atual em USD, variação 24h
- Se o tópico mencionar outro token, inclua o preço dele também

## MÉTRICAS ON-CHAIN (se disponíveis)
- Supply Shock Ratio do Bitcoin
- Exchange Netflow (entradas/saídas das exchanges)
- MVRV Z-Score
- Dominância do Bitcoin
- Fear & Greed Index

## NOTÍCIAS E ANÁLISES RECENTES (últimas 48h)
- Principais notícias sobre o tema
- Eventos de mercado relevantes
- Análises de especialistas

## CONTEXTO DE MERCADO
- Tendência geral (alta, baixa, lateral)
- Sentimento do mercado
- Fatores que podem impactar

IMPORTANTE: Use APENAS dados verificados e atualizados. Cite as fontes.
`.trim();
  queries.push(primaryQuery);

  if (depth === 'deep' || depth === 'standard') {
    const tokenMatch = topic.match(
      /\b(BTC|ETH|SOL|ADA|XRP|DOT|AVAX|MATIC|LINK|UNI|Bitcoin|Ethereum|Solana|Cardano)\b/i
    );
    if (tokenMatch) {
      queries.push(
        `Análise técnica e on-chain detalhada do ${tokenMatch[1]}:
- Suporte e resistência principais
- Volume nas últimas 24h
- Movimentação de baleias
- Holders vs Traders ratio
- Dados do Glassnode ou CryptoQuant se disponíveis`
      );
    }
  }

  queries.push(...additional_queries);

  // ===================================================
  // STEP 3: EXECUTE GROUNDING
  // ===================================================
  const allSources: string[] = [];
  const researchResults: string[] = [];
  const systemContext = `Você é um analista de criptomoedas pesquisando dados em tempo real.
Retorne APENAS informações verificáveis e atualizadas.
Use formato estruturado com bullets e seções claras.
Inclua números específicos (preços, percentuais, métricas).
NÃO invente dados - se não encontrar, diga "dados não disponíveis".`;

  for (const q of queries) {
    try {
      console.log(`[research] grounding query: ${q.substring(0, 80)}...`);
      const result = await callGeminiGrounding(q, systemContext);
      researchResults.push(result.content);
      allSources.push(...result.sources);
      console.log(
        `[research] returned ${result.content.length} chars, ${result.sources.length} sources`
      );
    } catch (err) {
      console.error('[research] query failed:', err);
    }
  }

  // ===================================================
  // STEP 4: CONSOLIDATE
  // ===================================================
  let briefing = `# BRIEFING DE PESQUISA: ${topic}
*Pesquisado em: ${new Date().toISOString()}*

---

`;

  if (researchResults.length > 0) {
    briefing += `## 📊 DADOS DE MERCADO ATUAIS (Pesquisados via Google)\n\n`;
    briefing += researchResults.join('\n\n---\n\n');
    briefing += '\n\n';
  } else {
    briefing += `## ⚠️ PESQUISA LIMITADA
A pesquisa em tempo real não retornou resultados.
Use seu conhecimento geral sobre o tema, mas EVITE citar preços ou métricas específicas sem confirmar.

`;
  }

  if (allSources.length > 0) {
    briefing += `## 🔗 FONTES CONSULTADAS\n`;
    const uniqueSources = [...new Set(allSources)].slice(0, 10);
    uniqueSources.forEach((source, i) => {
      briefing += `[${i + 1}] ${source}\n`;
    });
    briefing += '\n';
  }

  if (newsletterExamples.length > 0) {
    briefing += `## 📰 NEWSLETTERS DE REFERÊNCIA (USE COMO MODELO DE ESTILO)\n`;
    briefing += `*Analise o tom, estrutura e profundidade analítica destes exemplos:*\n\n`;
    briefing += newsletterExamples.join('\n\n---\n\n');
    briefing += '\n\n';
  }

  const marketData = {
    prices: [] as string[],
    metrics: [] as string[],
    news: [] as string[],
  };
  const pricePattern = /(?:Bitcoin|BTC|Ethereum|ETH)\s*[:-]?\s*\$?([\d,.]+)/gi;
  for (const r of researchResults) {
    const matches = r.matchAll(pricePattern);
    for (const m of matches) marketData.prices.push(m[0]);
  }

  console.log(
    `[research] complete. briefing: ${briefing.length} chars, sources: ${allSources.length}`
  );

  const response: ResearchResult = {
    success: true,
    briefing,
    market_data: marketData,
    sources: [...new Set(allSources)],
    newsletter_examples: newsletterExamples,
  };
  return response;
});
