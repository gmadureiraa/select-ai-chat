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

    // Build context summary for AI
    const contextSummary = platform === "youtube" ? `
Cliente: ${clientName}
Período: ${periodInfo}

## YouTube
- Views totais: ${context.youtube?.totalViews?.toLocaleString() || 0}
- Horas assistidas: ${context.youtube?.watchHours?.toLocaleString() || 0}
- Subscribers ganhos: ${context.youtube?.subscribers?.toLocaleString() || 0}
${context.youtube?.topVideos?.length ? `
Top Vídeos:
${context.youtube.topVideos.slice(0, 5).map((v: any, i: number) => 
  `${i + 1}. "${v.title?.slice(0, 50) || 'Sem título'}..." - ${v.views?.toLocaleString() || 0} views, CTR ${v.ctr?.toFixed(1) || 0}%`
).join('\n')}` : ''}
` : `
Cliente: ${clientName}
Período: ${periodInfo}

## Instagram
- Total de posts: ${context.instagram?.totalPosts || 0}
- Total de curtidas: ${context.instagram?.totalLikes?.toLocaleString() || 0}
- Total de comentários: ${context.instagram?.totalComments?.toLocaleString() || 0}
- Total de salvamentos: ${context.instagram?.totalSaves?.toLocaleString() || 0}
- Total de compartilhamentos: ${context.instagram?.totalShares?.toLocaleString() || 0}
- Alcance total: ${context.instagram?.totalReach?.toLocaleString() || 0}
- Engajamento médio: ${context.instagram?.avgEngagement?.toFixed(2) || 0}%
${context.instagram?.topPosts?.length ? `
Top Posts por Engajamento:
${context.instagram.topPosts.slice(0, 5).map((p: any, i: number) => 
  `${i + 1}. "${p.caption?.slice(0, 60) || 'Sem legenda'}..." - ${p.likes} curtidas, ${p.saves || 0} salvamentos, ${p.shares || 0} compartilhamentos, ${p.engagement?.toFixed(1) || 0}% engajamento, tipo: ${p.type || 'post'}`
).join('\n')}` : ''}
`;

    const prompt = `Você é um especialista em análise de redes sociais e marketing digital. Analise as métricas de performance de ${platformName} abaixo e gere insights práticos e acionáveis.

${contextSummary}

Gere um resumo executivo estruturado (máximo 6-7 frases) com:

**📊 Visão Geral do Período**
Uma frase sobre o desempenho geral.

**⭐ Destaques**
- O melhor conteúdo e por que performou bem
- Métricas que se destacaram

**📈 Oportunidades**
- Uma oportunidade de melhoria identificada
- Uma recomendação concreta para próximos passos

Seja direto, prático e específico ao ${platformName}. Use números e porcentagens quando relevante. Formate em markdown.`;

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
