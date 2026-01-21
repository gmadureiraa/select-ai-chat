import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Citation {
  id: string;
  type: "content" | "reference" | "format";
  title: string;
}

interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

interface RequestBody {
  message: string;
  clientId: string;
  citations?: Citation[];
  history?: HistoryMessage[];
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

    const body = await req.json() as RequestBody;
    const { message, clientId, citations, history } = body;

    console.log("[kai-simple-chat] Request:", { clientId, citationsCount: citations?.length });

    if (!clientId || !message) {
      return new Response(
        JSON.stringify({ error: "clientId e message são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Fetch client context (always)
    const { data: client } = await supabase
      .from("clients")
      .select("name, description, identity_guide")
      .eq("id", clientId)
      .single();

    if (!client) {
      return new Response(
        JSON.stringify({ error: "Cliente não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Fetch cited content (if any)
    let citedContent = "";
    if (citations && citations.length > 0) {
      for (const citation of citations) {
        if (citation.type === "content") {
          const { data } = await supabase
            .from("client_content_library")
            .select("title, content, content_type")
            .eq("id", citation.id)
            .single();
          
          if (data) {
            citedContent += `\n### Referência: ${data.title} (${data.content_type})\n${data.content}\n`;
          }
        } else if (citation.type === "reference") {
          const { data } = await supabase
            .from("client_reference_library")
            .select("title, content, reference_type")
            .eq("id", citation.id)
            .single();
          
          if (data) {
            citedContent += `\n### Referência externa: ${data.title} (${data.reference_type})\n${data.content}\n`;
          }
        } else if (citation.type === "format") {
          // Get format rules from kai_documentation
          const { data } = await supabase
            .from("kai_documentation")
            .select("content, checklist")
            .eq("doc_type", "format")
            .eq("doc_key", citation.title.toLowerCase())
            .single();
          
          if (data) {
            citedContent += `\n### Regras do formato ${citation.title}:\n${data.content}\n`;
            if (data.checklist) {
              citedContent += `\nChecklist:\n${JSON.stringify(data.checklist)}\n`;
            }
          }
        }
      }
    }

    // 3. Build system prompt (lean and focused)
    const systemPrompt = `Você é o kAI, um assistente especializado em criação de conteúdo.

## Cliente: ${client.name}
${client.description ? `Descrição: ${client.description}` : ""}

${client.identity_guide ? `## Guia de Identidade\n${client.identity_guide.substring(0, 5000)}` : ""}

${citedContent ? `## Materiais Citados\n${citedContent.substring(0, 10000)}` : ""}

## Instruções
- Sempre siga o tom de voz e estilo do cliente
- Crie conteúdo original e relevante
- Seja direto, prático e objetivo
- Se um formato foi citado, siga as regras específicas dele
- Use as referências citadas como inspiração quando disponíveis`;

    // 4. Build messages array
    const apiMessages = [
      { role: "system", content: systemPrompt },
      ...(history || []).map(h => ({ role: h.role, content: h.content })),
      { role: "user", content: message },
    ];

    // 5. Call AI Gateway with streaming
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      // Fallback to Google API
      const GOOGLE_API_KEY = Deno.env.get("GOOGLE_AI_STUDIO_API_KEY");
      if (!GOOGLE_API_KEY) {
        return new Response(
          JSON.stringify({ error: "Chave de API não configurada" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Use Gemini directly
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?key=${GOOGLE_API_KEY}&alt=sse`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: apiMessages.map(m => ({
              role: m.role === "assistant" ? "model" : m.role === "system" ? "user" : "user",
              parts: [{ text: m.content }],
            })),
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 4096,
            },
          }),
        }
      );

      if (!geminiResponse.ok) {
        const errorText = await geminiResponse.text();
        console.error("[kai-simple-chat] Gemini error:", errorText);
        return new Response(
          JSON.stringify({ error: "Erro ao gerar resposta" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Transform Gemini SSE to OpenAI format
      const reader = geminiResponse.body?.getReader();
      if (!reader) {
        return new Response(
          JSON.stringify({ error: "Sem resposta do servidor" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const decoder = new TextDecoder();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split("\n");

              for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                const data = line.slice(6).trim();
                if (!data) continue;

                try {
                  const parsed = JSON.parse(data);
                  const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                  if (text) {
                    // Convert to OpenAI format
                    const openAIFormat = {
                      choices: [{ delta: { content: text } }],
                    };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(openAIFormat)}\n\n`));
                  }
                } catch {
                  // Ignore parse errors
                }
              }
            }
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          } catch (e) {
            controller.error(e);
          }
        },
      });

      return new Response(stream, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        },
      });
    }

    // Use Lovable AI Gateway
    const gatewayResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: apiMessages,
          stream: true,
          temperature: 0.7,
          max_tokens: 4096,
        }),
      }
    );

    if (!gatewayResponse.ok) {
      if (gatewayResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit atingido" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (gatewayResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await gatewayResponse.text();
      console.error("[kai-simple-chat] Gateway error:", errorText);
      return new Response(
        JSON.stringify({ error: "Erro ao gerar resposta" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Stream the response directly
    return new Response(gatewayResponse.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });

  } catch (error) {
    console.error("[kai-simple-chat] Error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
