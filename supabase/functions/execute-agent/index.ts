import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logAIUsage } from "../_shared/ai-usage.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================
// SPECIALIZED AGENTS (General purpose)
// ============================================
type SpecializedAgentType = 
  | "content_writer"
  | "design_agent"
  | "metrics_analyst"
  | "email_developer"
  | "researcher"
  | "strategist";

// ============================================
// CONTENT-TYPE AGENTS (Specific formats)
// ============================================
type ContentAgentType = 
  | "newsletter_agent"
  | "email_marketing_agent"
  | "carousel_agent"
  | "static_post_agent"
  | "reels_agent"
  | "long_video_agent"
  | "tweet_agent"
  | "thread_agent"
  | "linkedin_agent"
  | "article_agent"
  | "blog_agent";

interface AgentConfig {
  systemPrompt: string;
  model: string;
  temperature: number;
  requiredData?: string[];
}

// Content-type specific agents with detailed prompts
const CONTENT_AGENT_CONFIGS: Record<ContentAgentType, AgentConfig> = {
  newsletter_agent: {
    systemPrompt: `Você é um especialista em criação de newsletters.

ESTRUTURA OBRIGATÓRIA:
1. ASSUNTO do email (provocativo, gere curiosidade, máx 50 caracteres)
2. PREVIEW TEXT (complemento do assunto, não repetitivo, máx 100 caracteres)
3. ABERTURA (gancho que prende o leitor nas primeiras 2 linhas)
4. CORPO (dividido em seções claras com subtítulos)
5. CTA principal (ação clara que você quer que o leitor tome)
6. FECHAMENTO (assinatura/despedida com personalidade)

REGRAS:
- Tom conversacional, como se estivesse escrevendo para um amigo
- Parágrafos curtos (máximo 3 linhas)
- Use bullet points para listas
- Inclua 1-2 links estratégicos`,
    model: "gemini-2.5-pro",
    temperature: 0.8,
    requiredData: ["identity_guide", "content_library", "copywriting_guide"]
  },

  email_marketing_agent: {
    systemPrompt: `Você é um especialista em email marketing e copywriting de vendas.

ESTRUTURA PARA EMAILS PROMOCIONAIS:
1. ASSUNTO (criar urgência ou curiosidade)
2. PREVIEW TEXT (complemento irresistível)
3. HEADLINE (benefício principal)
4. PROBLEMA (dor do público)
5. SOLUÇÃO (seu produto/oferta)
6. BENEFÍCIOS (bullet points)
7. PROVA SOCIAL (se disponível)
8. CTA claro e repetido
9. PS (gatilho final)

REGRAS:
- Foque em benefícios, não features
- Crie senso de urgência (sem ser forçado)
- Um CTA principal, repetido 2-3x
- Mobile-first (parágrafos curtos)`,
    model: "gemini-2.5-pro",
    temperature: 0.8,
    requiredData: ["identity_guide", "brand_assets"]
  },

  carousel_agent: {
    systemPrompt: `Você é um especialista em carrosséis de Instagram que viralizam.

ESTRUTURA OBRIGATÓRIA (até 10 slides):
- SLIDE 1 (CAPA): Headline impactante, promessa clara, gerar curiosidade
- SLIDES 2-8 (CONTEÚDO): Um ponto por slide, texto grande e legível
- SLIDE 9: Resumo ou conclusão
- SLIDE 10: CTA + "Salve para depois" + "Manda pra alguém"

REGRAS DE OURO:
- Headline da capa: máximo 8 palavras
- Cada slide: máximo 30 palavras
- Fonte legível (grande)
- Contraste alto
- Gancho que cria curiosidade para o próximo slide

FORMATO DE RESPOSTA:
Para cada slide retorne:
[SLIDE X]
TEXTO: "..."
VISUAL: descrição da imagem/design

LEGENDA:
Texto da legenda com hashtags (máx 5 relevantes)`,
    model: "gemini-2.5-pro",
    temperature: 0.8,
    requiredData: ["identity_guide", "visual_references", "content_library"]
  },

  static_post_agent: {
    systemPrompt: `Você é um especialista em posts estáticos de Instagram que engajam.

TIPOS DE POST:
1. QUOTE/FRASE: Frase impactante com design clean
2. DICA RÁPIDA: Uma dica acionável em uma imagem
3. MEME/TREND: Humor alinhado à marca
4. BASTIDORES: Conteúdo autêntico
5. ANTES/DEPOIS: Transformação visual

ESTRUTURA:
- TEXTO DO POST (máximo 20 palavras, fonte grande)
- DESCRIÇÃO VISUAL (como deve ser o design)
- LEGENDA (com gancho, conteúdo, CTA, hashtags)

REGRAS:
- Uma mensagem por post
- Contraste alto
- Primeira linha da legenda = gancho irresistível
- Máximo 5 hashtags relevantes`,
    model: "gemini-2.5-flash",
    temperature: 0.7,
    requiredData: ["identity_guide", "visual_references"]
  },

  reels_agent: {
    systemPrompt: `Você é um roteirista especialista em Reels e Shorts virais.

ESTRUTURA DO ROTEIRO (15-60 segundos):
GANCHO (0-3s): Frase que prende imediatamente
DESENVOLVIMENTO (3-45s): Conteúdo principal
TWIST/PAYOFF (45-55s): Surpresa ou conclusão
CTA (55-60s): O que fazer depois

FORMATO DO ROTEIRO:
[TEMPO] CENA | FALA/TEXTO | AÇÃO

EXEMPLO:
[0:00-0:03] CLOSE no rosto | "Para de scrollar se você..." | Expressão de surpresa
[0:03-0:08] PLANO MÉDIO | "Eu descobri que..." | Gestos explicativos

REGRAS:
- Gancho nos primeiros 2 segundos
- Cortes rápidos (máximo 5s por cena)
- Texto na tela para quem assiste sem som
- Vertical (9:16)`,
    model: "gemini-2.5-pro",
    temperature: 0.8,
    requiredData: ["identity_guide", "content_library"]
  },

  long_video_agent: {
    systemPrompt: `Você é um roteirista especialista em vídeos longos para YouTube.

ESTRUTURA DO VÍDEO:
1. GANCHO (0-30s): Por que assistir até o final?
2. INTRO (30s-1min): Quem você é + O que vão aprender
3. CONTEÚDO PRINCIPAL (dividido em capítulos)
4. RESUMO: Recapitulação dos pontos principais
5. CTA: Inscrição, like, comentário, próximo vídeo

FORMATO DO ROTEIRO:
## TÍTULO DO VÍDEO
## THUMBNAIL (descrição)
## DESCRIÇÃO (primeiras 3 linhas)

### CAPÍTULO 1: [TÍTULO] (MM:SS)
[VISUAL] Descrição do que aparece na tela
[FALA] O que dizer
[B-ROLL] Imagens de apoio

REGRAS:
- Duração ideal: 10-15 minutos
- Um capítulo a cada 2-3 minutos
- Pattern interrupts a cada 30-60 segundos
- Thumbnail com rosto + emoção + texto curto`,
    model: "gemini-2.5-pro",
    temperature: 0.7,
    requiredData: ["identity_guide", "content_library", "reference_library"]
  },

  tweet_agent: {
    systemPrompt: `Você é um especialista em tweets virais.

TIPOS DE TWEET QUE FUNCIONAM:
1. TAKE QUENTE: Opinião controversa (mas verdadeira)
2. INSIGHT: Sabedoria em uma frase
3. PERGUNTA: Gera engajamento nos replies
4. LISTA: "X coisas que..." 
5. HISTÓRIA EM 1 TWEET: Narrativa compacta

REGRAS DE OURO:
- Máximo 280 caracteres
- Primeira frase = gancho
- Uma ideia por tweet
- Sem hashtags (ou no máximo 1)
- Evite links no tweet principal
- Linguagem conversacional

FORMATO:
Retorne apenas o texto do tweet, pronto para publicar.`,
    model: "gemini-2.5-flash",
    temperature: 0.8,
    requiredData: ["identity_guide"]
  },

  thread_agent: {
    systemPrompt: `Você é um especialista em threads virais do Twitter/X.

ESTRUTURA DA THREAD:
TWEET 1 (GANCHO): Promessa irresistível + "🧵"
TWEETS 2-N (CONTEÚDO): Um ponto por tweet, fluxo narrativo
ÚLTIMO TWEET: Resumo + CTA + "Se foi útil, RT o primeiro tweet"

REGRAS:
- Gancho irresistível no tweet 1
- 5-15 tweets ideal
- Cada tweet faz sentido sozinho
- Numerar: 1/X, 2/X, etc.
- Espaçamento: 1 linha entre ideias
- Último tweet: pedir RT do primeiro

FORMATO:
1/X
[texto do tweet]

2/X
[texto do tweet]`,
    model: "gemini-2.5-pro",
    temperature: 0.8,
    requiredData: ["identity_guide", "content_library"]
  },

  linkedin_agent: {
    systemPrompt: `Você é um especialista em posts de LinkedIn que engajam.

ESTRUTURA DO POST:
1. GANCHO (primeiras 2 linhas, antes do "ver mais")
2. HISTÓRIA ou INSIGHT (desenvolvimento)
3. LIÇÃO ou TAKEAWAY
4. CTA ou PERGUNTA (gerar comentários)

FORMATOS QUE FUNCIONAM:
- Storytelling pessoal com lição
- Lista de dicas/insights
- Contrarian takes (opinião diferente)
- Behind the scenes
- Celebração de conquista (humilde)

REGRAS:
- Primeira linha = gatilho emocional
- Parágrafos de 1-2 linhas
- Espaços entre parágrafos
- 1200-1500 caracteres ideal
- Máximo 3 hashtags
- Terminar com pergunta para gerar comments`,
    model: "gemini-2.5-flash",
    temperature: 0.7,
    requiredData: ["identity_guide"]
  },

  article_agent: {
    systemPrompt: `Você é um especialista em artigos de formato longo.

ESTRUTURA DO ARTIGO:
1. TÍTULO (SEO + Curiosidade)
2. SUBTÍTULO (expande a promessa)
3. INTRODUÇÃO (gancho + contexto + promessa)
4. CORPO (H2s e H3s bem estruturados)
5. CONCLUSÃO (resumo + próximos passos)

FORMATAÇÃO:
- H2 para seções principais
- H3 para sub-seções
- Bullet points para listas
- Citações em destaque

REGRAS:
- 1500-3000 palavras
- Parágrafos curtos (3-4 linhas)
- Subtítulos a cada 300-400 palavras
- Linguagem clara e acessível
- Exemplos práticos`,
    model: "gemini-2.5-pro",
    temperature: 0.6,
    requiredData: ["identity_guide", "reference_library", "global_knowledge"]
  },

  blog_agent: {
    systemPrompt: `Você é um especialista em blog posts otimizados para SEO.

ESTRUTURA DO POST:
1. TÍTULO (palavra-chave + benefício)
2. META DESCRIPTION (150-160 caracteres)
3. INTRODUÇÃO (problema + promessa)
4. CORPO (H2s, H3s, bullets)
5. CONCLUSÃO + CTA

SEO CHECKLIST:
- Palavra-chave no título
- Palavra-chave no primeiro parágrafo
- H2s incluem variações da palavra-chave
- Alt text para imagens
- Links internos e externos

REGRAS:
- 1000-2000 palavras
- Escaneabilidade (bullets, negritos)
- Um CTA claro
- Responder a intenção de busca`,
    model: "gemini-2.5-pro",
    temperature: 0.5,
    requiredData: ["identity_guide", "global_knowledge"]
  }
};

// General specialized agents (fallback/orchestration)
const SPECIALIZED_AGENT_CONFIGS: Record<SpecializedAgentType, AgentConfig> = {
  content_writer: {
    systemPrompt: `Você é um Escritor de Conteúdo especializado da Kaleidos.

SUAS CAPACIDADES:
- Criar posts para redes sociais (Twitter, Instagram, LinkedIn)
- Escrever newsletters envolventes
- Produzir artigos e blog posts
- Criar copy para anúncios
- Desenvolver scripts de vídeo

REGRAS:
- SEMPRE siga o tom de voz e estilo do cliente
- Use os exemplos da biblioteca como referência
- Seja criativo mas consistente com a marca
- Entregue conteúdo pronto para publicar`,
    model: "gemini-2.5-pro",
    temperature: 0.8
  },
  
  design_agent: {
    systemPrompt: `Você é um Designer Visual especializado da Kaleidos.

SUAS CAPACIDADES:
- Criar prompts otimizados para geração de imagens
- Aplicar brand guidelines e estilos visuais
- Sugerir composições e layouts
- Adaptar visuais para diferentes plataformas

REGRAS:
- Use os brand assets do cliente como base
- Siga as referências visuais fornecidas
- Descreva imagens em detalhes técnicos`,
    model: "gemini-2.5-flash",
    temperature: 0.7
  },
  
  metrics_analyst: {
    systemPrompt: `Você é um Analista de Métricas especializado da Kaleidos.

SUAS CAPACIDADES:
- Analisar dados de performance de redes sociais
- Identificar tendências e padrões
- Comparar períodos e benchmarks
- Gerar insights acionáveis

REGRAS:
- Use APENAS os dados fornecidos - nunca invente números
- Cite as fontes dos dados nas respostas
- Seja preciso com porcentagens e crescimentos
- Destaque insights mais relevantes primeiro`,
    model: "gemini-2.5-flash",
    temperature: 0.3
  },
  
  email_developer: {
    systemPrompt: `Você é um Desenvolvedor de Email especializado.

SUAS CAPACIDADES:
- Criar templates HTML responsivos
- Desenvolver layouts para newsletters
- Otimizar emails para diferentes clientes

REGRAS:
- Use HTML inline styling para compatibilidade
- Siga boas práticas de acessibilidade
- Aplique brand assets do cliente`,
    model: "gemini-2.5-pro",
    temperature: 0.5
  },
  
  researcher: {
    systemPrompt: `Você é um Pesquisador especializado da Kaleidos.

SUAS CAPACIDADES:
- Pesquisar tendências de mercado
- Analisar concorrência
- Curar referências de qualidade
- Sintetizar informações complexas

REGRAS:
- Use os dados e referências fornecidas
- Seja objetivo e factual
- Organize informações de forma clara`,
    model: "gemini-2.5-flash",
    temperature: 0.4
  },
  
  strategist: {
    systemPrompt: `Você é um Estrategista de Marketing especializado.

SUAS CAPACIDADES:
- Planejar campanhas de marketing
- Criar calendários editoriais
- Definir estratégias de conteúdo
- Estabelecer KPIs e metas

REGRAS:
- Baseie estratégias em dados disponíveis
- Considere recursos e capacidades do cliente
- Seja específico e acionável`,
    model: "gemini-2.5-pro",
    temperature: 0.6
  }
};

// Detect content type from template name
function detectContentTypeFromName(name: string): ContentAgentType | null {
  const patterns: Record<ContentAgentType, RegExp[]> = {
    newsletter_agent: [/newsletter/i, /news\s*letter/i],
    email_marketing_agent: [/email\s*marketing/i, /email\s*promocional/i],
    carousel_agent: [/carrossel/i, /carousel/i, /carrosel/i],
    static_post_agent: [/post\s*(estático|único|simples)/i, /imagem\s*instagram/i],
    reels_agent: [/reels?/i, /shorts?/i, /vídeo\s*curto/i],
    long_video_agent: [/vídeo\s*longo/i, /youtube/i, /roteiro\s*vídeo/i],
    tweet_agent: [/tweet\s*(único|simples)?$/i, /^tweet$/i],
    thread_agent: [/thread/i, /fio/i],
    linkedin_agent: [/linkedin/i],
    article_agent: [/artigo/i, /article/i],
    blog_agent: [/blog/i]
  };

  for (const [agentType, regexes] of Object.entries(patterns)) {
    if (regexes.some(r => r.test(name))) {
      return agentType as ContentAgentType;
    }
  }
  return null;
}

async function callGemini(
  systemPrompt: string,
  userPrompt: string,
  model: string,
  temperature: number
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const GOOGLE_API_KEY = Deno.env.get("GOOGLE_AI_STUDIO_API_KEY");
  if (!GOOGLE_API_KEY) throw new Error("GOOGLE_AI_STUDIO_API_KEY não configurada");

  const geminiModel = model.replace("google/", "");
  
  const requestBody = {
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: {
      temperature,
      maxOutputTokens: 8192,
    }
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${GOOGLE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[AGENT] Gemini error:", errorText);
    throw new Error(`Gemini error: ${response.status}`);
  }

  const data = await response.json();
  
  return {
    content: data.candidates?.[0]?.content?.parts?.[0]?.text || "",
    inputTokens: data.usageMetadata?.promptTokenCount || 0,
    outputTokens: data.usageMetadata?.candidatesTokenCount || 0
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const {
      agentType,
      contentType,       // NEW: specific content type (carousel_agent, newsletter_agent, etc.)
      templateName,      // NEW: template name to detect content type
      templateRules,     // NEW: custom rules from database
      stepId,
      userMessage,
      clientContext,
      previousOutputs,
      userId,
      clientId
    } = await req.json();

    console.log(`[AGENT:${agentType}] Executing step: ${stepId} for client: ${clientId}`);
    console.log(`[AGENT:${agentType}] Content type: ${contentType}, Template: ${templateName}`);

    // Determine which config to use
    let config: AgentConfig;
    let activeContentAgent: ContentAgentType | null = null;
    
    // If content_writer and we have a specific content type, use the specialized config
    if (agentType === "content_writer") {
      // Try to determine content agent from contentType or templateName
      activeContentAgent = (contentType as ContentAgentType) || 
                          (templateName ? detectContentTypeFromName(templateName) : null);
      
      if (activeContentAgent && CONTENT_AGENT_CONFIGS[activeContentAgent]) {
        config = CONTENT_AGENT_CONFIGS[activeContentAgent];
        console.log(`[AGENT] Using content-specific agent: ${activeContentAgent}`);
      } else {
        config = SPECIALIZED_AGENT_CONFIGS.content_writer;
        console.log(`[AGENT] Using general content_writer agent`);
      }
    } else {
      config = SPECIALIZED_AGENT_CONFIGS[agentType as SpecializedAgentType];
    }
    
    if (!config) {
      throw new Error(`Unknown agent type: ${agentType}`);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ========================================
    // BUSCAR DADOS AUTOMATICAMENTE DO BANCO
    // O agente decide o que precisa baseado no tipo
    // ========================================
    
    let contentLibrary: any[] = [];
    let structureExamples: any[] = []; // NEW: Examples for structure matching
    let referenceLibrary: any[] = [];
    let visualReferences: any[] = [];
    let brandAssets: any = null;
    let instagramPosts: any[] = [];
    let youtubeVideos: any[] = [];
    let platformMetrics: any[] = [];
    let globalKnowledge: any[] = [];
    let clientDocuments: any[] = [];

    // Map content agent to content_type in database
    const agentToContentType: Record<string, string[]> = {
      newsletter_agent: ["newsletter", "email"],
      email_marketing_agent: ["email", "email_marketing"],
      carousel_agent: ["carousel", "carrossel"],
      static_post_agent: ["post", "instagram_post", "image"],
      reels_agent: ["reels", "short_video", "video"],
      long_video_agent: ["video", "youtube", "long_video"],
      tweet_agent: ["tweet"],
      thread_agent: ["thread"],
      linkedin_agent: ["linkedin"],
      article_agent: ["article", "artigo"],
      blog_agent: ["blog", "blog_post"]
    };

    // Buscar dados baseado no tipo de agente
    if (clientId) {
      console.log(`[AGENT:${agentType}] Fetching data for client...`);
      
      // Content Writer precisa de biblioteca de conteúdo e referências
      if (agentType === "content_writer" || agentType === "strategist" || agentType === "researcher") {
        // First: Get structure examples matching the content type
        if (activeContentAgent && agentToContentType[activeContentAgent]) {
          const matchingTypes = agentToContentType[activeContentAgent];
          console.log(`[AGENT] Fetching structure examples for types: ${matchingTypes.join(", ")}`);
          
          // Fetch examples of the SAME content type for structure reference
          const { data: examples } = await supabase
            .from("client_content_library")
            .select("id, title, content_type, content, metadata")
            .eq("client_id", clientId)
            .in("content_type", matchingTypes)
            .order("created_at", { ascending: false })
            .limit(3); // Get best 3 examples
          structureExamples = examples || [];
          console.log(`[AGENT] Found ${structureExamples.length} structure examples`);
        }
        
        // Also get general content for context (different types)
        const { data: content } = await supabase
          .from("client_content_library")
          .select("id, title, content_type, content, metadata")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false })
          .limit(10);
        contentLibrary = content || [];
        
        const { data: refs } = await supabase
          .from("client_reference_library")
          .select("id, title, reference_type, content, source_url")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false })
          .limit(10);
        referenceLibrary = refs || [];
      }

      // Design Agent precisa de brand assets e referências visuais
      if (agentType === "design_agent" || agentType === "email_developer") {
        const { data: client } = await supabase
          .from("clients")
          .select("brand_assets")
          .eq("id", clientId)
          .single();
        brandAssets = client?.brand_assets;
        
        const { data: visuals } = await supabase
          .from("client_visual_references")
          .select("id, title, image_url, reference_type, is_primary, description")
          .eq("client_id", clientId)
          .order("is_primary", { ascending: false })
          .limit(10);
        visualReferences = visuals || [];
      }

      // Metrics Analyst precisa de métricas e posts
      if (agentType === "metrics_analyst") {
        const { data: instagram } = await supabase
          .from("instagram_posts")
          .select("id, caption, posted_at, likes, comments, saves, shares, reach, impressions, engagement_rate, post_type")
          .eq("client_id", clientId)
          .order("posted_at", { ascending: false })
          .limit(30);
        instagramPosts = instagram || [];
        
        const { data: youtube } = await supabase
          .from("youtube_videos")
          .select("id, title, published_at, total_views, watch_hours, impressions, click_rate, subscribers_gained")
          .eq("client_id", clientId)
          .order("published_at", { ascending: false })
          .limit(20);
        youtubeVideos = youtube || [];
        
        const { data: metrics } = await supabase
          .from("platform_metrics")
          .select("*")
          .eq("client_id", clientId)
          .order("metric_date", { ascending: false })
          .limit(30);
        platformMetrics = metrics || [];
      }

      // Todos agentes podem usar documentos do cliente
      const { data: docs } = await supabase
        .from("client_documents")
        .select("id, name, file_type, extracted_content")
        .eq("client_id", clientId)
        .limit(5);
      clientDocuments = docs || [];
    }

    // Buscar knowledge base global
    if (agentType === "researcher" || agentType === "strategist" || agentType === "content_writer") {
      // Buscar workspace_id do cliente
      const { data: clientData } = await supabase
        .from("clients")
        .select("workspace_id")
        .eq("id", clientId)
        .single();
      
      if (clientData?.workspace_id) {
        const { data: knowledge } = await supabase
          .from("global_knowledge")
          .select("id, title, content, category, summary")
          .eq("workspace_id", clientData.workspace_id)
          .limit(5);
        globalKnowledge = knowledge || [];
      }
    }

    // Build context-aware prompt
    let contextPrompt = `## CONTEXTO DO CLIENTE:
**Nome:** ${clientContext?.name || "Cliente"}
**Descrição:** ${clientContext?.description || "Não disponível"}

## GUIA DE IDENTIDADE:
${clientContext?.identityGuide || "Não disponível"}
`;

    // ADD STRUCTURE EXAMPLES FIRST (most important for format matching)
    if (structureExamples.length > 0) {
      contextPrompt += `\n## 📐 EXEMPLOS DE ESTRUTURA DO CLIENTE (SIGA ESTE FORMATO!):\n`;
      contextPrompt += `**IMPORTANTE:** Use estes exemplos como referência para manter a mesma estrutura, tom e estilo que o cliente já usa.\n\n`;
      structureExamples.forEach((c, i) => {
        contextPrompt += `### EXEMPLO ${i + 1}: "${c.title}" (${c.content_type})\n`;
        contextPrompt += `\`\`\`\n${c.content}\n\`\`\`\n\n`;
      });
      contextPrompt += `**INSTRUÇÕES DE ESTRUTURA:**
- Mantenha a MESMA estrutura de seções/blocos dos exemplos acima
- Copie o ESTILO de escrita e tom de voz
- Use formatação similar (emojis, bullets, espaçamento)
- Adapte o conteúdo novo para seguir este padrão\n\n`;
    }

    // Add general content library for context
    if (contentLibrary.length > 0) {
      contextPrompt += `\n## BIBLIOTECA DE CONTEÚDO (${contentLibrary.length} itens):\n`;
      contentLibrary.slice(0, 5).forEach((c, i) => {
        contextPrompt += `\n[${i + 1}] **${c.title}** (${c.content_type}):\n${c.content?.substring(0, 400)}...\n`;
      });
    }

    if (referenceLibrary.length > 0) {
      contextPrompt += `\n## REFERÊNCIAS (${referenceLibrary.length} itens):\n`;
      referenceLibrary.slice(0, 3).forEach((r, i) => {
        contextPrompt += `\n[REF ${i + 1}] **${r.title}** (${r.reference_type}):\n${r.content?.substring(0, 300)}...\n`;
      });
    }

    if (visualReferences.length > 0) {
      contextPrompt += `\n## REFERÊNCIAS VISUAIS (${visualReferences.length} imagens):\n`;
      visualReferences.slice(0, 5).forEach((v, i) => {
        contextPrompt += `- ${v.title || "Sem título"} (${v.reference_type})${v.is_primary ? " ⭐ Principal" : ""}: ${v.description || ""}\n`;
      });
    }

    if (brandAssets) {
      contextPrompt += `\n## BRAND ASSETS:\n${JSON.stringify(brandAssets, null, 2)}\n`;
    }

    if (instagramPosts.length > 0) {
      contextPrompt += `\n## POSTS DO INSTAGRAM (${instagramPosts.length} posts recentes):\n`;
      const topPosts = instagramPosts.slice(0, 10);
      const avgEngagement = topPosts.reduce((sum, p) => sum + (p.engagement_rate || 0), 0) / topPosts.length;
      contextPrompt += `Taxa de engajamento média: ${(avgEngagement * 100).toFixed(2)}%\n`;
      topPosts.forEach((p, i) => {
        contextPrompt += `[${i + 1}] ${p.post_type} - ${p.likes || 0} likes, ${p.comments || 0} comments, ${p.saves || 0} saves\n`;
      });
    }

    if (youtubeVideos.length > 0) {
      contextPrompt += `\n## VÍDEOS DO YOUTUBE (${youtubeVideos.length} recentes):\n`;
      youtubeVideos.slice(0, 5).forEach((v, i) => {
        contextPrompt += `[${i + 1}] "${v.title}" - ${v.total_views || 0} views, ${v.watch_hours?.toFixed(1) || 0}h assistidas\n`;
      });
    }

    if (platformMetrics.length > 0) {
      contextPrompt += `\n## MÉTRICAS DE PLATAFORMAS:\n`;
      const latestByPlatform: Record<string, any> = {};
      platformMetrics.forEach(m => {
        if (!latestByPlatform[m.platform]) latestByPlatform[m.platform] = m;
      });
      Object.entries(latestByPlatform).forEach(([platform, m]) => {
        contextPrompt += `- **${platform}**: ${m.subscribers || 0} inscritos, ${m.engagement_rate ? (m.engagement_rate * 100).toFixed(2) : 0}% engajamento\n`;
      });
    }

    if (globalKnowledge.length > 0) {
      contextPrompt += `\n## BASE DE CONHECIMENTO GLOBAL:\n`;
      globalKnowledge.slice(0, 3).forEach((k, i) => {
        contextPrompt += `[${i + 1}] **${k.title}** (${k.category}): ${k.summary || k.content?.substring(0, 200)}...\n`;
      });
    }

    if (clientDocuments.length > 0) {
      contextPrompt += `\n## DOCUMENTOS DO CLIENTE:\n`;
      clientDocuments.forEach((d, i) => {
        if (d.extracted_content) {
          contextPrompt += `[${i + 1}] **${d.name}** (${d.file_type}):\n${d.extracted_content.substring(0, 300)}...\n`;
        }
      });
    }

    // Add previous outputs if any
    if (previousOutputs && Object.keys(previousOutputs).length > 0) {
      contextPrompt += `\n## OUTPUTS DE AGENTES ANTERIORES:\n`;
      for (const [agent, output] of Object.entries(previousOutputs)) {
        contextPrompt += `\n### ${agent}:\n${output}\n`;
      }
    }

    // Add custom template rules if provided
    if (templateRules && templateRules.length > 0) {
      contextPrompt += `\n## REGRAS PERSONALIZADAS DO TEMPLATE:\n`;
      templateRules.forEach((rule: any, i: number) => {
        if (rule.type === 'text') {
          contextPrompt += `${i + 1}. ${rule.content}\n`;
        }
      });
    }

    const fullPrompt = `${contextPrompt}

## TAREFA:
${userMessage}`;

    console.log(`[AGENT:${agentType}] Context built with ${contentLibrary.length} content, ${referenceLibrary.length} refs, ${visualReferences.length} visuals, ${instagramPosts.length} posts`);

    const startTime = Date.now();
    const result = await callGemini(
      config.systemPrompt,
      fullPrompt,
      config.model,
      config.temperature
    );
    const durationMs = Date.now() - startTime;

    // Log usage
    if (userId) {
      await logAIUsage(
        supabase,
        userId,
        config.model,
        `execute-agent/${agentType}`,
        result.inputTokens,
        result.outputTokens,
        { clientId, stepId, agentType }
      );
    }

    console.log(`[AGENT:${agentType}] Completed in ${durationMs}ms`);

    return new Response(JSON.stringify({
      success: true,
      stepId,
      agentType,
      output: result.content,
      durationMs,
      tokens: {
        input: result.inputTokens,
        output: result.outputTokens
      },
      dataSources: {
        structureExamples: structureExamples.length,
        contentLibrary: contentLibrary.length,
        referenceLibrary: referenceLibrary.length,
        visualReferences: visualReferences.length,
        instagramPosts: instagramPosts.length,
        youtubeVideos: youtubeVideos.length,
        globalKnowledge: globalKnowledge.length
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[AGENT] Error:", error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
