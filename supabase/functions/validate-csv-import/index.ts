import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { logAIUsage, estimateTokens } from "../_shared/ai-usage.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clientId, platform, importedCount, dateRange, userId } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch recent imported data
    const { data: metrics, error: metricsError } = await supabase
      .from('platform_metrics')
      .select('*')
      .eq('client_id', clientId)
      .eq('platform', platform)
      .order('metric_date', { ascending: false })
      .limit(30);

    if (metricsError) {
      throw new Error(`Failed to fetch metrics: ${metricsError.message}`);
    }

    const dataSummary = {
      totalRecords: metrics?.length || 0,
      platform,
      importedCount,
      dateRange,
      sampleData: metrics?.slice(0, 10).map(m => ({
        date: m.metric_date,
        views: m.views,
        likes: m.likes,
        comments: m.comments,
        shares: m.shares,
        subscribers: m.subscribers,
        engagement_rate: m.engagement_rate,
        open_rate: m.open_rate,
        click_rate: m.click_rate
      })),
      stats: {
        avgViews: metrics?.length ? Math.round(metrics.reduce((sum, m) => sum + (m.views || 0), 0) / metrics.length) : 0,
        avgEngagement: metrics?.length ? (metrics.reduce((sum, m) => sum + (m.engagement_rate || 0), 0) / metrics.length).toFixed(2) : 0,
        maxViews: metrics?.length ? Math.max(...metrics.map(m => m.views || 0)) : 0,
        minViews: metrics?.length ? Math.min(...metrics.filter(m => m.views).map(m => m.views || 0)) : 0,
        hasNulls: metrics?.some(m => !m.views && !m.likes && !m.subscribers),
        uniqueDates: new Set(metrics?.map(m => m.metric_date)).size
      }
    };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const MODEL = "google/gemini-2.5-flash";
    const systemPrompt = `Você é um analista de dados especializado em métricas de redes sociais.
Analise os dados importados e forneça um relatório de validação em português brasileiro.

Responda SEMPRE no formato JSON:
{
  "status": "success" | "warning" | "error",
  "summary": "Uma frase resumindo a importação",
  "details": ["Lista de observações importantes"],
  "issues": ["Lista de problemas encontrados, se houver"],
  "recommendations": ["Sugestões de melhoria, se aplicável"]
}

Verifique:
1. Se há dados suficientes para análise
2. Se os valores parecem consistentes
3. Se há datas duplicadas ou faltando
4. Se as métricas fazem sentido para a plataforma
5. Se há valores nulos ou zerados em excesso`;

    const userPrompt = `Analise esta importação de dados de ${platform}:

Registros importados: ${importedCount}
Total de registros no banco: ${dataSummary.totalRecords}
Período: ${dateRange?.start || 'N/A'} até ${dateRange?.end || 'N/A'}

Estatísticas:
- Média de views: ${dataSummary.stats.avgViews}
- Média de engagement: ${dataSummary.stats.avgEngagement}%
- Máximo de views: ${dataSummary.stats.maxViews}
- Mínimo de views: ${dataSummary.stats.minViews}
- Tem valores nulos: ${dataSummary.stats.hasNulls ? 'Sim' : 'Não'}
- Datas únicas: ${dataSummary.stats.uniqueDates}

Amostra dos dados (últimos 10 registros):
${JSON.stringify(dataSummary.sampleData, null, 2)}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("[validate-csv-import] AI API error:", errorText);
      
      // Return basic validation without AI
      return new Response(JSON.stringify({
        status: "success",
        summary: `${importedCount} registros importados com sucesso para ${platform}`,
        details: [
          `Total de ${dataSummary.totalRecords} registros no banco`,
          `${dataSummary.stats.uniqueDates} datas únicas`
        ],
        issues: [],
        recommendations: [],
        aiAnalyzed: false
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content;
    
    // Get token usage
    const inputTokens = aiData.usage?.prompt_tokens || estimateTokens(systemPrompt + userPrompt);
    const outputTokens = aiData.usage?.completion_tokens || estimateTokens(aiContent);

    // Log AI usage
    if (userId) {
      await logAIUsage(
        supabase,
        userId,
        MODEL,
        "validate-csv-import",
        inputTokens,
        outputTokens,
        { clientId, platform, importedCount }
      );
    }

    let validationResult;
    try {
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        validationResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("[validate-csv-import] Failed to parse AI response:", parseError);
      validationResult = {
        status: "success",
        summary: `${importedCount} registros importados para ${platform}`,
        details: [aiContent],
        issues: [],
        recommendations: []
      };
    }

    console.log(`[validate-csv-import] Complete - ${inputTokens + outputTokens} tokens`);

    return new Response(JSON.stringify({
      ...validationResult,
      aiAnalyzed: true,
      stats: dataSummary.stats
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[validate-csv-import] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ 
      error: errorMessage,
      status: "error",
      summary: "Erro ao validar importação",
      details: [],
      issues: [errorMessage],
      recommendations: ["Tente importar novamente"]
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
