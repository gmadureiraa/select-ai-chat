import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildWriterSystemPrompt, selectModelForFormat } from "../_shared/prompt-builder.ts";
import { normalizeFormatKey } from "../_shared/knowledge-loader.ts";

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
  includePerformanceContext?: boolean;
  additionalMaterial?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const requestBody = await req.json() as ContentRequest & { stream?: boolean; message?: string };
    const { clientId, request, format, platform, workspaceId, conversationHistory, includePerformanceContext = true, stream = true, message, additionalMaterial } = requestBody;
    
    const userRequest = request || message;

    if (!clientId) {
      return new Response(
        JSON.stringify({ error: "clientId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===================================================
    // BUILD SYSTEM PROMPT using centralized builder
    // ===================================================
    const normalizedFormat = normalizeFormatKey(format || "post");
    
    const systemPrompt = await buildWriterSystemPrompt({
      clientId,
      format: normalizedFormat,
      workspaceId,
      includeVoice: true,
      includeLibrary: true,
      includePerformers: includePerformanceContext,
      includeGlobalKnowledge: !!workspaceId,
      includeSuccessPatterns: true,
      includeChecklist: true,
      additionalMaterial,
      maxLibraryExamples: 5,
      maxTopPerformers: 5,
    });

    // Add platform context
    const platformSuffix = `\n\n## Formato Solicitado: ${format || "post"}\n## Plataforma: ${platform || "Instagram"}`;
    const fullSystemPrompt = systemPrompt + platformSuffix;

    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_AI_STUDIO_API_KEY");
    
    if (!GOOGLE_API_KEY) {
      console.error("GOOGLE_AI_STUDIO_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Chave da API do Google AI não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build messages array with conversation history
    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: fullSystemPrompt },
    ];

    if (conversationHistory && conversationHistory.length > 0) {
      messages.push(...conversationHistory.slice(-10));
    }

    messages.push({ role: "user", content: userRequest || request || "" });

    const useStreaming = stream !== false;

    // Convert messages to Gemini format
    const geminiContents = messages.map(msg => ({
      role: msg.role === "assistant" ? "model" : msg.role === "system" ? "user" : "user",
      parts: [{ text: msg.content }]
    }));

    // Merge consecutive user messages
    const mergedContents: typeof geminiContents = [];
    for (const content of geminiContents) {
      if (mergedContents.length > 0 && mergedContents[mergedContents.length - 1].role === content.role) {
        mergedContents[mergedContents.length - 1].parts[0].text += "\n\n" + content.parts[0].text;
      } else {
        mergedContents.push(content);
      }
    }

    // Select model based on format complexity
    const modelConfig = selectModelForFormat(normalizedFormat);
    const modelName = modelConfig.model;
    const modelTemperature = modelConfig.temperature;
    const modelMaxTokens = modelConfig.maxTokens;
    
    console.log(`[kai-content-agent] Using model: ${modelName} (format: ${normalizedFormat})`);

    // Non-streaming request
    if (!useStreaming) {
      console.log("[kai-content-agent] Non-streaming request");
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GOOGLE_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: mergedContents,
            generationConfig: {
              temperature: modelTemperature,
              maxOutputTokens: modelMaxTokens,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Gemini API error (non-streaming):", errorText);
        
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: "Rate limit excedido. Tente novamente em alguns segundos." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        throw new Error("Erro ao gerar conteúdo");
      }

      const result = await response.json();
      const content = result?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      
      console.log("[kai-content-agent] Non-streaming response length:", content.length);

      return new Response(
        JSON.stringify({ content }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Streaming request
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?alt=sse&key=${GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: mergedContents,
          generationConfig: {
            temperature: modelTemperature,
            maxOutputTokens: modelMaxTokens,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error("Erro ao gerar conteúdo");
    }

    // Transform Gemini SSE format to OpenAI-compatible format
    const transformStream = new TransformStream({
      transform(chunk, controller) {
        const text = new TextDecoder().decode(chunk);
        const lines = text.split("\n");
        
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
              if (content) {
                const openAIFormat = {
                  choices: [{ delta: { content } }]
                };
                controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(openAIFormat)}\n\n`));
              }
            } catch {
              // Skip invalid JSON lines
            }
          }
        }
      },
      flush(controller) {
        controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
      }
    });

    return new Response(response.body?.pipeThrough(transformStream), {
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
