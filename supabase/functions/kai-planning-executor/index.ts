import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PlanningCard {
  title: string;
  description?: string;
  platform: string;
  scheduledDate?: string;
  format?: string;
}

interface PlanningRequest {
  clientId: string;
  workspaceId: string;
  cards: PlanningCard[];
  generateContent?: boolean;
  sourceUrl?: string;
}

/**
 * Parse date from various Portuguese formats
 * Supports: DD/MM/YYYY, DD-MM-YYYY, "amanhã", "próxima segunda", "semana que vem", etc.
 */
function parseDate(dateStr: string): string | null {
  const now = new Date();
  const lowerStr = dateStr.toLowerCase().trim();
  
  // DD/MM/YYYY or DD-MM-YYYY
  const dateMatch = lowerStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dateMatch) {
    const [, day, month, year] = dateMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // DD/MM (assume current year)
  const shortDateMatch = lowerStr.match(/(\d{1,2})[\/\-](\d{1,2})(?!\d)/);
  if (shortDateMatch) {
    const [, day, month] = shortDateMatch;
    const year = now.getFullYear();
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Relative dates
  if (/hoje/i.test(lowerStr)) {
    return now.toISOString().split('T')[0];
  }
  
  if (/amanh[ãa]/i.test(lowerStr)) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }
  
  // Day of week
  const weekdays: Record<string, number> = {
    'domingo': 0, 'segunda': 1, 'terça': 2, 'terca': 2,
    'quarta': 3, 'quinta': 4, 'sexta': 5, 'sábado': 6, 'sabado': 6
  };
  
  for (const [day, num] of Object.entries(weekdays)) {
    if (lowerStr.includes(day)) {
      const targetDate = new Date(now);
      const currentDay = now.getDay();
      let daysToAdd = num - currentDay;
      if (daysToAdd <= 0) daysToAdd += 7; // Next week if day has passed
      targetDate.setDate(targetDate.getDate() + daysToAdd);
      return targetDate.toISOString().split('T')[0];
    }
  }
  
  // "próxima semana", "semana que vem"
  if (/pr[oó]xima\s+semana|semana\s+que\s+vem/i.test(lowerStr)) {
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);
    return nextWeek.toISOString().split('T')[0];
  }
  
  return null;
}

/**
 * Generate dates distributed across the week
 */
function distributeAcrossWeek(count: number, startDate?: Date): string[] {
  const dates: string[] = [];
  const start = startDate || new Date();
  const currentDay = start.getDay();
  
  // Prefer weekdays (Mon-Fri) for social content
  const preferredDays = [1, 2, 3, 4, 5]; // Monday to Friday
  let dayIndex = 0;
  
  for (let i = 0; i < count; i++) {
    const targetDate = new Date(start);
    const targetDay = preferredDays[dayIndex % preferredDays.length];
    
    let daysToAdd = targetDay - currentDay;
    if (daysToAdd <= 0) daysToAdd += 7;
    daysToAdd += Math.floor(i / 5) * 7; // Add weeks for more than 5 posts
    
    targetDate.setDate(start.getDate() + daysToAdd);
    dates.push(targetDate.toISOString().split('T')[0]);
    
    dayIndex++;
  }
  
  return dates.sort();
}

/**
 * Generate content based on URL or topic
 */
async function generateContentForCard(
  supabase: any,
  client: any,
  card: PlanningCard,
  sourceUrl?: string
): Promise<{ title: string; description: string }> {
  const GOOGLE_API_KEY = Deno.env.get("GOOGLE_AI_STUDIO_API_KEY");
  if (!GOOGLE_API_KEY) {
    return { title: card.title, description: card.description || "" };
  }

  let urlContext = "";
  
  // If there's a URL, try to extract content from it
  if (sourceUrl) {
    // Try YouTube
    if (sourceUrl.includes("youtube.com") || sourceUrl.includes("youtu.be")) {
      const { data: ytData } = await supabase.functions.invoke("extract-youtube", {
        body: { url: sourceUrl },
      });
      if (ytData?.transcript) {
        urlContext = `\n## Conteúdo do Vídeo YouTube\nTítulo: ${ytData.title || 'N/A'}\nTranscrição: ${ytData.transcript.substring(0, 3000)}`;
      }
    } else {
      // Try generic scrape
      const { data: scrapeData } = await supabase.functions.invoke("firecrawl-scrape", {
        body: { url: sourceUrl },
      });
      if (scrapeData?.data?.markdown) {
        urlContext = `\n## Conteúdo do Artigo\n${scrapeData.data.markdown.substring(0, 3000)}`;
      }
    }
  }

  const platformInstructions: Record<string, string> = {
    instagram: "Crie uma legenda para Instagram: engajadora, com hook forte, máximo 2200 caracteres, poucos emojis.",
    twitter: "Crie um tweet: direto, impactante, máximo 280 caracteres.",
    linkedin: "Crie um post LinkedIn: profissional, storytelling, insights valiosos.",
    youtube: "Crie um título e descrição para YouTube: SEO otimizado, gancho forte.",
    newsletter: "Crie um título e resumo para newsletter: valor claro, CTA forte.",
  };

  const prompt = `Você é um especialista em criação de conteúdo para ${client.name}.
${client.identity_guide ? `\nGuia de Identidade:\n${client.identity_guide.substring(0, 2000)}` : ""}
${urlContext}

TAREFA: ${platformInstructions[card.platform] || "Crie conteúdo para redes sociais."}

Tema: ${card.title}
${card.format ? `Formato: ${card.format}` : ""}

Responda APENAS com JSON no formato:
{
  "title": "título otimizado para a plataforma",
  "description": "conteúdo completo pronto para publicar"
}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    if (!response.ok) {
      console.error("[kai-planning-executor] Gemini error:", response.status);
      return { title: card.title, description: card.description || "" };
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*"title"[\s\S]*"description"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        title: parsed.title || card.title,
        description: parsed.description || card.description || "",
      };
    }
  } catch (error) {
    console.error("[kai-planning-executor] Content generation error:", error);
  }

  return { title: card.title, description: card.description || "" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json() as PlanningRequest;
    const { clientId, workspaceId, cards, generateContent, sourceUrl } = body;

    console.log("[kai-planning-executor] Request:", {
      userId: user.id,
      clientId,
      workspaceId,
      cardsCount: cards?.length,
      generateContent,
      hasSourceUrl: !!sourceUrl,
    });

    if (!clientId || !workspaceId || !cards || cards.length === 0) {
      return new Response(
        JSON.stringify({ error: "clientId, workspaceId e cards são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get client info
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("name, identity_guide")
      .eq("id", clientId)
      .single();

    if (clientError || !client) {
      return new Response(
        JSON.stringify({ error: "Cliente não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get first column (Ideias) for the workspace
    const { data: columns, error: columnsError } = await supabase
      .from("kanban_columns")
      .select("id")
      .eq("workspace_id", workspaceId)
      .order("position", { ascending: true })
      .limit(1);

    if (columnsError || !columns || columns.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nenhuma coluna encontrada no planejamento" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const columnId = columns[0].id;
    const createdCards: any[] = [];

    // Create cards
    for (const card of cards) {
      let finalTitle = card.title;
      let finalDescription = card.description || "";

      // Generate content if requested
      if (generateContent) {
        const generated = await generateContentForCard(supabase, client, card, sourceUrl);
        finalTitle = generated.title;
        finalDescription = generated.description;
      }

      // Parse scheduled date
      let scheduledAt: string | null = null;
      if (card.scheduledDate) {
        scheduledAt = parseDate(card.scheduledDate);
      }

      const { data: newCard, error: insertError } = await supabase
        .from("planning_items")
        .insert({
          title: finalTitle,
          description: finalDescription,
          client_id: clientId,
          workspace_id: workspaceId,
          column_id: columnId,
          scheduled_at: scheduledAt,
          platform: card.platform,
          status: "todo",
          created_by: user.id,
        })
        .select()
        .single();

      if (insertError) {
        console.error("[kai-planning-executor] Insert error:", insertError);
        continue;
      }

      createdCards.push(newCard);
    }

    console.log("[kai-planning-executor] Created cards:", createdCards.length);

    return new Response(
      JSON.stringify({
        success: true,
        cardsCreated: createdCards.length,
        cards: createdCards,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[kai-planning-executor] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
