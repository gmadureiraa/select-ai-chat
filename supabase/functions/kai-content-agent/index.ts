import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ContentRequest {
  clientId: string;
  request: string;
  format?: string;
  platform?: string;
  workspaceId?: string;
  conversationHistory?: Array<{ role: string; content: string }>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { clientId, request, format, platform, workspaceId, conversationHistory } = await req.json() as ContentRequest;

    if (!clientId) {
      return new Response(
        JSON.stringify({ error: "clientId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch complete client context
    const { data: client } = await supabase
      .from("clients")
      .select("name, description, identity_guide, context_notes, social_media, tags")
      .eq("id", clientId)
      .single();

    // Fetch format rules if available
    let formatRules = null;
    if (format && workspaceId) {
      const { data } = await supabase
        .from("format_rules")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("format_id", format)
        .single();
      formatRules = data;
    }

    // Fetch recent successful content WITH FULL TEXT for style reference
    const { data: recentContent } = await supabase
      .from("client_content_library")
      .select("title, content, content_type, metadata")
      .eq("client_id", clientId)
      .eq("is_favorite", true) // Prioritize favorited content
      .order("created_at", { ascending: false })
      .limit(3);

    // Also fetch more recent content if we don't have enough favorites
    let additionalContent: typeof recentContent = [];
    if (!recentContent || recentContent.length < 3) {
      const { data: moreContent } = await supabase
        .from("client_content_library")
        .select("title, content, content_type, metadata")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(5);
      additionalContent = moreContent || [];
    }

    const allContent = [...(recentContent || []), ...additionalContent].slice(0, 5);

    // Fetch reference library
    const { data: references } = await supabase
      .from("client_reference_library")
      .select("title, content, reference_type")
      .eq("client_id", clientId)
      .limit(5);

    // Fetch global knowledge for extra context
    let globalKnowledge = null;
    if (workspaceId) {
      const { data } = await supabase
        .from("global_knowledge")
        .select("title, summary, category")
        .eq("workspace_id", workspaceId)
        .limit(3);
      globalKnowledge = data;
    }

    // Build rich context
    let contextPrompt = `## Cliente: ${client?.name || "Não especificado"}\n`;
    
    if (client?.description) {
      contextPrompt += `**Descrição:** ${client.description}\n\n`;
    }
    
    if (client?.identity_guide) {
      contextPrompt += `### Guia de Identidade e Tom de Voz\n${client.identity_guide}\n\n`;
    }
    
    if (client?.context_notes) {
      contextPrompt += `### Contexto Adicional\n${client.context_notes}\n\n`;
    }

    if (client?.social_media) {
      const socialMedia = typeof client.social_media === 'string' 
        ? JSON.parse(client.social_media) 
        : client.social_media;
      if (Object.keys(socialMedia).length > 0) {
        contextPrompt += `### Redes Sociais\n`;
        Object.entries(socialMedia).forEach(([key, value]) => {
          if (value) contextPrompt += `- ${key}: ${value}\n`;
        });
        contextPrompt += `\n`;
      }
    }

    if (formatRules) {
      contextPrompt += `### Regras do Formato: ${formatRules.name}\n`;
      contextPrompt += `${formatRules.description || ""}\n`;
      if (formatRules.rules) {
        contextPrompt += `**Estrutura:** ${JSON.stringify(formatRules.rules, null, 2)}\n`;
      }
      if (formatRules.prompt_template) {
        contextPrompt += `**Template:** ${formatRules.prompt_template}\n`;
      }
      contextPrompt += `\n`;
    }

    // Include FULL content samples for style matching
    if (allContent && allContent.length > 0) {
      contextPrompt += `### Exemplos de Conteúdo do Cliente (USE COMO REFERÊNCIA DE TOM E ESTILO)\n`;
      contextPrompt += `*Analise esses exemplos e replique o tom de voz, estrutura e estilo:*\n\n`;
      allContent.forEach((c, i) => {
        const contentPreview = c.content?.substring(0, 800) || "";
        contextPrompt += `**Exemplo ${i + 1}: "${c.title}"** (${c.content_type})\n`;
        contextPrompt += `\`\`\`\n${contentPreview}${c.content && c.content.length > 800 ? "..." : ""}\n\`\`\`\n\n`;
      });
    }

    if (references && references.length > 0) {
      contextPrompt += `### Referências do Cliente\n`;
      references.forEach((r, i) => {
        contextPrompt += `${i + 1}. **${r.title}** (${r.reference_type})\n`;
        if (r.content) {
          contextPrompt += `   ${r.content.substring(0, 200)}...\n`;
        }
      });
      contextPrompt += `\n`;
    }

    if (globalKnowledge && globalKnowledge.length > 0) {
      contextPrompt += `### Base de Conhecimento\n`;
      globalKnowledge.forEach((k) => {
        contextPrompt += `- **${k.title}** (${k.category}): ${k.summary?.substring(0, 150) || ""}...\n`;
      });
      contextPrompt += `\n`;
    }

    const systemPrompt = `Você é um copywriter especialista em criação de conteúdo para redes sociais e marketing digital.

${contextPrompt}

## Suas Responsabilidades:

1. **Manter a Identidade**: Siga rigorosamente o guia de identidade e tom de voz do cliente
2. **Replicar o Estilo**: Use os exemplos de conteúdo como referência para estrutura e linguagem
3. **Copywriting Estratégico**: Use gatilhos mentais, CTAs e técnicas de persuasão apropriadas
4. **Formato Adequado**: Respeite as regras de formato quando especificadas
5. **Conteúdo Completo**: Entregue o conteúdo PRONTO PARA USO, não apenas sugestões

## Diretrizes de Criação:

- Seja conciso e impactante
- Use emojis com moderação e de forma estratégica
- Inclua CTAs quando apropriado
- Formate para fácil leitura (parágrafos curtos, bullet points quando necessário)
- Mantenha autenticidade - evite parecer genérico ou "ChatGPT-like"
- Se for newsletter, siga estrutura com assunto, preview text e corpo
- Se for carrossel, divida em slides claros

## Formato Solicitado: ${format || "post"}
## Plataforma: ${platform || "Instagram"}

Agora, crie o conteúdo solicitado mantendo 100% de fidelidade ao tom e estilo do cliente.`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    // Build messages array with conversation history
    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

    // Add conversation history if provided
    if (conversationHistory && conversationHistory.length > 0) {
      messages.push(...conversationHistory.slice(-10)); // Keep last 10 messages
    }

    // Add current request
    messages.push({ role: "user", content: request });

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI error:", errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error("Erro ao gerar conteúdo");
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Content agent error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
