import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clientId, platform, importedCount, dateRange } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch recent imported data for analysis
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

    // Prepare data summary for AI analysis
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

    // Call AI to analyze the data
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é um analista de dados especializado em métricas de redes sociais.
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
2. Se os valores parecem consistentes (sem outliers extremos)
3. Se há datas duplicadas ou faltando
4. Se as métricas fazem sentido para a plataforma
5. Se há valores nulos ou zerados em excesso`
          },
          {
            role: "user",
            content: `Analise esta importação de dados de ${platform}:

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
${JSON.stringify(dataSummary.sampleData, null, 2)}`
          }
        ],
        temperature: 0.3
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", errorText);
      
      // Return a basic validation without AI
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

    let validationResult;
    try {
      // Try to parse JSON from AI response
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        validationResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      validationResult = {
        status: "success",
        summary: `${importedCount} registros importados para ${platform}`,
        details: [aiContent],
        issues: [],
        recommendations: []
      };
    }

    return new Response(JSON.stringify({
      ...validationResult,
      aiAnalyzed: true,
      stats: dataSummary.stats
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in validate-csv-import:', error);
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
