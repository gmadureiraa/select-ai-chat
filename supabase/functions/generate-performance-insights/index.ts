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
    const platformName = platform === "youtube" ? "YouTube" : platform === "newsletter" ? "Newsletter" : "Instagram";
    const periodInfo = periodLabel || (startDate && endDate ? `${startDate} a ${endDate}` : "período selecionado");

    // Build enhanced context summary for AI with comparison data
    let contextSummary = "";
    
    if (platform === "youtube") {
      const yt = context.youtube || {};
      const prev = yt.previousPeriod || {};
      
      const viewsChange = prev.totalViews && prev.totalViews > 0 
        ? ((yt.totalViews - prev.totalViews) / prev.totalViews * 100).toFixed(1)
        : null;
      
      contextSummary = `
Cliente: ${clientName}
Período: ${periodInfo}
Plataforma: YouTube

## Métricas do Período Atual
- Total de vídeos: ${yt.totalVideos || 0}
- Visualizações totais: ${(yt.totalViews || 0).toLocaleString()}${viewsChange ? ` (${Number(viewsChange) >= 0 ? '+' : ''}${viewsChange}% vs anterior)` : ''}
- Horas assistidas: ${(yt.watchHours || 0).toLocaleString()}
- Inscritos ganhos: ${(yt.subscribers || 0).toLocaleString()}

${prev.totalViews ? `## Período Anterior (Comparação)
- Visualizações totais: ${prev.totalViews.toLocaleString()}
` : ''}

${yt.topVideos?.length ? `## Top Vídeos por Performance
${yt.topVideos.slice(0, 5).map((v: any, i: number) => 
  `${i + 1}. "${v.title?.slice(0, 50) || 'Sem título'}..." - ${(v.views || 0).toLocaleString()} views, CTR ${(v.ctr || 0).toFixed(1)}%`
).join('\n')}` : ''}

${yt.goals?.length ? `## Metas Configuradas
${yt.goals.map((g: any) => 
  `- ${g.metric}: ${g.current?.toLocaleString() || 0} / ${g.target?.toLocaleString()} (${g.status})`
).join('\n')}` : ''}
`;
    } else if (platform === "instagram") {
      const ig = context.instagram || {};
      const prev = ig.previousPeriod || {};
      
      const likesChange = prev.totalLikes && prev.totalLikes > 0 
        ? ((ig.totalLikes - prev.totalLikes) / prev.totalLikes * 100).toFixed(1)
        : null;
      const reachChange = prev.totalReach && prev.totalReach > 0 
        ? ((ig.totalReach - prev.totalReach) / prev.totalReach * 100).toFixed(1)
        : null;
      const engagementChange = prev.avgEngagement && prev.avgEngagement > 0 
        ? ((ig.avgEngagement - prev.avgEngagement) / prev.avgEngagement * 100).toFixed(1)
        : null;
      
      contextSummary = `
Cliente: ${clientName}
Período: ${periodInfo}
Plataforma: Instagram

## Métricas do Período Atual
- Total de posts: ${ig.totalPosts || 0}${prev.totalPosts ? ` (anterior: ${prev.totalPosts})` : ''}
- Total de curtidas: ${(ig.totalLikes || 0).toLocaleString()}${likesChange ? ` (${Number(likesChange) >= 0 ? '+' : ''}${likesChange}% vs anterior)` : ''}
- Total de comentários: ${(ig.totalComments || 0).toLocaleString()}
- Total de salvamentos: ${(ig.totalSaves || 0).toLocaleString()}
- Total de compartilhamentos: ${(ig.totalShares || 0).toLocaleString()}
- Alcance total: ${(ig.totalReach || 0).toLocaleString()}${reachChange ? ` (${Number(reachChange) >= 0 ? '+' : ''}${reachChange}% vs anterior)` : ''}
- Engajamento médio: ${(ig.avgEngagement || 0).toFixed(2)}%${engagementChange ? ` (${Number(engagementChange) >= 0 ? '+' : ''}${engagementChange}% vs anterior)` : ''}

${prev.totalLikes ? `## Período Anterior (Comparação)
- Total de posts: ${prev.totalPosts || 0}
- Total de curtidas: ${prev.totalLikes.toLocaleString()}
- Alcance total: ${(prev.totalReach || 0).toLocaleString()}
- Engajamento médio: ${(prev.avgEngagement || 0).toFixed(2)}%
` : ''}

${ig.topPosts?.length ? `## Top Posts por Engajamento
${ig.topPosts.slice(0, 5).map((p: any, i: number) => 
  `${i + 1}. "${p.caption?.slice(0, 60) || 'Sem legenda'}..." - ${p.likes} curtidas, ${p.saves || 0} salvamentos, ${p.shares || 0} compartilhamentos, ${(p.engagement || 0).toFixed(1)}% engajamento, tipo: ${p.type || 'post'}`
).join('\n')}` : ''}

${ig.goals?.length ? `## Metas Configuradas
${ig.goals.map((g: any) => 
  `- ${g.metric}: ${g.current?.toLocaleString() || 0} / ${g.target?.toLocaleString()} (${g.status})`
).join('\n')}` : ''}
`;
    } else {
      // Newsletter
      const nl = context.newsletter || {};
      contextSummary = `
Cliente: ${clientName}
Período: ${periodInfo}
Plataforma: Newsletter

## Métricas do Período
- Inscritos: ${(nl.subscribers || 0).toLocaleString()}
- Taxa de abertura: ${(nl.openRate || 0).toFixed(1)}%
- Taxa de cliques: ${(nl.clickRate || 0).toFixed(1)}%
`;
    }

    // Enhanced prompt with mandatory rules
    const prompt = `Você é um especialista em análise de redes sociais e marketing digital. Analise as métricas de performance de ${platformName} abaixo e gere insights práticos e acionáveis.

${contextSummary}

---

## REGRAS OBRIGATÓRIAS (siga rigorosamente):

1. **SEMPRE compare com o período anterior** quando dados disponíveis
   - Use números específicos: "Aumentou 12.3% (de 1.200 para 1.348)"
   - Nunca use termos vagos como "significativamente" ou "bastante"

2. **Use números específicos e porcentagens**
   - Correto: "O engajamento subiu de 3.2% para 4.1% (+28%)"
   - Errado: "O engajamento melhorou bastante"

3. **Identifique padrões** quando possível
   - Tipos de conteúdo que funcionam melhor
   - Horários ou dias com melhor performance

4. **Foque em ações concretas e acionáveis**
   - Não apenas descreva, recomende ações específicas
   - Priorize por impacto esperado

5. **Mencione status das metas** se houver metas configuradas

---

## ESTRUTURA DA RESPOSTA:

**📊 Resumo Executivo**
(1-2 parágrafos com overview geral e principais destaques)

**📈 Tendências Principais**
(3-4 bullets com tendências identificadas, incluindo números)

${context.instagram?.goals?.length || context.youtube?.goals?.length ? `**🎯 Status das Metas**
(Status de cada meta: ✅ Batida, 🟡 Em progresso, ❌ Abaixo)
` : ''}

**✅ Pontos Fortes**
(3-4 bullets do que está funcionando bem)

**⚠️ Áreas de Melhoria**
(3-4 bullets do que precisa atenção)

**💡 Recomendações Estratégicas**
(3-4 ações concretas priorizadas por impacto)

${context.instagram?.previousPeriod || context.youtube?.previousPeriod ? `**📊 Comparação com Período Anterior**
| Métrica | Atual | Anterior | Variação |
|---------|-------|----------|----------|
(Tabela comparativa das principais métricas)
` : ''}

---

Seja profissional, direto e focado em resultados. Formate em markdown.`;

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
            maxOutputTokens: 1500,
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
    
    // Validate insights before returning
    const hasComparison = insights.includes('%') || insights.includes('anterior');
    const hasNumbers = /\d+/.test(insights);
    const hasRecommendations = insights.toLowerCase().includes('recomend') || insights.toLowerCase().includes('💡');
    
    if (!hasNumbers || !hasRecommendations) {
      console.warn("[generate-performance-insights] Insights may not meet quality standards");
    }
    
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
        { clientId, clientName, platform, hasComparison, hasNumbers }
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
