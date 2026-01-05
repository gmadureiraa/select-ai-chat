import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SmartPlannerRequest {
  clientId: string;
  workspaceId: string;
  userId: string;
  quantity: number;
  format: string | null;
  column: string | null;
  themeHint: string | null;
  schedulingHint: string | null;
  dateHint: string | null;
  rawMessage: string;
}

interface GeneratedIdea {
  title: string;
  description: string;
  format: string;
  objective: string;
  hook: string;
}

interface CreatedCard {
  id: string;
  title: string;
  format: string;
  column: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const requestData = await req.json() as SmartPlannerRequest;
    const { 
      clientId, 
      workspaceId, 
      userId, 
      quantity, 
      format, 
      column, 
      themeHint, 
      schedulingHint,
      dateHint,
      rawMessage 
    } = requestData;

    console.log("[SmartPlanner] Request:", { clientId, workspaceId, quantity, format, column, themeHint });

    if (!clientId || !workspaceId || !userId) {
      return new Response(
        JSON.stringify({ error: "clientId, workspaceId e userId são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Fetch client context
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, name, description, identity_guide, brand_assets")
      .eq("id", clientId)
      .single();

    if (clientError) {
      console.error("[SmartPlanner] Client fetch error:", clientError);
      return new Response(
        JSON.stringify({ error: "Cliente não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Fetch top performing posts for context
    const { data: topPosts } = await supabase
      .from("instagram_posts")
      .select("caption, post_type, engagement_rate, likes, comments")
      .eq("client_id", clientId)
      .order("engagement_rate", { ascending: false })
      .limit(10);

    // 3. Fetch content library for inspiration
    const { data: libraryItems } = await supabase
      .from("client_content_library")
      .select("title, content, content_type")
      .eq("client_id", clientId)
      .limit(5);

    // 4. Fetch reference library
    const { data: references } = await supabase
      .from("client_reference_library")
      .select("title, content, reference_type")
      .eq("client_id", clientId)
      .limit(5);

    // 5. Build context prompt
    let contextPrompt = `## Cliente: ${client.name}\n`;
    if (client.description) contextPrompt += `Descrição: ${client.description}\n`;
    if (client.identity_guide) contextPrompt += `Guia de Identidade: ${client.identity_guide.substring(0, 500)}...\n`;

    if (topPosts && topPosts.length > 0) {
      contextPrompt += `\n### Posts com Melhor Performance (para referência de estilo)\n`;
      topPosts.slice(0, 5).forEach((p, i) => {
        contextPrompt += `${i + 1}. ${p.post_type || "Post"} - ${(p.engagement_rate || 0).toFixed(2)}% engagement\n`;
        if (p.caption) contextPrompt += `   "${p.caption.slice(0, 100)}..."\n`;
      });
    }

    if (libraryItems && libraryItems.length > 0) {
      contextPrompt += `\n### Conteúdos na Biblioteca (evitar repetição)\n`;
      libraryItems.forEach((item, i) => {
        contextPrompt += `${i + 1}. ${item.title} (${item.content_type})\n`;
      });
    }

    // 6. Build generation prompt
    const formatInstruction = format 
      ? `Formato específico: ${format}` 
      : "Varie os formatos (carrossel, post único, reels, stories)";

    const themeInstruction = themeHint 
      ? `Tema solicitado: ${themeHint}` 
      : "Tema livre baseado no perfil do cliente";

    const systemPrompt = `Você é um estrategista de conteúdo especializado em criar ideias de conteúdo criativas e estratégicas.

${contextPrompt}

## Sua Tarefa
Gerar exatamente ${quantity} ideias de conteúdo únicas e estratégicas.

${formatInstruction}
${themeInstruction}

## Regras
1. Cada ideia deve ser única e diferente das outras
2. Use linguagem e estilo adequados ao cliente
3. Baseie-se nos posts de sucesso para entender o que funciona
4. Evite repetir temas já na biblioteca do cliente
5. Seja específico e actionável

## Formato de Resposta
Responda APENAS com um JSON válido no formato:
{
  "ideas": [
    {
      "title": "Título curto e impactante",
      "description": "Descrição em 1-2 frases do conceito",
      "format": "carrossel|post|reels|stories|newsletter",
      "objective": "Objetivo do conteúdo (educar, engajar, converter, etc)",
      "hook": "Gancho inicial para prender atenção"
    }
  ]
}`;

    // 7. Call AI to generate ideas
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    console.log("[SmartPlanner] Generating ideas with AI...");
    
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Gere ${quantity} ideias de conteúdo para ${client.name}. ${rawMessage}` },
        ],
        temperature: 0.8,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("[SmartPlanner] AI error:", errorText);
      throw new Error("Erro ao gerar ideias com IA");
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content;
    
    console.log("[SmartPlanner] AI response:", aiContent?.substring(0, 200));

    // 8. Parse AI response
    let ideas: GeneratedIdea[] = [];
    try {
      // Extract JSON from response (handle markdown code blocks)
      let jsonStr = aiContent;
      const jsonMatch = aiContent.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      } else {
        // Try to find JSON object directly
        const objectMatch = aiContent.match(/\{[\s\S]*\}/);
        if (objectMatch) {
          jsonStr = objectMatch[0];
        }
      }
      
      const parsed = JSON.parse(jsonStr);
      ideas = parsed.ideas || [];
    } catch (parseError) {
      console.error("[SmartPlanner] Parse error:", parseError);
      // Fallback: create simple ideas based on request
      for (let i = 0; i < quantity; i++) {
        ideas.push({
          title: `Ideia ${i + 1}: ${themeHint || format || "Conteúdo"}`,
          description: `Ideia gerada automaticamente para ${client.name}`,
          format: format || "post",
          objective: "engajar",
          hook: "Você sabia que...",
        });
      }
    }

    // 9. Find target column
    const columnMap: Record<string, string> = {
      "ideias": "idea",
      "rascunho": "draft",
      "revisao": "review",
      "aprovado": "approved",
      "agendado": "scheduled",
    };
    
    const targetColumnType = column ? columnMap[column] || "idea" : "idea";
    
    const { data: columns } = await supabase
      .from("kanban_columns")
      .select("id, name, column_type")
      .eq("workspace_id", workspaceId)
      .eq("column_type", targetColumnType)
      .limit(1);

    const targetColumn = columns?.[0];
    if (!targetColumn) {
      // Get first column as fallback
      const { data: fallbackColumns } = await supabase
        .from("kanban_columns")
        .select("id, name, column_type")
        .eq("workspace_id", workspaceId)
        .order("position", { ascending: true })
        .limit(1);
      
      if (!fallbackColumns?.length) {
        throw new Error("Nenhuma coluna encontrada no workspace");
      }
    }

    const columnId = targetColumn?.id || columns?.[0]?.id;
    const columnName = targetColumn?.name || "Ideias";

    // 10. Get max position in column
    const { data: existingItems } = await supabase
      .from("planning_items")
      .select("position")
      .eq("workspace_id", workspaceId)
      .eq("column_id", columnId)
      .order("position", { ascending: false })
      .limit(1);

    let currentPosition = existingItems?.[0]?.position ?? -1;

    // 11. Create planning items in batch
    const createdCards: CreatedCard[] = [];
    const platformMap: Record<string, string> = {
      "carrossel": "instagram",
      "post": "instagram",
      "reels": "instagram",
      "stories": "instagram",
      "newsletter": "newsletter",
      "thread": "twitter",
      "tweet": "twitter",
      "blog": "blog",
    };

    for (const idea of ideas) {
      currentPosition++;
      
      const platform = platformMap[idea.format] || "instagram";
      
      const { data: newCard, error: insertError } = await supabase
        .from("planning_items")
        .insert({
          workspace_id: workspaceId,
          client_id: clientId,
          column_id: columnId,
          title: idea.title,
          description: `${idea.description}\n\n**Objetivo:** ${idea.objective}\n**Gancho:** ${idea.hook}`,
          platform: platform,
          content_type: idea.format,
          status: targetColumnType,
          priority: "medium",
          position: currentPosition,
          labels: themeHint ? [themeHint] : [],
          metadata: {
            generated_by: "kai-smart-planner",
            original_request: rawMessage,
            objective: idea.objective,
            hook: idea.hook,
          },
          created_by: userId,
        })
        .select("id, title")
        .single();

      if (insertError) {
        console.error("[SmartPlanner] Insert error:", insertError);
        continue;
      }

      createdCards.push({
        id: newCard.id,
        title: newCard.title,
        format: idea.format,
        column: columnName,
      });
    }

    console.log("[SmartPlanner] Created", createdCards.length, "cards");

    // 12. Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: `${createdCards.length} cards criados com sucesso`,
        clientName: client.name,
        column: columnName,
        format: format,
        cards: createdCards,
        ideas: ideas,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[SmartPlanner] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
