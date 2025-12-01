import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId, conversationId, userMessage, model = "google/gemini-2.5-flash", connectedItemIds } = await req.json();

    if (!projectId || !userMessage) {
      throw new Error("projectId e userMessage são obrigatórios");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Variáveis de ambiente não configuradas");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log("Analisando pesquisa para projeto:", projectId);

      // Buscar itens e conexões do projeto
      // Se connectedItemIds for fornecido, buscar apenas esses items
      let itemsQuery = supabase
        .from("research_items")
        .select("*")
        .eq("project_id", projectId);
      
      if (connectedItemIds && connectedItemIds.length > 0) {
        itemsQuery = itemsQuery.in("id", connectedItemIds);
      }
      
      const { data: items, error: itemsError } = await itemsQuery;

      const { data: connections, error: connectionsError } = await supabase
        .from("research_connections")
        .select("*")
        .eq("project_id", projectId);

      if (itemsError) throw itemsError;
      if (connectionsError) throw connectionsError;

    // Buscar mensagens anteriores da conversa
    const { data: previousMessages, error: messagesError } = await supabase
      .from("research_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (messagesError) throw messagesError;

    // Construir contexto dos materiais com conexões
    let materialsContext = connectedItemIds 
      ? "### Materiais Conectados\n\n" 
      : "### Materiais do Projeto\n\n";
    
    if (items && items.length > 0) {
      for (const item of items) {
        materialsContext += `**${item.title || item.type.toUpperCase()}** (${item.type})\n`;
        if (item.content) {
          materialsContext += `${item.content.substring(0, 2000)}${item.content.length > 2000 ? "..." : ""}\n\n`;
        }
        if (item.source_url) {
          materialsContext += `Fonte: ${item.source_url}\n\n`;
        }
      }

      // Adicionar informações sobre conexões
      if (connections && connections.length > 0) {
        materialsContext += "\n### Conexões entre Materiais\n\n";
        const itemsMap = new Map(items.map((item: any) => [item.id, item]));
        
        for (const conn of connections) {
          const source = itemsMap.get(conn.source_id);
          const target = itemsMap.get(conn.target_id);
          if (source && target) {
            materialsContext += `• "${source.title || source.type}" → "${target.title || target.type}"${conn.label ? ` (${conn.label})` : ""}\n`;
          }
        }
        materialsContext += "\n";
      }
    } else {
      materialsContext += "Nenhum material adicionado ainda.\n\n";
    }

    // Construir mensagens para a IA
    const messages = [
      {
        role: "system",
        content: `Você é um assistente de pesquisa especializado em analisar materiais multimodais (vídeos, textos, áudios, imagens).

Você tem acesso aos seguintes materiais do projeto:

${materialsContext}

Sua função é:
- Analisar e sintetizar informações dos materiais disponíveis
- Responder perguntas sobre o conteúdo
- Identificar padrões e insights
- Fazer conexões entre diferentes materiais (considere as conexões já estabelecidas!)
- Sugerir próximos passos de pesquisa
- Quando houver conexões entre materiais, use-as para dar respostas mais completas e contextualizadas

Seja conciso, objetivo e baseie suas respostas nos materiais fornecidos.`,
      },
      ...previousMessages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      {
        role: "user",
        content: userMessage,
      },
    ];

    console.log("Chamando Lovable AI com modelo:", model);

    // Chamar Lovable AI
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 2000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("Erro na chamada AI:", aiResponse.status, errorText);
      throw new Error(`Erro na IA: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const response = aiData.choices[0].message.content;

    console.log("Resposta gerada com sucesso");

    return new Response(
      JSON.stringify({ response }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Erro em analyze-research:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
