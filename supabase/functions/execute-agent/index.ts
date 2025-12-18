import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logAIUsage } from "../_shared/ai-usage.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SpecializedAgentType = 
  | "content_writer"
  | "design_agent"
  | "metrics_analyst"
  | "email_developer"
  | "researcher"
  | "strategist";

interface AgentConfig {
  systemPrompt: string;
  model: string;
  temperature: number;
}

const AGENT_CONFIGS: Record<SpecializedAgentType, AgentConfig> = {
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
- Entregue conteúdo pronto para publicar

FORMATO DE RESPOSTA:
Retorne o conteúdo final pronto, formatado corretamente para a plataforma alvo.`,
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
- Descreva imagens em detalhes técnicos
- Considere formatos e proporções de cada plataforma

FORMATO DE RESPOSTA:
Retorne um prompt detalhado para geração de imagem + especificações técnicas.`,
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
- Recomendar estratégias baseadas em dados

REGRAS:
- Use APENAS os dados fornecidos - nunca invente números
- Cite as fontes dos dados nas respostas
- Seja preciso com porcentagens e crescimentos
- Destaque insights mais relevantes primeiro

FORMATO DE RESPOSTA:
- Resumo executivo
- Métricas principais
- Insights e tendências
- Recomendações`,
    model: "gemini-2.5-flash",
    temperature: 0.3
  },
  
  email_developer: {
    systemPrompt: `Você é um Desenvolvedor de Email especializado da Kaleidos.

SUAS CAPACIDADES:
- Criar templates HTML responsivos
- Desenvolver layouts para newsletters
- Otimizar emails para diferentes clientes
- Criar sequências de automação

REGRAS:
- Use HTML inline styling para compatibilidade
- Teste em diferentes clientes de email
- Siga boas práticas de acessibilidade
- Aplique brand assets do cliente

FORMATO DE RESPOSTA:
Retorne o código HTML completo do template, pronto para uso.`,
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
- Identificar oportunidades

REGRAS:
- Use os dados e referências fornecidas
- Seja objetivo e factual
- Organize informações de forma clara
- Destaque o que é mais relevante para o cliente

FORMATO DE RESPOSTA:
- Resumo da pesquisa
- Principais descobertas
- Referências relevantes
- Recomendações`,
    model: "gemini-2.5-flash",
    temperature: 0.4
  },
  
  strategist: {
    systemPrompt: `Você é um Estrategista de Marketing especializado da Kaleidos.

SUAS CAPACIDADES:
- Planejar campanhas de marketing
- Criar calendários editoriais
- Definir estratégias de conteúdo
- Estabelecer KPIs e metas
- Desenvolver roadmaps de execução

REGRAS:
- Baseie estratégias em dados disponíveis
- Considere recursos e capacidades do cliente
- Seja específico e acionável
- Defina prazos realistas

FORMATO DE RESPOSTA:
- Objetivo da estratégia
- Plano de ação detalhado
- Cronograma
- KPIs e métricas de sucesso`,
    model: "gemini-2.5-pro",
    temperature: 0.6
  }
};

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
      stepId,
      userMessage,
      clientContext,
      previousOutputs,
      userId,
      clientId
    } = await req.json();

    console.log(`[AGENT:${agentType}] Executing step: ${stepId} for client: ${clientId}`);

    const config = AGENT_CONFIGS[agentType as SpecializedAgentType];
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
    let referenceLibrary: any[] = [];
    let visualReferences: any[] = [];
    let brandAssets: any = null;
    let instagramPosts: any[] = [];
    let youtubeVideos: any[] = [];
    let platformMetrics: any[] = [];
    let globalKnowledge: any[] = [];
    let clientDocuments: any[] = [];

    // Buscar dados baseado no tipo de agente
    if (clientId) {
      console.log(`[AGENT:${agentType}] Fetching data for client...`);
      
      // Content Writer precisa de biblioteca de conteúdo e referências
      if (agentType === "content_writer" || agentType === "strategist" || agentType === "researcher") {
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

    // Add fetched data based on agent type
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
