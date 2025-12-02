import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Pricing por 1M tokens (USD) - Preços oficiais do Google AI Studio
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "gemini-3-pro-preview": { input: 0.00, output: 0.00 }, // Free tier
  "gemini-2.5-flash": { input: 0.075, output: 0.30 },
  "gemini-2.5-flash-lite": { input: 0.0375, output: 0.15 }, // Mais barato
  "gemini-2.5-pro": { input: 1.25, output: 5.00 },
  "gemini-2.0-flash-exp": { input: 0.00, output: 0.00 }, // Free experimental
  "gemini-1.5-flash": { input: 0.075, output: 0.30 },
  "gemini-1.5-pro": { input: 1.25, output: 5.00 },
};

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model] || { input: 0, output: 0 };
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

function getProvider(model: string): string {
  if (model.includes("gemini")) return "google";
  if (model.includes("gpt-")) return "openai";
  return "unknown";
}

// Converter modelo para formato do Google AI Studio
function getGoogleModelName(model: string): string {
  // Remove prefixo "google/" se existir
  const cleanModel = model.replace("google/", "");
  
  // Retornar modelo limpo (todos os nomes já estão corretos)
  return cleanModel;
}

async function logAIUsage(
  supabase: any,
  userId: string,
  model: string,
  edgeFunction: string,
  inputTokens: number,
  outputTokens: number,
  metadata: Record<string, any> = {}
) {
  try {
    const totalTokens = inputTokens + outputTokens;
    const estimatedCost = estimateCost(model, inputTokens, outputTokens);
    const provider = getProvider(model);

    const { error } = await supabase.from("ai_usage_logs").insert({
      user_id: userId,
      model_name: model,
      provider,
      edge_function: edgeFunction,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: totalTokens,
      estimated_cost_usd: estimatedCost,
      metadata,
    });

    if (error) {
      console.error("[USAGE] Failed to log:", error);
    } else {
      console.log(`[USAGE] Logged: ${model} - ${totalTokens} tokens - $${estimatedCost.toFixed(6)}`);
    }
  } catch (error) {
    console.error("[USAGE] Error:", error);
  }
}

// Tool para seleção inteligente de conteúdo
const contentSelectionTool = {
  type: "function",
  function: {
    name: "select_relevant_content",
    description: "Seleciona conteúdos relevantes da biblioteca e documentos do cliente",
    parameters: {
      type: "object",
      properties: {
        detected_content_type: {
          type: "string",
          enum: ["newsletter", "carousel", "reel_script", "video_script", "blog_post", "social_post", "general"],
          description: "Tipo de conteúdo solicitado"
        },
        selected_references: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              type: { type: "string", enum: ["content_library", "document"] },
              reason: { type: "string" },
              priority: { type: "string", enum: ["high", "medium", "low"] }
            },
            required: ["id", "type", "reason", "priority"]
          }
        },
        analysis_needed: {
          type: "boolean",
          description: "Se precisa análise profunda de padrões"
        },
        use_context_notes: { type: "boolean" },
        use_websites: { type: "boolean" },
        strategy: {
          type: "string",
          enum: ["follow_structure", "adapt_tone", "combine_best", "innovate"]
        },
        reasoning: { type: "string" }
      },
      required: ["detected_content_type", "selected_references", "analysis_needed", "use_context_notes", "use_websites", "strategy", "reasoning"]
    }
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, model = "gemini-2.5-flash", isSelectionPhase, userId, clientId } = await req.json();

    console.log(`[CHAT] Model: ${model}, Phase: ${isSelectionPhase ? "selection" : "response"}`);

    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_AI_STUDIO_API_KEY");
    if (!GOOGLE_API_KEY) throw new Error("GOOGLE_AI_STUDIO_API_KEY não configurada");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Converter modelo para formato Google
    const googleModel = getGoogleModelName(model);
    console.log(`[CHAT] Using Google model: ${googleModel}`);
    
    // Preparar conteúdos para o Google Gemini API
    const contents = messages
      .filter((m: any) => m.role !== "system")
      .map((m: any) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }]
      }));

    // System instruction separado (Google Gemini não usa "system" em messages)
    const systemInstruction = messages.find((m: any) => m.role === "system")?.content;

    // Construir requisição para Google Gemini API
    const requestBody: any = {
      contents,
      generationConfig: {
        temperature: 1.0,
        maxOutputTokens: 8192,
      }
    };

    if (systemInstruction) {
      requestBody.systemInstruction = {
        parts: [{ text: systemInstruction }]
      };
    }

    // Tools para seleção (se necessário)
    if (isSelectionPhase) {
      requestBody.tools = [{
        functionDeclarations: [{
          name: "select_relevant_content",
          description: "Seleciona conteúdos relevantes da biblioteca e documentos do cliente",
          parameters: contentSelectionTool.function.parameters
        }]
      }];
    }

    const aiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${googleModel}:streamGenerateContent?alt=sse&key=${GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("[CHAT] Google API error:", errorText);
      
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições do Google atingido" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      throw new Error(`Google API error: ${aiResponse.status} - ${errorText}`);
    }

    // Stream com logging (formato SSE do Google)
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    const startTime = Date.now();
    let toolCallData: any = null;

    const stream = new ReadableStream({
      async start(controller) {
        const reader = aiResponse.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        if (!reader) {
          controller.close();
          return;
        }

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6).trim();
                
                try {
                  const parsed = JSON.parse(data);
                  
                  // Extrair tokens (Google Gemini formato)
                  if (parsed.usageMetadata) {
                    totalInputTokens = parsed.usageMetadata.promptTokenCount || 0;
                    totalOutputTokens = parsed.usageMetadata.candidatesTokenCount || 0;
                  }

                  // Se for fase de seleção, capturar function call
                  if (isSelectionPhase && parsed.candidates?.[0]?.content?.parts?.[0]?.functionCall) {
                    toolCallData = parsed.candidates[0].content.parts[0].functionCall;
                    // Enviar como resposta estruturada
                    const selectionResponse = {
                      selection: toolCallData.args
                    };
                    controller.enqueue(
                      new TextEncoder().encode(`data: ${JSON.stringify(selectionResponse)}\n\n`)
                    );
                  } else if (parsed.candidates?.[0]?.content?.parts?.[0]?.text) {
                    // Streaming normal de texto
                    const textChunk = parsed.candidates[0].content.parts[0].text;
                    const openAIFormat = {
                      choices: [{
                        delta: { content: textChunk }
                      }]
                    };
                    controller.enqueue(
                      new TextEncoder().encode(`data: ${JSON.stringify(openAIFormat)}\n\n`)
                    );
                  }
                } catch (e) {
                  console.error("[CHAT] Parse error:", e);
                }
              }
            }
          }

          // Enviar [DONE]
          controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));

          // Log após completar
          if (userId && (totalInputTokens > 0 || totalOutputTokens > 0)) {
            await logAIUsage(
              supabase,
              userId,
              googleModel,
              isSelectionPhase ? "chat-selection" : "chat-response",
              totalInputTokens,
              totalOutputTokens,
              {
                client_id: clientId,
                duration_ms: Date.now() - startTime,
                phase: isSelectionPhase ? "selection" : "response",
              }
            );
          }

          controller.close();
        } catch (error) {
          console.error("[CHAT] Stream error:", error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("[CHAT] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
