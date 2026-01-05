import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { logAIUsage, estimateTokens } from "../_shared/ai-usage.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type DateRange = { start: string; end: string };

function safeNumber(v: unknown): number | null {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

function getMetaValue(metric: any, key: string): number | null {
  const meta = metric?.metadata;
  if (!meta || typeof meta !== "object") return null;
  return safeNumber((meta as Record<string, unknown>)[key]);
}

function computeDateRangeFromMetrics(metrics: any[]): DateRange | null {
  const dates = (metrics || [])
    .map((m) => (typeof m.metric_date === "string" ? m.metric_date : null))
    .filter((d): d is string => Boolean(d));

  if (dates.length === 0) return null;
  dates.sort();
  return { start: dates[0], end: dates[dates.length - 1] };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      clientId,
      platform,
      importedCount,
      dateRange,
      userId,
      importTypes,
      fileName,
    } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch data in the imported period when available; otherwise, fall back to recent data.
    let metricsQuery = supabase
      .from("platform_metrics")
      .select("*")
      .eq("client_id", clientId)
      .eq("platform", platform);

    const hasDateRange = Boolean(dateRange?.start && dateRange?.end);
    if (hasDateRange) {
      metricsQuery = metricsQuery
        .gte("metric_date", dateRange.start)
        .lte("metric_date", dateRange.end)
        .order("metric_date", { ascending: false })
        .limit(1000);
    } else {
      metricsQuery = metricsQuery.order("metric_date", { ascending: false }).limit(60);
    }

    const { data: metrics, error: metricsError } = await metricsQuery;

    if (metricsError) {
      throw new Error(`Failed to fetch metrics: ${metricsError.message}`);
    }

    const effectiveDateRange: DateRange | null = hasDateRange
      ? dateRange
      : computeDateRangeFromMetrics(metrics || []);

    const typesArr: string[] = Array.isArray(importTypes) ? importTypes : [];

    // Non-null counts (includes metadata fields for Instagram)
    const nonNullCounts = {
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      subscribers: 0,
      engagement_rate: 0,
      open_rate: 0,
      click_rate: 0,
      linkClicks: 0,
      reach: 0,
      interactions: 0,
      profileVisits: 0,
    };

    for (const m of metrics || []) {
      if (m.views !== null && m.views !== undefined) nonNullCounts.views++;
      if (m.likes !== null && m.likes !== undefined) nonNullCounts.likes++;
      if (m.comments !== null && m.comments !== undefined) nonNullCounts.comments++;
      if (m.shares !== null && m.shares !== undefined) nonNullCounts.shares++;
      if (m.subscribers !== null && m.subscribers !== undefined) nonNullCounts.subscribers++;
      if (m.engagement_rate !== null && m.engagement_rate !== undefined) nonNullCounts.engagement_rate++;
      if (m.open_rate !== null && m.open_rate !== undefined) nonNullCounts.open_rate++;
      if (m.click_rate !== null && m.click_rate !== undefined) nonNullCounts.click_rate++;

      if (getMetaValue(m, "linkClicks") !== null) nonNullCounts.linkClicks++;
      if (getMetaValue(m, "reach") !== null) nonNullCounts.reach++;
      if (getMetaValue(m, "interactions") !== null) nonNullCounts.interactions++;
      if (getMetaValue(m, "profileVisits") !== null) nonNullCounts.profileVisits++;
    }

    const dataSummary = {
      totalRecords: metrics?.length || 0,
      platform,
      importedCount,
      dateRange: effectiveDateRange,
      importTypes: typesArr,
      fileName: typeof fileName === "string" ? fileName : null,
      sampleData: metrics?.slice(0, 10).map((m) => ({
        date: m.metric_date,
        views: m.views,
        likes: m.likes,
        comments: m.comments,
        shares: m.shares,
        subscribers: m.subscribers,
        engagement_rate: m.engagement_rate,
        open_rate: m.open_rate,
        click_rate: m.click_rate,
        // Instagram metadata fields
        linkClicks: getMetaValue(m, "linkClicks"),
        reach: getMetaValue(m, "reach"),
        interactions: getMetaValue(m, "interactions"),
        profileVisits: getMetaValue(m, "profileVisits"),
      })),
      stats: {
        avgViews: metrics?.length
          ? Math.round(metrics.reduce((sum, m) => sum + (m.views || 0), 0) / metrics.length)
          : 0,
        avgEngagement: metrics?.length
          ? (metrics.reduce((sum, m) => sum + (m.engagement_rate || 0), 0) / metrics.length).toFixed(2)
          : "0",
        maxViews: metrics?.length ? Math.max(...metrics.map((m) => m.views || 0)) : 0,
        minViews: metrics?.length ? Math.min(...metrics.filter((m) => m.views).map((m) => m.views || 0)) : 0,
        // Has rows where ALL key Instagram fields are missing
        hasNulls:
          metrics?.some((m) => {
            const meta = {
              linkClicks: getMetaValue(m, "linkClicks"),
              reach: getMetaValue(m, "reach"),
              interactions: getMetaValue(m, "interactions"),
              profileVisits: getMetaValue(m, "profileVisits"),
            };
            return (
              (m.views === null || m.views === undefined) &&
              (m.likes === null || m.likes === undefined) &&
              (m.subscribers === null || m.subscribers === undefined) &&
              meta.linkClicks === null &&
              meta.reach === null &&
              meta.interactions === null &&
              meta.profileVisits === null
            );
          }) || false,
        uniqueDates: new Set(metrics?.map((m) => m.metric_date)).size,
        nonNullCounts,
      },
    };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const MODEL = "google/gemini-2.5-flash";
    const systemPrompt = `Você é um analista de dados especializado em métricas de redes sociais.
Analise os dados importados e forneça um relatório de validação em português brasileiro.

IMPORTANTE:
- Importações podem ser PARCIAIS (ex.: apenas "Cliques no link", apenas "Alcance", etc.).
- Em importações parciais, é NORMAL que outras métricas estejam nulas. Não trate isso como erro.
- Se "Registros importados" for maior do que "Total de registros no banco", isso pode ser NORMAL quando há upsert por data (datas únicas).

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
5. Se há valores nulos ou zerados em excesso APENAS nas métricas que foram importadas`;

    const userPrompt = `Analise esta importação de dados de ${platform}:

Arquivo(s): ${dataSummary.fileName || "N/A"}
Tipos detectados: ${typesArr.length ? typesArr.join(", ") : "N/A"}

Registros importados (contagem do app): ${importedCount}
Total de registros analisados no banco (no período/recorte): ${dataSummary.totalRecords}
Período: ${effectiveDateRange?.start || "N/A"} até ${effectiveDateRange?.end || "N/A"}

Cobertura (quantos registros têm valor):
- views: ${nonNullCounts.views}/${dataSummary.totalRecords}
- subscribers: ${nonNullCounts.subscribers}/${dataSummary.totalRecords}
- engagement_rate: ${nonNullCounts.engagement_rate}/${dataSummary.totalRecords}
- linkClicks (metadata): ${nonNullCounts.linkClicks}/${dataSummary.totalRecords}
- reach (metadata): ${nonNullCounts.reach}/${dataSummary.totalRecords}
- interactions (metadata): ${nonNullCounts.interactions}/${dataSummary.totalRecords}
- profileVisits (metadata): ${nonNullCounts.profileVisits}/${dataSummary.totalRecords}

Amostra dos dados (até 10 registros mais recentes do recorte):
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
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("[validate-csv-import] AI API error:", errorText);

      // Return basic validation without AI
      return new Response(
        JSON.stringify({
          status: "success",
          summary: `${importedCount} registros importados com sucesso para ${platform}`,
          details: [
            `Total de ${dataSummary.totalRecords} registros no banco (recorte)`,
            `${dataSummary.stats.uniqueDates} datas únicas`,
          ],
          issues: [],
          recommendations: [],
          aiAnalyzed: false,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content || "";

    // Get token usage
    const inputTokens = aiData.usage?.prompt_tokens || estimateTokens(systemPrompt + userPrompt);
    const outputTokens = aiData.usage?.completion_tokens || estimateTokens(aiContent);

    // Log AI usage
    if (userId) {
      await logAIUsage(supabase, userId, MODEL, "validate-csv-import", inputTokens, outputTokens, {
        clientId,
        platform,
        importedCount,
        importTypes: typesArr,
        fileName: dataSummary.fileName,
        dateRange: effectiveDateRange,
      });
    }

    let validationResult: any;
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
        recommendations: [],
      };
    }

    // Safety override: don't mark partial Instagram imports as error when the imported metric exists.
    const isOnlyLinkClicks = platform === "instagram" && typesArr.length === 1 && typesArr[0] === "link_clicks";
    if (isOnlyLinkClicks && nonNullCounts.linkClicks > 0) {
      if (validationResult.status === "error") validationResult.status = "success";
      if (typeof validationResult.summary === "string") {
        validationResult.summary = "Importação de Cliques no Link do Instagram concluída.";
      }
      if (Array.isArray(validationResult.issues)) {
        validationResult.issues = validationResult.issues.filter((i: string) => {
          const s = (i || "").toLowerCase();
          return !(s.includes("views") || s.includes("open_rate") || s.includes("click_rate"));
        });
      }
    }

    console.log(`[validate-csv-import] Complete - ${inputTokens + outputTokens} tokens`);

    return new Response(
      JSON.stringify({
        ...validationResult,
        aiAnalyzed: true,
        stats: dataSummary.stats,
        dateRange: effectiveDateRange,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("[validate-csv-import] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({
        error: errorMessage,
        status: "error",
        summary: "Erro ao validar importação",
        details: [],
        issues: [errorMessage],
        recommendations: ["Tente importar novamente"],
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
