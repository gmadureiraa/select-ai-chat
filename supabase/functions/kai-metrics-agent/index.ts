import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MetricsRequest {
  clientId: string;
  question: string;
  period?: string;
  platform?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { clientId, question, period, platform } = await req.json() as MetricsRequest;

    if (!clientId) {
      return new Response(
        JSON.stringify({ error: "clientId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch all relevant metrics
    let metricsQuery = supabase
      .from("platform_metrics")
      .select("*")
      .eq("client_id", clientId)
      .order("metric_date", { ascending: false });

    if (platform) {
      metricsQuery = metricsQuery.eq("platform", platform);
    }

    const { data: metrics, error: metricsError } = await metricsQuery.limit(60);

    if (metricsError) {
      console.error("Error fetching metrics:", metricsError);
      return new Response(
        JSON.stringify({ error: "Erro ao buscar métricas" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch Instagram posts for more context
    const { data: instagramPosts } = await supabase
      .from("instagram_posts")
      .select("*")
      .eq("client_id", clientId)
      .order("posted_at", { ascending: false })
      .limit(30);

    // Get client info
    const { data: client } = await supabase
      .from("clients")
      .select("name")
      .eq("id", clientId)
      .single();

    // Build comprehensive metrics context
    const metricsContext = buildMetricsContext(metrics || [], instagramPosts || [], client?.name);

    // Use AI to analyze and respond
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    const systemPrompt = `Você é um especialista em análise de métricas de redes sociais. 
Responda de forma clara e acionável, com insights específicos baseados nos dados fornecidos.
Use números formatados e porcentagens quando relevante.
Seja conciso mas completo.

${metricsContext}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI error:", errorText);
      throw new Error("Erro ao processar análise");
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Metrics agent error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildMetricsContext(
  metrics: any[],
  posts: any[],
  clientName?: string
): string {
  if (metrics.length === 0 && posts.length === 0) {
    return "Não há dados de métricas disponíveis para este cliente.";
  }

  let context = `## Dados de ${clientName || "Cliente"}\n\n`;

  // Group metrics by platform
  const byPlatform: Record<string, any[]> = {};
  metrics.forEach(m => {
    if (!byPlatform[m.platform]) byPlatform[m.platform] = [];
    byPlatform[m.platform].push(m);
  });

  for (const [platform, data] of Object.entries(byPlatform)) {
    context += `### ${platform.charAt(0).toUpperCase() + platform.slice(1)}\n`;
    
    const latest = data[0];
    const oldest = data[data.length - 1];

    if (latest.subscribers !== null) {
      const growth = latest.subscribers - (oldest.subscribers || latest.subscribers);
      const pct = oldest.subscribers ? ((growth / oldest.subscribers) * 100).toFixed(2) : 0;
      context += `- Seguidores: ${latest.subscribers?.toLocaleString("pt-BR")} (${growth >= 0 ? "+" : ""}${growth.toLocaleString("pt-BR")} | ${pct}%)\n`;
    }

    const avgEngagement = data.reduce((s, m) => s + (m.engagement_rate || 0), 0) / data.length;
    if (avgEngagement > 0) {
      context += `- Engajamento médio: ${avgEngagement.toFixed(2)}%\n`;
    }

    const totalLikes = data.reduce((s, m) => s + (m.likes || 0), 0);
    const totalComments = data.reduce((s, m) => s + (m.comments || 0), 0);
    const totalViews = data.reduce((s, m) => s + (m.views || 0), 0);

    if (totalLikes) context += `- Curtidas totais: ${totalLikes.toLocaleString("pt-BR")}\n`;
    if (totalComments) context += `- Comentários totais: ${totalComments.toLocaleString("pt-BR")}\n`;
    if (totalViews) context += `- Views totais: ${totalViews.toLocaleString("pt-BR")}\n`;
    context += `\n`;
  }

  if (posts.length > 0) {
    context += `### Posts Recentes (${posts.length})\n`;
    
    const avgLikes = posts.reduce((s, p) => s + (p.likes || 0), 0) / posts.length;
    const avgComments = posts.reduce((s, p) => s + (p.comments || 0), 0) / posts.length;
    const avgEngagement = posts.reduce((s, p) => s + (p.engagement_rate || 0), 0) / posts.length;

    context += `- Média de curtidas: ${avgLikes.toFixed(0)}\n`;
    context += `- Média de comentários: ${avgComments.toFixed(0)}\n`;
    context += `- Engajamento médio: ${avgEngagement.toFixed(2)}%\n\n`;

    // Top posts
    const sorted = [...posts].sort((a, b) => (b.engagement_rate || 0) - (a.engagement_rate || 0));
    context += `**Top 3 posts:**\n`;
    sorted.slice(0, 3).forEach((p, i) => {
      context += `${i + 1}. ${p.post_type || "Post"} - ${(p.engagement_rate || 0).toFixed(2)}% eng, ${p.likes || 0} likes\n`;
      if (p.caption) {
        context += `   "${p.caption.slice(0, 80)}${p.caption.length > 80 ? "..." : ""}"\n`;
      }
    });
  }

  return context;
}
