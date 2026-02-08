import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { callLLMWithGrounding, callLLM, LLMError } from "../_shared/llm.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ResearchRequest {
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
  error?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { 
      topic, 
      client_id, 
      depth = 'standard',
      include_newsletter_examples = true,
      additional_queries = []
    }: ResearchRequest = await req.json();

    if (!topic) {
      throw new Error('Topic is required for research');
    }

    console.log(`[RESEARCH] Starting research for topic: "${topic}" (depth: ${depth})`);

    // ===================================================
    // STEP 1: FETCH NEWSLETTER EXAMPLES (if enabled)
    // ===================================================
    const newsletterExamples: string[] = [];
    
    if (include_newsletter_examples && client_id) {
      console.log('[RESEARCH] Fetching newsletter examples from library...');
      
      // First try to get favorite newsletters
      const { data: favorites } = await supabase
        .from('client_content_library')
        .select('title, content')
        .eq('client_id', client_id)
        .eq('content_type', 'newsletter')
        .eq('is_favorite', true)
        .order('created_at', { ascending: false })
        .limit(3);
      
      if (favorites && favorites.length > 0) {
        for (const fav of favorites) {
          newsletterExamples.push(
            `### ${fav.title}\n${fav.content?.substring(0, 2000) || ''}`
          );
        }
        console.log(`[RESEARCH] Found ${favorites.length} favorite newsletters`);
      }
      
      // If not enough favorites, get recent ones
      if (newsletterExamples.length < 2) {
        const { data: recent } = await supabase
          .from('client_content_library')
          .select('title, content')
          .eq('client_id', client_id)
          .eq('content_type', 'newsletter')
          .order('created_at', { ascending: false })
          .limit(5 - newsletterExamples.length);
        
        if (recent) {
          for (const item of recent) {
            if (!newsletterExamples.some(e => e.includes(item.title))) {
              newsletterExamples.push(
                `### ${item.title}\n${item.content?.substring(0, 2000) || ''}`
              );
            }
          }
        }
        console.log(`[RESEARCH] Total newsletter examples: ${newsletterExamples.length}`);
      }
    }

    // ===================================================
    // STEP 2: BUILD RESEARCH QUERIES
    // ===================================================
    const queries: string[] = [];
    
    // Primary topic query with crypto focus
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
`;
    queries.push(primaryQuery);

    // Add depth-specific queries
    if (depth === 'deep' || depth === 'standard') {
      // Token-specific deep dive if mentioned
      const tokenMatch = topic.match(/\b(BTC|ETH|SOL|ADA|XRP|DOT|AVAX|MATIC|LINK|UNI|Bitcoin|Ethereum|Solana|Cardano)\b/i);
      if (tokenMatch) {
        queries.push(`
Análise técnica e on-chain detalhada do ${tokenMatch[1]}:
- Suporte e resistência principais
- Volume nas últimas 24h
- Movimentação de baleias
- Holders vs Traders ratio
- Dados do Glassnode ou CryptoQuant se disponíveis
`);
      }
    }

    // Add user-provided queries
    queries.push(...additional_queries);

    // ===================================================
    // STEP 3: EXECUTE GROUNDING RESEARCH
    // ===================================================
    const allSources: string[] = [];
    const researchResults: string[] = [];

    for (const query of queries) {
      try {
        console.log(`[RESEARCH] Executing grounding query: ${query.substring(0, 80)}...`);
        
        const result = await callLLMWithGrounding(query, `
Você é um analista de criptomoedas pesquisando dados em tempo real.
Retorne APENAS informações verificáveis e atualizadas.
Use formato estruturado com bullets e seções claras.
Inclua números específicos (preços, percentuais, métricas).
NÃO invente dados - se não encontrar, diga "dados não disponíveis".
`);
        
        researchResults.push(result.content);
        allSources.push(...result.sources);
        
        console.log(`[RESEARCH] Query returned ${result.content.length} chars, ${result.sources.length} sources`);
      } catch (error) {
        console.error(`[RESEARCH] Query failed:`, error);
        // Continue with other queries
      }
    }

    // ===================================================
    // STEP 4: CONSOLIDATE INTO STRUCTURED BRIEFING
    // ===================================================
    let briefing = `# BRIEFING DE PESQUISA: ${topic}
*Pesquisado em: ${new Date().toISOString()}*

---

`;

    // Add research results
    if (researchResults.length > 0) {
      briefing += `## 📊 DADOS DE MERCADO ATUAIS (Pesquisados via Google)\n\n`;
      briefing += researchResults.join('\n\n---\n\n');
      briefing += '\n\n';
    } else {
      // Fallback if grounding failed
      briefing += `## ⚠️ PESQUISA LIMITADA
A pesquisa em tempo real não retornou resultados. 
Use seu conhecimento geral sobre o tema, mas EVITE citar preços ou métricas específicas sem confirmar.

`;
    }

    // Add sources
    if (allSources.length > 0) {
      briefing += `## 🔗 FONTES CONSULTADAS\n`;
      const uniqueSources = [...new Set(allSources)].slice(0, 10);
      uniqueSources.forEach((source, i) => {
        briefing += `[${i + 1}] ${source}\n`;
      });
      briefing += '\n';
    }

    // Add newsletter examples
    if (newsletterExamples.length > 0) {
      briefing += `## 📰 NEWSLETTERS DE REFERÊNCIA (USE COMO MODELO DE ESTILO)\n`;
      briefing += `*Analise o tom, estrutura e profundidade analítica destes exemplos:*\n\n`;
      briefing += newsletterExamples.join('\n\n---\n\n');
      briefing += '\n\n';
    }

    // Parse market data for structured response
    const marketData = {
      prices: [] as string[],
      metrics: [] as string[],
      news: [] as string[],
    };

    // Extract prices from results
    const pricePattern = /(?:Bitcoin|BTC|Ethereum|ETH)\s*[:\-]?\s*\$?([\d,.]+)/gi;
    for (const result of researchResults) {
      const matches = result.matchAll(pricePattern);
      for (const match of matches) {
        marketData.prices.push(match[0]);
      }
    }

    console.log(`[RESEARCH] Complete. Briefing: ${briefing.length} chars, Sources: ${allSources.length}`);

    const response: ResearchResult = {
      success: true,
      briefing,
      market_data: marketData,
      sources: [...new Set(allSources)],
      newsletter_examples: newsletterExamples,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[RESEARCH] Error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        briefing: '',
        market_data: { prices: [], metrics: [], news: [] },
        sources: [],
        newsletter_examples: [],
        error: error instanceof Error ? error.message : 'Research failed',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
