import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Validação de entrada
const validateRequest = (body: any): { valid: boolean; error?: string } => {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Invalid request body" };
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return { valid: false, error: "Messages array is required and must not be empty" };
  }

  if (body.model && typeof body.model !== "string") {
    return { valid: false, error: "Model must be a string" };
  }

  return { valid: true };
};

// Tool para seleção de documentos relevantes
const documentSelectionTool = {
  type: "function",
  function: {
    name: "select_relevant_documents",
    description: "Seleciona os documentos e informações mais relevantes do cliente para responder à pergunta do usuário. Use este tool SEMPRE antes de responder para garantir que você está usando as informações corretas.",
    parameters: {
      type: "object",
      properties: {
        selected_documents: {
          type: "array",
          items: { type: "string" },
          description: "IDs dos documentos selecionados como relevantes"
        },
        use_websites: {
          type: "boolean",
          description: "Se deve usar o conteúdo dos websites do cliente"
        },
        use_context_notes: {
          type: "boolean",
          description: "Se deve usar as notas de contexto do cliente"
        },
        reasoning: {
          type: "string",
          description: "Breve explicação de por que estes documentos foram escolhidos"
        }
      },
      required: ["selected_documents", "use_websites", "use_context_notes", "reasoning"]
    }
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();

  try {
    const body = await req.json();
    
    // Validar requisição
    const validation = validateRequest(body);
    if (!validation.valid) {
      console.error("Validation error:", validation.error);
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { messages, model, isSelectionPhase, availableDocuments } = body;
    const selectedModel = model || "gpt-5-mini-2025-08-07";
    
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    
    if (!OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // FASE 1: Seleção de documentos
    if (isSelectionPhase) {
      console.log("Phase 1: Document selection", {
        model: selectedModel,
        availableDocuments: availableDocuments?.length || 0,
        timestamp: new Date().toISOString()
      });

      const selectionMessages = messages.map((msg: any) => ({
        role: msg.role,
        content: msg.content
      }));

      const selectionResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: selectionMessages,
          tools: [documentSelectionTool],
          tool_choice: { type: "function", function: { name: "select_relevant_documents" } },
          max_completion_tokens: 1000,
        }),
      });

      if (!selectionResponse.ok) {
        const errorText = await selectionResponse.text();
        console.error("OpenAI selection error:", errorText);
        return new Response(
          JSON.stringify({ error: "Erro ao selecionar documentos" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const selectionData = await selectionResponse.json();
      const toolCall = selectionData.choices[0]?.message?.tool_calls?.[0];
      
      if (!toolCall) {
        return new Response(
          JSON.stringify({ error: "Nenhum documento selecionado" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const selection = JSON.parse(toolCall.function.arguments);
      
      console.log("Documents selected:", {
        selected: selection.selected_documents?.length || 0,
        useWebsites: selection.use_websites,
        useContext: selection.use_context_notes,
        reasoning: selection.reasoning
      });

      return new Response(
        JSON.stringify({ selection }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // FASE 2: Resposta com documentos selecionados
    console.log("Phase 2: Generate response", {
      model: selectedModel,
      messageCount: messages.length,
      timestamp: new Date().toISOString()
    });

    // Check if messages contain images
    const hasImages = messages.some((msg: any) => 
      Array.isArray(msg.image_urls) && msg.image_urls.length > 0
    );

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: messages.map((msg: any) => {
          // Convert messages with images to OpenAI Vision format
          if (msg.image_urls && msg.image_urls.length > 0) {
            return {
              role: msg.role,
              content: [
                { type: "text", text: msg.content },
                ...msg.image_urls.map((url: string) => ({
                  type: "image_url",
                  image_url: { url }
                }))
              ]
            };
          }
          // Regular text message
          return { role: msg.role, content: msg.content };
        }),
        stream: true,
        max_completion_tokens: 3000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const duration = Date.now() - startTime;
      
      console.error("OpenAI API error:", {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        duration: `${duration}ms`,
        model: selectedModel
      });
      
      let errorMessage = "Erro ao se comunicar com a OpenAI";
      let statusCode = 500;
      
      switch (response.status) {
        case 429:
          errorMessage = "Limite de taxa excedido. Por favor, aguarde e tente novamente.";
          statusCode = 429;
          break;
        case 401:
          errorMessage = "Chave de API inválida ou expirada.";
          statusCode = 401;
          break;
        case 400:
          errorMessage = "Requisição inválida. Verifique os parâmetros.";
          statusCode = 400;
          break;
        case 500:
        case 502:
        case 503:
          errorMessage = "Servidor OpenAI temporariamente indisponível. Tente novamente.";
          statusCode = 503;
          break;
      }
      
      return new Response(
        JSON.stringify({ error: errorMessage, details: errorText }),
        { status: statusCode, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const duration = Date.now() - startTime;
    console.log(`Chat request completed in ${duration}ms`);

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    const duration = Date.now() - startTime;
    console.error("Chat error:", {
      error: e instanceof Error ? e.message : "Unknown error",
      stack: e instanceof Error ? e.stack : undefined,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });
    
    return new Response(
      JSON.stringify({ 
        error: e instanceof Error ? e.message : "Erro desconhecido ao processar a solicitação",
        type: "internal_error"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
