import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clientId, clientName, context } = await req.json();

    if (!context) {
      throw new Error("Context is required");
    }

    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_AI_STUDIO_API_KEY");
    if (!GOOGLE_API_KEY) {
      throw new Error("GOOGLE_AI_STUDIO_API_KEY not configured");
    }

    // Build context summary for AI
    const contextSummary = `
Cliente: ${clientName}

## Instagram
- Seguidores: ${context.instagram?.followers?.toLocaleString() || 0}
- Engajamento médio: ${context.instagram?.avgEngagement?.toFixed(2) || 0}%
- Total de posts: ${context.instagram?.totalPosts || 0}
${context.instagram?.topPosts?.length ? `
Top Posts:
${context.instagram.topPosts.slice(0, 3).map((p: any, i: number) => 
  `${i + 1}. "${p.caption?.slice(0, 50) || 'Sem legenda'}..." - ${p.likes} likes, ${p.engagement?.toFixed(1) || 0}% eng.`
).join('\n')}` : ''}

## YouTube
- Views totais: ${context.youtube?.totalViews?.toLocaleString() || 0}
- Horas assistidas: ${context.youtube?.watchHours?.toLocaleString() || 0}
- Subscribers ganhos: ${context.youtube?.subscribers?.toLocaleString() || 0}
${context.youtube?.topVideos?.length ? `
Top Vídeos:
${context.youtube.topVideos.slice(0, 3).map((v: any, i: number) => 
  `${i + 1}. "${v.title?.slice(0, 50) || 'Sem título'}..." - ${v.views?.toLocaleString() || 0} views, CTR ${v.ctr?.toFixed(1) || 0}%`
).join('\n')}` : ''}
`;

    const prompt = `Você é um especialista em análise de redes sociais e marketing digital. Analise as métricas de performance abaixo e gere insights práticos e acionáveis.

${contextSummary}

Gere um resumo executivo breve (máximo 4-5 frases) com:
1. Visão geral do desempenho atual
2. Destaque do melhor conteúdo e por que funcionou
3. Oportunidade de melhoria identificada
4. Recomendação concreta para próximos passos

Seja direto, prático e específico. Evite generalidades. Use números quando relevante.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_API_KEY}`,
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
      console.error("Gemini API error:", errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const insights = data.candidates?.[0]?.content?.parts?.[0]?.text || "Não foi possível gerar insights.";

    return new Response(
      JSON.stringify({ insights }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating insights:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
