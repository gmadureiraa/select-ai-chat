import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logAIUsage, estimateTokens } from "../_shared/ai-usage.ts";
import { 
  checkWorkspaceTokens, 
  debitWorkspaceTokens, 
  getWorkspaceIdFromUser,
  createInsufficientTokensResponse,
  TOKEN_COSTS 
} from "../_shared/tokens.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { clientId, clientName, context, userId, workspaceId: providedWorkspaceId, periodLabel, platform, startDate, endDate } = await req.json();

    if (!context) {
      throw new Error("Context is required");
    }

    // Get workspace ID and check tokens
    const workspaceId = providedWorkspaceId || await getWorkspaceIdFromUser(user.id);
    if (!workspaceId) {
      console.error("[generate-performance-insights] Could not determine workspace");
      return new Response(
        JSON.stringify({ error: 'Workspace not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenCost = TOKEN_COSTS.performance_insights;
    const tokenCheck = await checkWorkspaceTokens(workspaceId, tokenCost);
    
    if (!tokenCheck.hasTokens) {
      console.warn(`[generate-performance-insights] Insufficient tokens for workspace ${workspaceId}`);
      return createInsufficientTokensResponse(corsHeaders);
    }

    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_AI_STUDIO_API_KEY");
    if (!GOOGLE_API_KEY) {
      throw new Error("GOOGLE_AI_STUDIO_API_KEY not configured");
    }

    // Determine platform name
    const platformName = platform === "youtube" ? "YouTube" : "Instagram";
    const periodInfo = periodLabel || (startDate && endDate ? `${startDate} a ${endDate}` : "período selecionado");

    // Calculate averages
    const totalPosts = context.instagram?.totalPosts || 0;
    const avgLikes = totalPosts > 0 ? Math.round((context.instagram?.totalLikes || 0) / totalPosts) : 0;
    const avgComments = totalPosts > 0 ? Math.round((context.instagram?.totalComments || 0) / totalPosts) : 0;
    const avgShares = totalPosts > 0 ? Math.round((context.instagram?.totalShares || 0) / totalPosts) : 0;
    const avgSaves = totalPosts > 0 ? Math.round((context.instagram?.totalSaves || 0) / totalPosts) : 0;

    // Build context summary for AI
    const contextSummary = platform === "youtube" ? `
═══════════════════════════════════════════════════════════════
DADOS DE PERFORMANCE - YOUTUBE
Cliente: ${clientName}
Período: ${periodInfo}
═══════════════════════════════════════════════════════════════

## MÉTRICAS MACRO
- Views totais: ${context.youtube?.totalViews?.toLocaleString() || 0}
- Horas assistidas: ${context.youtube?.watchHours?.toLocaleString() || 0}h
- Subscribers ganhos: ${context.youtube?.subscribers?.toLocaleString() || 0}

${context.youtube?.topVideos?.length ? `## TOP VÍDEOS
${context.youtube.topVideos.slice(0, 5).map((v: any, i: number) => 
  `${i + 1}. "${v.title?.slice(0, 60) || 'Sem título'}..."
   • Views: ${v.views?.toLocaleString() || 0} | CTR: ${v.ctr?.toFixed(2) || 0}%`
).join('\n\n')}` : ''}
` : `
═══════════════════════════════════════════════════════════════
DADOS DE PERFORMANCE - INSTAGRAM
Cliente: ${clientName}
Período: ${periodInfo}
═══════════════════════════════════════════════════════════════

## MÉTRICAS MACRO
- Total de posts: ${totalPosts}
- Curtidas: ${context.instagram?.totalLikes?.toLocaleString() || 0}
- Comentários: ${context.instagram?.totalComments?.toLocaleString() || 0}
- Salvamentos: ${context.instagram?.totalSaves?.toLocaleString() || 0}
- Compartilhamentos: ${context.instagram?.totalShares?.toLocaleString() || 0}
- Alcance total: ${context.instagram?.totalReach?.toLocaleString() || 0}
- Engajamento médio: ${context.instagram?.avgEngagement?.toFixed(2) || 0}%

## MÉDIAS POR POST
- Curtidas/post: ${avgLikes}
- Comentários/post: ${avgComments}
- Compartilhamentos/post: ${avgShares}
- Salvamentos/post: ${avgSaves}

${context.instagram?.topPosts?.length ? `## TOP POSTS (por engajamento)
${context.instagram.topPosts.slice(0, 5).map((p: any, i: number) => 
  `${i + 1}. [${p.type || 'post'}] "${p.caption?.slice(0, 60) || 'Sem legenda'}..."
   • Curtidas: ${p.likes} | Comentários: ${p.comments || 0} | Salvamentos: ${p.saves || 0} | Compartilhamentos: ${p.shares || 0}
   • Engajamento: ${p.engagement?.toFixed(2) || 0}%`
).join('\n\n')}` : ''}
`;

    const prompt = `Você é um analista sênior de marketing digital. Analise os dados de ${platformName} e gere insights ESTRATÉGICOS e ACIONÁVEIS.

${contextSummary}

═══════════════════════════════════════════════════════════════
FORMATO DA RESPOSTA
═══════════════════════════════════════════════════════════════

Gere uma análise estruturada em Markdown com:

## 📊 Visão Geral
[1-2 frases resumindo o desempenho geral do período, citando números específicos]

## ⭐ Destaques do Período
- [Destaque 1: métrica ou conteúdo que performou bem, com números]
- [Destaque 2: padrão positivo identificado]
- [Destaque 3: conquista ou marco importante]

## 📈 Oportunidades de Melhoria
- [Oportunidade 1: baseada nos dados, com justificativa]
- [Oportunidade 2: ação concreta para melhorar resultados]

## 💡 Recomendações Estratégicas
1. **[Ação imediata]:** [O que fazer e por quê, baseado nos dados]
2. **[Ação de médio prazo]:** [Estratégia para melhorar métricas específicas]

REGRAS:
- Use APENAS dados fornecidos, nunca invente
- Cite números específicos e porcentagens
- Seja direto e prático
- Máximo 200 palavras total`;

    const MODEL = "gemini-2.0-flash";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 500,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[generate-performance-insights] Gemini API error:", errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const insights = data.candidates?.[0]?.content?.parts?.[0]?.text || "Não foi possível gerar insights.";
    
    // Get token usage
    const inputTokens = data.usageMetadata?.promptTokenCount || estimateTokens(prompt);
    const outputTokens = data.usageMetadata?.candidatesTokenCount || estimateTokens(insights);

    // Log AI usage
    if (userId) {
      const supabaseServiceUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseServiceUrl, supabaseServiceKey);
      
      await logAIUsage(
        supabase,
        userId,
        MODEL,
        "generate-performance-insights",
        inputTokens,
        outputTokens,
        { clientId, clientName }
      );
    }

    // Debit tokens after successful generation
    const debitResult = await debitWorkspaceTokens(
      workspaceId,
      user.id,
      tokenCost,
      "Insights de performance",
      { clientId, clientName }
    );
    
    if (!debitResult.success) {
      console.warn(`[generate-performance-insights] Token debit failed: ${debitResult.error}`);
    }

    console.log(`[generate-performance-insights] Complete - ${inputTokens + outputTokens} tokens, ${tokenCost} debited`);

    return new Response(
      JSON.stringify({ insights }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[generate-performance-insights] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
