import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PlanningRequest {
  clientId: string;
  workspaceId: string;
  userId: string;
  request: string;
  action?: "suggest" | "create" | "schedule";
  quantity?: number;
  schedule?: {
    pattern: "weekly" | "daily";
    dayOfWeek?: number;
    startDate: string;
    count: number;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { clientId, workspaceId, userId, request, action, quantity, schedule } = 
      await req.json() as PlanningRequest;

    if (!clientId || !workspaceId || !userId) {
      return new Response(
        JSON.stringify({ error: "clientId, workspaceId e userId são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch client context
    const { data: client } = await supabase
      .from("clients")
      .select("name, description, identity_guide")
      .eq("id", clientId)
      .single();

    // Fetch recent performance for context
    const { data: topPosts } = await supabase
      .from("instagram_posts")
      .select("caption, post_type, engagement_rate, likes")
      .eq("client_id", clientId)
      .order("engagement_rate", { ascending: false })
      .limit(5);

    // Build context
    let contextPrompt = `## Cliente: ${client?.name || "Não especificado"}\n`;
    if (client?.description) contextPrompt += `${client.description}\n`;
    
    if (topPosts && topPosts.length > 0) {
      contextPrompt += `\n### Posts com Melhor Performance\n`;
      topPosts.forEach((p, i) => {
        contextPrompt += `${i + 1}. ${p.post_type || "Post"} - ${(p.engagement_rate || 0).toFixed(2)}% eng\n`;
        if (p.caption) contextPrompt += `   "${p.caption.slice(0, 60)}..."\n`;
      });
    }

    const systemPrompt = `Você é um estrategista de conteúdo especializado em planejamento editorial.
Seu objetivo é sugerir ideias de conteúdo relevantes e estratégicas.

${contextPrompt}

## Sua Tarefa:
${action === "suggest" ? "Gerar ideias de conteúdo criativas e estratégicas" : ""}
${action === "create" ? "Criar cards de planejamento prontos para execução" : ""}
${action === "schedule" ? "Sugerir um cronograma de publicações" : ""}

${quantity ? `Quantidade solicitada: ${quantity} ideias/posts` : ""}

## Formato de Resposta:
Para cada ideia, forneça:
1. **Título**: Nome curto e descritivo
2. **Formato**: (post, carrossel, reels, stories, etc.)
3. **Objetivo**: O que queremos alcançar
4. **Conceito**: Breve descrição do conteúdo

Se o usuário pedir para criar no planejamento, responda com JSON no formato:
\`\`\`json
{
  "ideas": [
    {
      "title": "...",
      "format": "...",
      "description": "...",
      "platform": "instagram"
    }
  ],
  "createInPlanning": true
}
\`\`\``;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

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
          { role: "user", content: request },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI error:", errorText);
      throw new Error("Erro ao gerar planejamento");
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Planning agent error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
