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
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { clientId, request, format, platform, workspaceId } = await req.json() as ContentRequest;

    if (!clientId) {
      return new Response(
        JSON.stringify({ error: "clientId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch client context
    const { data: client } = await supabase
      .from("clients")
      .select("name, description, identity_guide, context_notes")
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

    // Fetch recent successful content for reference
    const { data: recentContent } = await supabase
      .from("client_content_library")
      .select("title, content, content_type")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(5);

    // Fetch reference library
    const { data: references } = await supabase
      .from("client_reference_library")
      .select("title, content, reference_type")
      .eq("client_id", clientId)
      .limit(5);

    // Build context
    let contextPrompt = `## Cliente: ${client?.name || "Não especificado"}\n`;
    
    if (client?.description) {
      contextPrompt += `Descrição: ${client.description}\n`;
    }
    
    if (client?.identity_guide) {
      contextPrompt += `\n### Guia de Identidade\n${client.identity_guide}\n`;
    }
    
    if (client?.context_notes) {
      contextPrompt += `\n### Notas de Contexto\n${client.context_notes}\n`;
    }

    if (formatRules) {
      contextPrompt += `\n### Regras do Formato: ${formatRules.name}\n`;
      contextPrompt += `${formatRules.description || ""}\n`;
      if (formatRules.rules) {
        contextPrompt += `Estrutura: ${JSON.stringify(formatRules.rules, null, 2)}\n`;
      }
      if (formatRules.prompt_template) {
        contextPrompt += `Template: ${formatRules.prompt_template}\n`;
      }
    }

    if (recentContent && recentContent.length > 0) {
      contextPrompt += `\n### Exemplos de Conteúdo Anterior\n`;
      recentContent.forEach((c, i) => {
        contextPrompt += `${i + 1}. "${c.title}" (${c.content_type})\n`;
      });
    }

    if (references && references.length > 0) {
      contextPrompt += `\n### Referências do Cliente\n`;
      references.forEach((r, i) => {
        contextPrompt += `${i + 1}. ${r.title} (${r.reference_type})\n`;
      });
    }

    const systemPrompt = `Você é um copywriter especialista em criação de conteúdo para redes sociais.
Seu objetivo é criar conteúdo envolvente, relevante e alinhado com a identidade do cliente.

${contextPrompt}

## Diretrizes de Criação:
1. Mantenha o tom de voz consistente com o guia de identidade
2. Use gatilhos mentais e técnicas de copywriting
3. Seja conciso e impactante
4. Inclua CTAs quando apropriado
5. Formate o conteúdo para fácil leitura
6. Se for newsletter, siga a estrutura específica do formato
7. Forneça o conteúdo pronto para uso, não apenas sugestões

Formato solicitado: ${format || "post"}
Plataforma: ${platform || "Instagram"}`;

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
