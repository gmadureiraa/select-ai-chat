import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Constantes
const MAX_IDENTITY_GUIDE_LENGTH = 8000;
const MAX_CITED_CONTENT_LENGTH = 12000;
const MAX_HISTORY_MESSAGES = 15;
const MAX_METRICS_CONTEXT_LENGTH = 4000;

// Planos que têm acesso ao kAI Chat
const ALLOWED_PLANS = ["pro", "enterprise", "agency"];

interface Citation {
  id: string;
  type: "content" | "reference" | "format";
  title: string;
}

interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

interface RequestBody {
  message: string;
  clientId: string;
  citations?: Citation[];
  history?: HistoryMessage[];
}

// ============================================
// INTENT DETECTION HELPERS
// ============================================

function isMetricsQuery(message: string): boolean {
  const patterns = [
    /m[eé]trica/i,
    /performance/i,
    /estat[ií]stica/i,
    /engajamento/i,
    /seguidores/i,
    /crescimento/i,
    /alcance/i,
    /impress[oõ]es/i,
    /visualiza[cç][oõ]es/i,
    /likes/i,
    /coment[aá]rios/i,
    /compartilhamentos/i,
    /views/i,
    /inscritos/i,
    /subscribers/i,
    /analytics/i,
    /relat[oó]rio/i,
    /report/i,
    /dados\s+(do|da|de)/i,
    /como\s+(est[aá]|foi|anda)/i,
    /resultado/i,
  ];
  return patterns.some(p => p.test(message));
}

function isReportRequest(message: string): boolean {
  const patterns = [
    /gerar?\s+relat[oó]rio/i,
    /criar?\s+relat[oó]rio/i,
    /fazer?\s+relat[oó]rio/i,
    /an[aá]lise\s+completa/i,
    /report\s+completo/i,
    /relat[oó]rio\s+de\s+performance/i,
    /relat[oó]rio\s+de\s+m[eé]tricas/i,
    /resumo\s+de\s+performance/i,
    /overview\s+completo/i,
  ];
  return patterns.some(p => p.test(message));
}

function isWebSearchQuery(message: string): boolean {
  const patterns = [
    /pesquise?\s+(sobre|por)/i,
    /busque?\s+(sobre|por)/i,
    /procure?\s+(sobre|por)/i,
    /o\s+que\s+[eé]/i,
    /quem\s+[eé]/i,
    /not[ií]cias\s+(sobre|de)/i,
    /tend[eê]ncias?\s+(de|em|sobre)/i,
    /atualiza[cç][oõ]es?\s+(sobre|de)/i,
    /me\s+conte\s+sobre/i,
    /me\s+fale\s+sobre/i,
  ];
  return patterns.some(p => p.test(message));
}

// ============================================
// METRICS CONTEXT BUILDER
// ============================================

async function fetchMetricsContext(
  supabase: any,
  clientId: string
): Promise<string> {
  // Fetch last 30 days of metrics
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const [metricsResult, postsResult] = await Promise.all([
    supabase
      .from("platform_metrics")
      .select("*")
      .eq("client_id", clientId)
      .gte("metric_date", thirtyDaysAgo.toISOString().split("T")[0])
      .order("metric_date", { ascending: false })
      .limit(60),
    supabase
      .from("instagram_posts")
      .select("caption, likes, comments, saves, shares, reach, engagement_rate, posted_at, post_type")
      .eq("client_id", clientId)
      .order("posted_at", { ascending: false })
      .limit(20),
  ]);

  const metrics: any[] = metricsResult.data || [];
  const posts: any[] = postsResult.data || [];

  if (metrics.length === 0 && posts.length === 0) {
    return "";
  }

  let context = "\n## Dados de Performance do Cliente\n";

  // Group metrics by platform
  const byPlatform: Record<string, any[]> = {};
  for (const m of metrics) {
    if (!byPlatform[m.platform]) byPlatform[m.platform] = [];
    byPlatform[m.platform].push(m);
  }

  for (const [platform, platformMetrics] of Object.entries(byPlatform)) {
    const latest = platformMetrics[0];
    const oldest = platformMetrics[platformMetrics.length - 1];
    
    context += `\n### ${platform.charAt(0).toUpperCase() + platform.slice(1)}\n`;
    
    if (latest.followers || latest.subscribers) {
      const current = latest.followers || latest.subscribers || 0;
      const previous = oldest.followers || oldest.subscribers || 0;
      const growth = current - previous;
      const growthPct = previous > 0 ? ((growth / previous) * 100).toFixed(1) : "N/A";
      context += `- Seguidores/Inscritos: ${current.toLocaleString()} (${growth >= 0 ? "+" : ""}${growth.toLocaleString()} nos últimos 30 dias, ${growthPct}%)\n`;
    }
    
    if (latest.engagement_rate) {
      const avgEngagement = platformMetrics.reduce((sum: number, m: any) => sum + (m.engagement_rate || 0), 0) / platformMetrics.length;
      context += `- Taxa de Engajamento: ${avgEngagement.toFixed(2)}%\n`;
    }
    
    if (latest.views) {
      const totalViews = platformMetrics.reduce((sum: number, m: any) => sum + (m.views || 0), 0);
      context += `- Total de Views (30d): ${totalViews.toLocaleString()}\n`;
    }
    
    if (latest.reach) {
      const totalReach = platformMetrics.reduce((sum: number, m: any) => sum + (m.reach || 0), 0);
      context += `- Alcance Total (30d): ${totalReach.toLocaleString()}\n`;
    }
  }

  // Add recent posts summary
  if (posts.length > 0) {
    context += `\n### Últimos Posts do Instagram\n`;
    const avgEngagement = posts.reduce((sum: number, p: any) => sum + (p.engagement_rate || 0), 0) / posts.length;
    const avgLikes = posts.reduce((sum: number, p: any) => sum + (p.likes || 0), 0) / posts.length;
    const avgComments = posts.reduce((sum: number, p: any) => sum + (p.comments || 0), 0) / posts.length;
    
    context += `- Posts analisados: ${posts.length}\n`;
    context += `- Engajamento médio: ${avgEngagement.toFixed(2)}%\n`;
    context += `- Média de likes: ${Math.round(avgLikes).toLocaleString()}\n`;
    context += `- Média de comentários: ${Math.round(avgComments).toLocaleString()}\n`;
    
    // Top 3 posts
    const topPosts = [...posts].sort((a: any, b: any) => (b.engagement_rate || 0) - (a.engagement_rate || 0)).slice(0, 3);
    if (topPosts.length > 0) {
      context += `\n**Top 3 Posts por Engajamento:**\n`;
      topPosts.forEach((p: any, i: number) => {
        const caption = p.caption?.substring(0, 80) || "Sem legenda";
        context += `${i + 1}. ${caption}... (${p.engagement_rate?.toFixed(2) || 0}% eng, ${p.likes || 0} likes)\n`;
      });
    }
  }

  return context.substring(0, MAX_METRICS_CONTEXT_LENGTH);
}

// ============================================
// WEB SEARCH INTEGRATION
// ============================================

async function performWebSearch(
  query: string,
  authHeader: string
): Promise<string | null> {
  const GROK_API_KEY = Deno.env.get("GROK_API_KEY");
  if (!GROK_API_KEY) {
    console.log("[kai-simple-chat] Grok API key not configured, skipping web search");
    return null;
  }

  try {
    console.log("[kai-simple-chat] Performing web search:", query);
    
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROK_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-beta",
        messages: [
          {
            role: "system",
            content: "Você é um assistente de pesquisa. Forneça informações atualizadas, precisas e bem fundamentadas. Seja conciso e objetivo.",
          },
          {
            role: "user",
            content: query,
          },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      console.error("[kai-simple-chat] Grok search error:", response.status);
      return null;
    }

    const data = await response.json();
    const result = data.choices?.[0]?.message?.content;
    
    if (result) {
      console.log("[kai-simple-chat] Web search completed");
      return `\n## Informações da Pesquisa Web\n${result}\n`;
    }
    
    return null;
  } catch (error) {
    console.error("[kai-simple-chat] Web search failed:", error);
    return null;
  }
}

// ============================================
// MAIN HANDLER
// ============================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json() as RequestBody;
    const { message, clientId, citations, history } = body;

    console.log("[kai-simple-chat] Request:", { 
      userId: user.id,
      clientId, 
      citationsCount: citations?.length,
      historyCount: history?.length,
      messageLength: message?.length 
    });

    if (!clientId || !message) {
      return new Response(
        JSON.stringify({ error: "clientId e message são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Fetch client and verify workspace access
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("name, description, identity_guide, workspace_id")
      .eq("id", clientId)
      .single();

    if (clientError || !client) {
      console.error("[kai-simple-chat] Client not found:", clientError);
      return new Response(
        JSON.stringify({ error: "Cliente não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Verify subscription plan
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("subscription_plan")
      .eq("id", client.workspace_id)
      .single();

    if (workspace) {
      const plan = workspace.subscription_plan?.toLowerCase() || "starter";
      if (!ALLOWED_PLANS.includes(plan)) {
        console.log("[kai-simple-chat] Access denied for plan:", plan);
        return new Response(
          JSON.stringify({ error: "O kAI Chat requer o plano Pro ou superior" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 3. Detect intents
    const needsMetrics = isMetricsQuery(message);
    const isReport = isReportRequest(message);
    const needsWebSearch = isWebSearchQuery(message);

    console.log("[kai-simple-chat] Intent detection:", { needsMetrics, isReport, needsWebSearch });

    // 4. Fetch additional context based on intent
    const [metricsContext, webSearchResult, citedContent] = await Promise.all([
      // Always fetch metrics if it's a metrics query or report request
      (needsMetrics || isReport) ? fetchMetricsContext(supabase, clientId) : Promise.resolve(""),
      // Perform web search if needed
      needsWebSearch ? performWebSearch(message, authHeader) : Promise.resolve(null),
      // Fetch cited content
      fetchCitedContent(supabase, citations),
    ]);

    // 5. Build system prompt (lean and focused)
    const identityGuide = client.identity_guide 
      ? client.identity_guide.substring(0, MAX_IDENTITY_GUIDE_LENGTH) 
      : "";

    let systemPrompt = `Você é o kAI, um assistente especializado em criação de conteúdo para marcas e criadores.

## Cliente: ${client.name}
${client.description ? `Descrição: ${client.description}` : ""}

${identityGuide ? `## Guia de Identidade\n${identityGuide}` : ""}`;

    // Add metrics context if available
    if (metricsContext) {
      systemPrompt += `\n${metricsContext}`;
    }

    // Add web search results if available
    if (webSearchResult) {
      systemPrompt += `\n${webSearchResult}`;
    }

    // Add cited content
    if (citedContent) {
      systemPrompt += `\n## Materiais Citados\n${citedContent}`;
    }

    // Add specific instructions based on intent
    if (isReport) {
      systemPrompt += `

## Instruções Especiais para Relatório
O usuário solicitou um relatório de performance. Gere um relatório estruturado com:
1. **Resumo Executivo** (2-3 parágrafos)
2. **Métricas Principais** (use tabelas markdown se possível)
3. **Análise de Tendências** 
4. **Insights e Oportunidades**
5. **Recomendações de Conteúdo** (3-5 ideias específicas)

Use emojis para destacar pontos positivos (📈) e áreas de atenção (⚠️).`;
    } else if (needsMetrics) {
      systemPrompt += `

## Instruções para Análise de Métricas
- Analise os dados disponíveis de forma clara e objetiva
- Identifique padrões e tendências
- Ofereça insights acionáveis
- Se os dados forem insuficientes, seja transparente sobre as limitações`;
    } else {
      systemPrompt += `

## Instruções Gerais
- Sempre siga o tom de voz e estilo do cliente definidos no guia de identidade
- Crie conteúdo original, autêntico e relevante para a audiência do cliente
- Seja direto, prático e objetivo nas respostas
- Se um formato foi citado, siga rigorosamente as regras específicas dele
- Use as referências citadas como base e inspiração quando disponíveis
- Mantenha consistência com a identidade da marca em todas as respostas`;
    }

    // 6. Build messages array - limit history to prevent context overflow
    const limitedHistory = (history || []).slice(-MAX_HISTORY_MESSAGES);
    const apiMessages = [
      { role: "system", content: systemPrompt },
      ...limitedHistory.map(h => ({ role: h.role, content: h.content })),
      { role: "user", content: message },
    ];

    console.log("[kai-simple-chat] Context built:", {
      systemPromptLength: systemPrompt.length,
      historyMessages: limitedHistory.length,
      hasMetricsContext: !!metricsContext,
      hasWebSearch: !!webSearchResult,
      hasCitedContent: !!citedContent,
    });

    // 7. Call AI Gateway with streaming
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      // Fallback to Google API
      const GOOGLE_API_KEY = Deno.env.get("GOOGLE_AI_STUDIO_API_KEY");
      if (!GOOGLE_API_KEY) {
        console.error("[kai-simple-chat] No API key configured");
        return new Response(
          JSON.stringify({ error: "Configuração de API incompleta. Contate o suporte." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("[kai-simple-chat] Using Gemini fallback");
      
      // Use Gemini directly
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?key=${GOOGLE_API_KEY}&alt=sse`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: apiMessages.map(m => ({
              role: m.role === "assistant" ? "model" : m.role === "system" ? "user" : "user",
              parts: [{ text: m.content }],
            })),
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 4096,
            },
          }),
        }
      );

      if (!geminiResponse.ok) {
        const errorText = await geminiResponse.text();
        console.error("[kai-simple-chat] Gemini error:", geminiResponse.status, errorText);
        
        // Provide specific error messages
        if (geminiResponse.status === 429) {
          return new Response(
            JSON.stringify({ error: "Muitas requisições. Aguarde um momento e tente novamente." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (geminiResponse.status === 400) {
          return new Response(
            JSON.stringify({ error: "Mensagem muito longa ou formato inválido." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        return new Response(
          JSON.stringify({ error: "Erro ao gerar resposta. Tente novamente." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Transform Gemini SSE to OpenAI format
      const reader = geminiResponse.body?.getReader();
      if (!reader) {
        return new Response(
          JSON.stringify({ error: "Resposta vazia do servidor." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const decoder = new TextDecoder();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split("\n");

              for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                const data = line.slice(6).trim();
                if (!data) continue;

                try {
                  const parsed = JSON.parse(data);
                  const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                  if (text) {
                    const openAIFormat = {
                      choices: [{ delta: { content: text } }],
                    };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(openAIFormat)}\n\n`));
                  }
                } catch {
                  // Ignore parse errors for incomplete chunks
                }
              }
            }
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          } catch (e) {
            console.error("[kai-simple-chat] Stream error:", e);
            controller.error(e);
          }
        },
      });

      return new Response(stream, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        },
      });
    }

    // Use Lovable AI Gateway
    console.log("[kai-simple-chat] Using Lovable AI Gateway");
    
    const gatewayResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: apiMessages,
          stream: true,
          temperature: 0.7,
          max_tokens: isReport ? 6000 : 4096, // More tokens for reports
        }),
      }
    );

    if (!gatewayResponse.ok) {
      const status = gatewayResponse.status;
      const errorText = await gatewayResponse.text();
      console.error("[kai-simple-chat] Gateway error:", status, errorText);

      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições atingido. Aguarde alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione mais créditos para continuar." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status === 408 || errorText.includes("timeout")) {
        return new Response(
          JSON.stringify({ error: "A requisição demorou demais. Tente uma mensagem mais curta." }),
          { status: 408, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Erro ao processar sua solicitação. Tente novamente." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Stream the response directly
    console.log("[kai-simple-chat] Streaming response started");
    return new Response(gatewayResponse.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });

  } catch (error) {
    console.error("[kai-simple-chat] Unhandled error:", error);
    
    // Provide user-friendly error message
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    const isTimeout = errorMessage.includes("timeout") || errorMessage.includes("TIMEOUT");
    
    return new Response(
      JSON.stringify({ 
        error: isTimeout 
          ? "A requisição expirou. Tente novamente com uma mensagem mais curta."
          : "Erro interno. Por favor, tente novamente."
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ============================================
// HELPER: Fetch cited content
// ============================================

async function fetchCitedContent(
  supabase: any,
  citations?: Citation[]
): Promise<string> {
  if (!citations || citations.length === 0) return "";

  // Process citations in parallel for better performance
  const citationPromises = citations.map(async (citation) => {
    if (citation.type === "content") {
      const { data } = await supabase
        .from("client_content_library")
        .select("title, content, content_type, created_at")
        .eq("id", citation.id)
        .single();
      
      if (data) {
        return {
          type: "content",
          title: data.title,
          content: data.content,
          contentType: data.content_type,
          createdAt: data.created_at,
        };
      }
    } else if (citation.type === "reference") {
      const { data } = await supabase
        .from("client_reference_library")
        .select("title, content, reference_type, created_at")
        .eq("id", citation.id)
        .single();
      
      if (data) {
        return {
          type: "reference",
          title: data.title,
          content: data.content,
          contentType: data.reference_type,
          createdAt: data.created_at,
        };
      }
    } else if (citation.type === "format") {
      const { data } = await supabase
        .from("kai_documentation")
        .select("content, checklist")
        .eq("doc_type", "format")
        .eq("doc_key", citation.title.toLowerCase())
        .single();
      
      if (data) {
        return {
          type: "format",
          title: citation.title,
          content: data.content,
          checklist: data.checklist,
        };
      }
    }
    return null;
  });

  const citationResults = (await Promise.all(citationPromises)).filter(Boolean) as any[];
  
  // Sort by recency (most recent first) and build content
  citationResults.sort((a, b) => {
    if (a?.createdAt && b?.createdAt) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    return 0;
  });

  let citedContent = "";
  for (const cit of citationResults) {
    if (!cit) continue;
    
    if (cit.type === "format") {
      citedContent += `\n### Regras do formato ${cit.title}:\n${cit.content}\n`;
      if (cit.checklist) {
        citedContent += `\nChecklist:\n${JSON.stringify(cit.checklist)}\n`;
      }
    } else {
      const label = cit.type === "content" ? "Referência" : "Referência externa";
      citedContent += `\n### ${label}: ${cit.title} (${cit.contentType})\n${cit.content}\n`;
    }
    
    // Stop if we've exceeded the limit
    if (citedContent.length >= MAX_CITED_CONTENT_LENGTH) {
      citedContent = citedContent.substring(0, MAX_CITED_CONTENT_LENGTH) + "\n[...conteúdo truncado]";
      break;
    }
  }

  return citedContent;
}
