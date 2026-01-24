import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Constantes
const MAX_IDENTITY_GUIDE_LENGTH = 8000;
const MAX_CITED_CONTENT_LENGTH = 12000;
const MAX_HISTORY_MESSAGES = 15;

// Planos que têm acesso ao kAI Chat
const ALLOWED_PLANS = ["pro", "enterprise", "agency"];

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

    console.log("[kai-simple-chat] Request:", { 
      userId: user.id,
      clientId, 
      citationsCount: citations?.length,
      historyCount: history?.length,
      messageLength: message?.length 
    });

    if (!clientId || !message) {
      return new Response(
        JSON.stringify({ error: "clientId e message são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Fetch client and verify workspace access
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("name, description, identity_guide, workspace_id")
      .eq("id", clientId)
      .single();

    if (clientError || !client) {
      console.error("[kai-simple-chat] Client not found:", clientError);
      return new Response(
        JSON.stringify({ error: "Cliente não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Verify subscription plan
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("subscription_plan")
      .eq("id", client.workspace_id)
      .single();

    if (workspace) {
      const plan = workspace.subscription_plan?.toLowerCase() || "starter";
      if (!ALLOWED_PLANS.includes(plan)) {
        console.log("[kai-simple-chat] Access denied for plan:", plan);
        return new Response(
          JSON.stringify({ error: "O kAI Chat requer o plano Pro ou superior" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 3. Fetch cited content (if any) - with smart truncation
    let citedContent = "";
    if (citations && citations.length > 0) {
      // Process citations in parallel for better performance
      const citationPromises = citations.map(async (citation) => {
        if (citation.type === "content") {
          const { data } = await supabase
            .from("client_content_library")
            .select("title, content, content_type, created_at")
            .eq("id", citation.id)
            .single();
          
          if (data) {
            return {
              type: "content",
              title: data.title,
              content: data.content,
              contentType: data.content_type,
              createdAt: data.created_at,
            };
          }
        } else if (citation.type === "reference") {
          const { data } = await supabase
            .from("client_reference_library")
            .select("title, content, reference_type, created_at")
            .eq("id", citation.id)
            .single();
          
          if (data) {
            return {
              type: "reference",
              title: data.title,
              content: data.content,
              contentType: data.reference_type,
              createdAt: data.created_at,
            };
          }
        } else if (citation.type === "format") {
          const { data } = await supabase
            .from("kai_documentation")
            .select("content, checklist")
            .eq("doc_type", "format")
            .eq("doc_key", citation.title.toLowerCase())
            .single();
          
          if (data) {
            return {
              type: "format",
              title: citation.title,
              content: data.content,
              checklist: data.checklist,
            };
          }
        }
        return null;
      });

      const citationResults = (await Promise.all(citationPromises)).filter(Boolean);
      
      // Sort by recency (most recent first) and build content
      citationResults.sort((a, b) => {
        if (a?.createdAt && b?.createdAt) {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        return 0;
      });

      for (const cit of citationResults) {
        if (!cit) continue;
        
        if (cit.type === "format") {
          citedContent += `\n### Regras do formato ${cit.title}:\n${cit.content}\n`;
          if (cit.checklist) {
            citedContent += `\nChecklist:\n${JSON.stringify(cit.checklist)}\n`;
          }
        } else {
          const label = cit.type === "content" ? "Referência" : "Referência externa";
          citedContent += `\n### ${label}: ${cit.title} (${cit.contentType})\n${cit.content}\n`;
        }
        
        // Stop if we've exceeded the limit
        if (citedContent.length >= MAX_CITED_CONTENT_LENGTH) {
          citedContent = citedContent.substring(0, MAX_CITED_CONTENT_LENGTH) + "\n[...conteúdo truncado]";
          break;
        }
      }
    }

    // 4. Build system prompt (lean and focused)
    const identityGuide = client.identity_guide 
      ? client.identity_guide.substring(0, MAX_IDENTITY_GUIDE_LENGTH) 
      : "";

    const systemPrompt = `Você é o kAI, um assistente especializado em criação de conteúdo para marcas e criadores.

## Cliente: ${client.name}
${client.description ? `Descrição: ${client.description}` : ""}

${identityGuide ? `## Guia de Identidade\n${identityGuide}` : ""}

${citedContent ? `## Materiais Citados\n${citedContent}` : ""}

## Instruções
- Sempre siga o tom de voz e estilo do cliente definidos no guia de identidade
- Crie conteúdo original, autêntico e relevante para a audiência do cliente
- Seja direto, prático e objetivo nas respostas
- Se um formato foi citado, siga rigorosamente as regras específicas dele
- Use as referências citadas como base e inspiração quando disponíveis
- Mantenha consistência com a identidade da marca em todas as respostas`;

    // 5. Build messages array - limit history to prevent context overflow
    const limitedHistory = (history || []).slice(-MAX_HISTORY_MESSAGES);
    const apiMessages = [
      { role: "system", content: systemPrompt },
      ...limitedHistory.map(h => ({ role: h.role, content: h.content })),
      { role: "user", content: message },
    ];

    console.log("[kai-simple-chat] Context built:", {
      systemPromptLength: systemPrompt.length,
      historyMessages: limitedHistory.length,
      citedContentLength: citedContent.length,
    });

    // 6. Call AI Gateway with streaming
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      // Fallback to Google API
      const GOOGLE_API_KEY = Deno.env.get("GOOGLE_AI_STUDIO_API_KEY");
      if (!GOOGLE_API_KEY) {
        console.error("[kai-simple-chat] No API key configured");
        return new Response(
          JSON.stringify({ error: "Configuração de API incompleta. Contate o suporte." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("[kai-simple-chat] Using Gemini fallback");
      
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
        console.error("[kai-simple-chat] Gemini error:", geminiResponse.status, errorText);
        
        // Provide specific error messages
        if (geminiResponse.status === 429) {
          return new Response(
            JSON.stringify({ error: "Muitas requisições. Aguarde um momento e tente novamente." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (geminiResponse.status === 400) {
          return new Response(
            JSON.stringify({ error: "Mensagem muito longa ou formato inválido." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        return new Response(
          JSON.stringify({ error: "Erro ao gerar resposta. Tente novamente." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Transform Gemini SSE to OpenAI format
      const reader = geminiResponse.body?.getReader();
      if (!reader) {
        return new Response(
          JSON.stringify({ error: "Resposta vazia do servidor." }),
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
                    const openAIFormat = {
                      choices: [{ delta: { content: text } }],
                    };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(openAIFormat)}\n\n`));
                  }
                } catch {
                  // Ignore parse errors for incomplete chunks
                }
              }
            }
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          } catch (e) {
            console.error("[kai-simple-chat] Stream error:", e);
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
    console.log("[kai-simple-chat] Using Lovable AI Gateway");
    
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
      const status = gatewayResponse.status;
      const errorText = await gatewayResponse.text();
      console.error("[kai-simple-chat] Gateway error:", status, errorText);

      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições atingido. Aguarde alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione mais créditos para continuar." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status === 408 || errorText.includes("timeout")) {
        return new Response(
          JSON.stringify({ error: "A requisição demorou demais. Tente uma mensagem mais curta." }),
          { status: 408, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Erro ao processar sua solicitação. Tente novamente." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Stream the response directly
    console.log("[kai-simple-chat] Streaming response started");
    return new Response(gatewayResponse.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });

  } catch (error) {
    console.error("[kai-simple-chat] Unhandled error:", error);
    
    // Provide user-friendly error message
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    const isTimeout = errorMessage.includes("timeout") || errorMessage.includes("TIMEOUT");
    
    return new Response(
      JSON.stringify({ 
        error: isTimeout 
          ? "A requisição expirou. Tente novamente com uma mensagem mais curta."
          : "Erro interno. Por favor, tente novamente."
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
