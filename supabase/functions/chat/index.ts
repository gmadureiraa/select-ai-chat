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

// Tool para roteamento inteligente
const routingTool = {
  type: "function",
  function: {
    name: "route_request",
    description: "Determina como processar a requisição do usuário de forma inteligente",
    parameters: {
      type: "object",
      properties: {
        intent: {
          type: "string",
          enum: ["criar_conteudo", "revisar_conteudo", "tirar_duvida", "brainstorm", "outro"],
          description: "Intenção identificada na mensagem"
        },
        needs_documents: {
          type: "boolean",
          description: "Se precisa consultar documentos específicos do cliente"
        },
        needs_knowledge_base: {
          type: "boolean",
          description: "Se precisa consultar conteúdos anteriores (knowledge base)"
        },
        needs_websites: {
          type: "boolean",
          description: "Se precisa consultar conteúdo dos websites do cliente"
        },
        suggested_model: {
          type: "string",
          enum: ["nano", "mini", "standard"],
          description: "Complexidade: nano=simples/rápido, mini=equilibrado, standard=complexo/preciso"
        },
        context_priority: {
          type: "array",
          items: { type: "string" },
          description: "Ordem de prioridade do contexto necessário"
        }
      },
      required: ["intent", "needs_documents", "needs_knowledge_base", "needs_websites", "suggested_model"]
    }
  }
};

// Tool para seleção inteligente de conteúdo
const contentSelectionTool = {
  type: "function",
  function: {
    name: "select_relevant_content",
    description: "Seleciona conteúdos relevantes da biblioteca e documentos do cliente para usar como referência",
    parameters: {
      type: "object",
      properties: {
        detected_content_type: {
          type: "string",
          enum: ["newsletter", "carousel", "reel_script", "video_script", "blog_post", "social_post", "general"],
          description: "Tipo de conteúdo que o usuário está pedindo"
        },
        selected_references: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "ID do material selecionado" },
              type: { 
                type: "string", 
                enum: ["content_library", "document"],
                description: "Tipo: content_library (biblioteca) ou document (arquivo)"
              },
              reason: { type: "string", description: "Por que este material foi selecionado" },
              priority: { 
                type: "string", 
                enum: ["high", "medium", "low"],
                description: "Prioridade de relevância"
              }
            },
            required: ["id", "type", "reason", "priority"]
          },
          description: "Materiais selecionados da biblioteca e documentos com justificativa"
        },
        analysis_needed: {
          type: "boolean",
          description: "Se precisa fazer análise profunda dos conteúdos para extrair padrões, estrutura e tom"
        },
        use_context_notes: {
          type: "boolean",
          description: "Se deve usar as notas de contexto gerais do cliente"
        },
        use_websites: {
          type: "boolean",
          description: "Se deve usar o conteúdo dos websites do cliente"
        },
        strategy: {
          type: "string",
          enum: ["follow_structure", "adapt_tone", "combine_best", "innovate"],
          description: "Estratégia de uso: follow_structure (seguir estrutura), adapt_tone (adaptar tom), combine_best (combinar melhores práticas), innovate (inovar)"
        },
        reasoning: {
          type: "string",
          description: "Explicação geral da seleção e estratégia escolhida"
        }
      },
      required: ["detected_content_type", "selected_references", "analysis_needed", "use_context_notes", "use_websites", "strategy", "reasoning"]
    }
  }
};

// Tool para extrair regras de feedback
const feedbackTool = {
  type: "function",
  function: {
    name: "extract_feedback_rule",
    description: "Extrai uma regra do feedback do usuário para aplicar em respostas futuras",
    parameters: {
      type: "object",
      properties: {
        is_feedback: {
          type: "boolean",
          description: "Se a mensagem contém feedback sobre uma resposta anterior"
        },
        rule: {
          type: "string",
          description: "Regra extraída do feedback (ex: 'Sempre usar tom mais informal')"
        },
        rule_type: {
          type: "string",
          enum: ["tom", "estrutura", "conteudo", "formato", "outro"],
          description: "Categoria da regra"
        },
        applies_to: {
          type: "string",
          enum: ["esta_conversa", "este_template", "este_cliente"],
          description: "Escopo de aplicação da regra"
        }
      },
      required: ["is_feedback"]
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

    const { messages, model, isSelectionPhase, isRoutingPhase, availableMaterials } = body;
    const selectedModel = model || "gpt-5-mini-2025-08-07";
    
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_AI_STUDIO_API_KEY");
    
    // Determinar qual API usar baseado no modelo selecionado
    const isClaudeModel = selectedModel.startsWith("claude-");
    const isGeminiModel = selectedModel.startsWith("gemini-");
    
    if (!OPENAI_API_KEY && !ANTHROPIC_API_KEY && !GOOGLE_API_KEY) {
      console.error("Nenhuma API key configurada");
      return new Response(
        JSON.stringify({ error: "API key não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // FASE 0: Roteamento inteligente (opcional - para uso futuro)
    if (isRoutingPhase) {
      console.log("Phase 0: Intelligent routing");

      const routingMessages = messages.map((msg: any) => ({
        role: msg.role,
        content: msg.content
      }));

      const routingResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-5-nano-2025-08-07", // Mais barato para routing
          messages: routingMessages,
          tools: [routingTool],
          tool_choice: { type: "function", function: { name: "route_request" } },
          max_completion_tokens: 500,
        }),
      });

      if (!routingResponse.ok) {
        const errorText = await routingResponse.text();
        console.error("OpenAI routing error:", errorText);
        return new Response(
          JSON.stringify({ error: "Erro ao rotear requisição" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const routingData = await routingResponse.json();
      const toolCall = routingData.choices[0]?.message?.tool_calls?.[0];
      
      if (!toolCall) {
        return new Response(
          JSON.stringify({ error: "Roteamento falhou" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const routing = JSON.parse(toolCall.function.arguments);
      console.log("Routing decision:", routing);

      return new Response(
        JSON.stringify({ routing }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // FASE 1: Seleção inteligente de conteúdo
    if (isSelectionPhase) {
      console.log("Phase 1: Intelligent content selection", {
        model: "gpt-5-nano-2025-08-07",
        availableMaterials: availableMaterials?.length || 0,
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
          model: "gpt-5-nano-2025-08-07", // Mais barato para seleção
          messages: selectionMessages,
          tools: [contentSelectionTool],
          tool_choice: { type: "function", function: { name: "select_relevant_content" } },
          max_completion_tokens: 2000, // Mais tokens para análise detalhada
        }),
      });

      if (!selectionResponse.ok) {
        const errorText = await selectionResponse.text();
        console.error("OpenAI selection error:", errorText);
        return new Response(
          JSON.stringify({ error: "Erro ao selecionar conteúdo" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const selectionData = await selectionResponse.json();
      const toolCall = selectionData.choices[0]?.message?.tool_calls?.[0];
      
      if (!toolCall) {
        return new Response(
          JSON.stringify({ error: "Nenhum conteúdo selecionado" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const selection = JSON.parse(toolCall.function.arguments);
      
      console.log("Content selected:", {
        contentType: selection.detected_content_type,
        referencesCount: selection.selected_references?.length || 0,
        needsAnalysis: selection.analysis_needed,
        strategy: selection.strategy,
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

    let response;
    
    // Escolher API baseado no modelo
    if (isClaudeModel && ANTHROPIC_API_KEY) {
      console.log("Using Claude API");
      const claudeMessages = messages.map((msg: any) => {
        if (msg.image_urls && msg.image_urls.length > 0) {
          const content: any[] = [{ type: "text", text: msg.content }];
          msg.image_urls.forEach((url: string) => {
            content.push({
              type: "image",
              source: { type: "url", url }
            });
          });
          return { role: msg.role, content };
        }
        return { role: msg.role, content: msg.content };
      });

      response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "Content-Type": "application/json",
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: claudeMessages,
          max_tokens: 3000,
          stream: true
        }),
      });
    } else if (isGeminiModel && GOOGLE_API_KEY) {
      console.log("Using Google Gemini API");
      const geminiContents = messages.map((msg: any) => {
        if (msg.image_urls && msg.image_urls.length > 0) {
          const parts: any[] = [{ text: msg.content }];
          msg.image_urls.forEach((url: string) => {
            parts.push({
              inlineData: {
                mimeType: "image/jpeg",
                data: url // Note: Google requires base64, this may need adjustment
              }
            });
          });
          return { role: msg.role === "assistant" ? "model" : "user", parts };
        }
        return { 
          role: msg.role === "assistant" ? "model" : "user", 
          parts: [{ text: msg.content }] 
        };
      });

      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:streamGenerateContent?key=${GOOGLE_API_KEY}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: geminiContents
        }),
      });
    } else if (OPENAI_API_KEY) {
      console.log("Using OpenAI API");
      response = await fetch("https://api.openai.com/v1/chat/completions", {
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
    } else {
      return new Response(
        JSON.stringify({ error: "Modelo não suportado ou API key não disponível" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
