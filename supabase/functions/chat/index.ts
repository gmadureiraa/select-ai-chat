import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Pricing por 1M tokens (USD) - Gemini models
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "google/gemini-2.5-flash": { input: 0.10, output: 0.40 },
  "google/gemini-2.5-flash-lite": { input: 0.05, output: 0.15 },
  "google/gemini-3-pro-preview": { input: 0.50, output: 2.00 },
  "google/gemini-2.5-pro": { input: 1.25, output: 5.00 },
  "gpt-5-mini-2025-08-07": { input: 1.00, output: 4.00 },
  "gpt-5-nano-2025-08-07": { input: 0.20, output: 0.80 },
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
  return "lovable";
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
    const { messages, model = "google/gemini-2.5-flash", isSelectionPhase, userId, clientId } = await req.json();

    console.log(`[CHAT] Model: ${model}, Phase: ${isSelectionPhase ? "selection" : "response"}`);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Construir requisição
    const requestBody: any = {
      model,
      messages,
      stream: true,
    };

    if (isSelectionPhase) {
      requestBody.tools = [contentSelectionTool];
      requestBody.tool_choice = { type: "function", function: { name: "select_relevant_content" } };
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("[CHAT] AI Gateway error:", errorText);
      
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    // Stream com logging
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    const startTime = Date.now();

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
                if (data === "[DONE]") {
                  controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
                  continue;
                }

                try {
                  const parsed = JSON.parse(data);
                  if (parsed.usage) {
                    totalInputTokens = parsed.usage.prompt_tokens || 0;
                    totalOutputTokens = parsed.usage.completion_tokens || 0;
                  }
                  controller.enqueue(new TextEncoder().encode(line + "\n"));
                } catch (e) {
                  console.error("[CHAT] Parse error:", e);
                }
              }
            }
          }

          // Log após completar
          if (userId && (totalInputTokens > 0 || totalOutputTokens > 0)) {
            await logAIUsage(
              supabase,
              userId,
              model,
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
