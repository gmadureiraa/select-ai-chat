import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { 
  validateString, 
  validateUUID, 
  validateArray, 
  validateBoolean,
  validateChatMessages,
  createValidationErrorResponse,
  sanitizeString
} from "../_shared/validation.ts";
import {
  checkWorkspaceTokens,
  debitWorkspaceTokens,
  getWorkspaceIdFromUser,
  createInsufficientTokensResponse,
  TOKEN_COSTS,
} from "../_shared/tokens.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Pricing por 1M tokens (USD) - Preços oficiais do Google AI Studio
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "gemini-3-pro-preview": { input: 0.00, output: 0.00 },
  "gemini-2.5-flash": { input: 0.075, output: 0.30 },
  "gemini-2.5-flash-lite": { input: 0.0375, output: 0.15 },
  "gemini-2.5-pro": { input: 1.25, output: 5.00 },
  "gemini-2.0-flash-exp": { input: 0.00, output: 0.00 },
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

function getGoogleModelName(model: string): string {
  const cleanModel = model.replace("google/", "");
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

// Converter URL de imagem para base64
async function urlToBase64(url: string): Promise<{ mimeType: string; data: string } | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error("[IMAGE] Failed to fetch:", url);
      return null;
    }
    
    const contentType = response.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await response.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    
    return {
      mimeType: contentType,
      data: base64
    };
  } catch (error) {
    console.error("[IMAGE] Error converting to base64:", error);
    return null;
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
          enum: [
            "static_image", "carousel", "stories", "tweet", "thread",
            "short_video", "reel_script", "video_script", "linkedin",
            "newsletter", "blog_post", "social_post", "general"
          ],
          description: "Tipo de conteúdo solicitado pelo usuário"
        },
        selected_references: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              type: { type: "string", enum: ["content_library", "document", "reference_library"] },
              reason: { type: "string" },
              priority: { type: "string", enum: ["high", "medium", "low"] }
            },
            required: ["id", "type", "reason", "priority"]
          }
        },
        analysis_needed: { type: "boolean", description: "Se precisa análise profunda de padrões" },
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

// Validate request body
function validateRequestBody(body: unknown): { field: string; message: string }[] {
  const errors: { field: string; message: string }[] = [];
  
  if (!body || typeof body !== "object") {
    errors.push({ field: "body", message: "Corpo da requisição deve ser um objeto" });
    return errors;
  }
  
  const data = body as Record<string, unknown>;
  
  // Validate messages (required)
  const messagesErrors = validateChatMessages(data.messages, "messages");
  errors.push(...messagesErrors);
  
  // Validate model (optional)
  const modelError = validateString(data.model, "model", { maxLength: 100 });
  if (modelError) errors.push(modelError);
  
  // Validate isSelectionPhase (optional)
  const selectionPhaseError = validateBoolean(data.isSelectionPhase, "isSelectionPhase");
  if (selectionPhaseError) errors.push(selectionPhaseError);
  
  // Validate userId (optional but should be UUID if present)
  const userIdError = validateUUID(data.userId, "userId");
  if (userIdError) errors.push(userIdError);
  
  // Validate clientId (optional but should be UUID if present)
  const clientIdError = validateUUID(data.clientId, "clientId");
  if (clientIdError) errors.push(clientIdError);
  
  // Validate imageUrls (optional)
  const imageUrlsError = validateArray(data.imageUrls, "imageUrls", { maxLength: 20 });
  if (imageUrlsError) errors.push(imageUrlsError);
  
  // Validate availableMaterials (optional)
  const materialsError = validateArray(data.availableMaterials, "availableMaterials", { maxLength: 1000 });
  if (materialsError) errors.push(materialsError);
  
  return errors;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Parse and validate request body
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return createValidationErrorResponse(
        [{ field: "body", message: "JSON inválido no corpo da requisição" }],
        corsHeaders
      );
    }
    
    const validationErrors = validateRequestBody(body);
    if (validationErrors.length > 0) {
      console.error("[CHAT] Validation errors:", validationErrors);
      return createValidationErrorResponse(validationErrors, corsHeaders);
    }
    
    const { 
      messages, 
      model = "gemini-2.5-flash", 
      isSelectionPhase, 
      userId, 
      clientId, 
      imageUrls, 
      availableMaterials 
    } = body as {
      messages: { role: string; content: string; image_urls?: string[] }[];
      model?: string;
      isSelectionPhase?: boolean;
      userId?: string;
      clientId?: string;
      imageUrls?: string[];
      availableMaterials?: unknown[];
    };

    // Count images from messages
    const totalImagesInMessages = messages.reduce((count, m) => 
      count + (m.image_urls?.length || 0), 0
    );
    
    console.log(`[CHAT] Model: ${model}, Phase: ${isSelectionPhase ? "selection" : "response"}, Images in messages: ${totalImagesInMessages}, Top-level images: ${imageUrls?.length || 0}`);
    
    if (isSelectionPhase && availableMaterials) {
      console.log(`[CHAT] Available materials: ${availableMaterials.length} items`);
    }

    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_AI_STUDIO_API_KEY");
    if (!GOOGLE_API_KEY) throw new Error("GOOGLE_AI_STUDIO_API_KEY não configurada");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // === TOKEN VERIFICATION ===
    let workspaceId: string | null = null;
    if (userId) {
      workspaceId = await getWorkspaceIdFromUser(userId);
      if (workspaceId) {
        const tokenCheck = await checkWorkspaceTokens(workspaceId, TOKEN_COSTS.chat_simple);
        if (!tokenCheck.hasTokens) {
          console.warn(`[CHAT] Insufficient tokens for workspace ${workspaceId}`);
          return createInsufficientTokensResponse(corsHeaders);
        }
        console.log(`[CHAT] Token check passed for workspace ${workspaceId}`);
      }
    }
    // === END TOKEN VERIFICATION ===

    const googleModel = getGoogleModelName(model);
    console.log(`[CHAT] Using Google model: ${googleModel}`);
    
    // Preparar conteúdos para o Google Gemini API (com suporte multimodal)
    const contents = [];
    
    for (const m of messages) {
      if (m.role === "system") continue;
      
      const parts: any[] = [];
      
      // Adicionar texto
      if (m.content) {
        parts.push({ text: m.content });
      }
      
      // Adicionar imagens da mensagem (se existir image_urls no objeto)
      if (m.image_urls && Array.isArray(m.image_urls) && m.image_urls.length > 0) {
        for (const imgUrl of m.image_urls) {
          const imageData = await urlToBase64(imgUrl);
          if (imageData) {
            parts.push({
              inlineData: {
                mimeType: imageData.mimeType,
                data: imageData.data
              }
            });
            console.log(`[CHAT] Added image from message: ${imgUrl.substring(0, 50)}...`);
          }
        }
      }
      
      if (parts.length > 0) {
        contents.push({
          role: m.role === "assistant" ? "model" : "user",
          parts
        });
      }
    }
    
    // Adicionar imagens do request body (imageUrls do nível superior)
    if (imageUrls && Array.isArray(imageUrls) && imageUrls.length > 0) {
      // Encontrar a última mensagem do usuário e adicionar as imagens
      const lastUserIdx = contents.findLastIndex((c: any) => c.role === "user");
      if (lastUserIdx !== -1) {
        for (const imgUrl of imageUrls) {
          const imageData = await urlToBase64(imgUrl);
          if (imageData) {
            contents[lastUserIdx].parts.push({
              inlineData: {
                mimeType: imageData.mimeType,
                data: imageData.data
              }
            });
            console.log(`[CHAT] Added request image: ${imgUrl.substring(0, 50)}...`);
          }
        }
      }
    }

    // System instruction separado
    const systemInstruction = messages.find((m: any) => m.role === "system")?.content;

    // Construir requisição
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

    // Tools para seleção - FORÇA USO DA TOOL
    if (isSelectionPhase) {
      requestBody.tools = [{
        functionDeclarations: [{
          name: "select_relevant_content",
          description: "OBRIGATÓRIO: Seleciona conteúdos relevantes da biblioteca e documentos do cliente para análise",
          parameters: contentSelectionTool.function.parameters
        }]
      }];
      // Forçar uso da ferramenta
      requestBody.toolConfig = {
        functionCallingConfig: {
          mode: "ANY",
          allowedFunctionNames: ["select_relevant_content"]
        }
      };
    }

    const aiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${googleModel}:streamGenerateContent?alt=sse&key=${GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

    // Fase de seleção - retornar JSON direto
    if (isSelectionPhase) {
      const reader = aiResponse.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let toolCallData: any = null;
      let totalInputTokens = 0;
      let totalOutputTokens = 0;

      if (!reader) throw new Error("No response body");

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
              if (parsed.usageMetadata) {
                totalInputTokens = parsed.usageMetadata.promptTokenCount || 0;
                totalOutputTokens = parsed.usageMetadata.candidatesTokenCount || 0;
              }
              if (parsed.candidates?.[0]?.content?.parts?.[0]?.functionCall) {
                toolCallData = parsed.candidates[0].content.parts[0].functionCall;
              }
            } catch (e) {
              console.error("[CHAT] Parse error:", e);
            }
          }
        }
      }

      if (userId && (totalInputTokens > 0 || totalOutputTokens > 0)) {
        await logAIUsage(supabase, userId, googleModel, "chat-selection", totalInputTokens, totalOutputTokens, { isSelectionPhase: true, clientId });
        
        // Debit tokens after successful selection
        if (workspaceId) {
          await debitWorkspaceTokens(
            workspaceId,
            userId,
            TOKEN_COSTS.chat_simple,
            "Chat AI - Seleção de conteúdo",
            { model: googleModel, clientId }
          );
        }
      }

      const selectionResult = toolCallData?.args || {};
      console.log(`[CHAT] Selection result: ${JSON.stringify(selectionResult).substring(0, 500)}`);

      return new Response(
        JSON.stringify({ selection: selectionResult }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Stream normal para resposta final
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

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
                  if (parsed.usageMetadata) {
                    totalInputTokens = parsed.usageMetadata.promptTokenCount || 0;
                    totalOutputTokens = parsed.usageMetadata.candidatesTokenCount || 0;
                  }
                  if (parsed.candidates?.[0]?.content?.parts?.[0]?.text) {
                    const textChunk = parsed.candidates[0].content.parts[0].text;
                    const openAIFormat = {
                      choices: [{ delta: { content: textChunk } }]
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

          controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));

          if (userId && (totalInputTokens > 0 || totalOutputTokens > 0)) {
            await logAIUsage(supabase, userId, googleModel, "chat-response", totalInputTokens, totalOutputTokens, {
              client_id: clientId,
              hasImages: (imageUrls?.length || 0) > 0
            });
            
            // Debit tokens after successful response
            if (workspaceId) {
              // Determine token cost based on output length
              const tokenCost = totalOutputTokens > 1500 ? TOKEN_COSTS.chat_long : TOKEN_COSTS.chat_simple;
              await debitWorkspaceTokens(
                workspaceId,
                userId,
                tokenCost,
                "Chat AI - Resposta",
                { model: googleModel, clientId, outputTokens: totalOutputTokens }
              );
            }
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
