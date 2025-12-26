import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logAIUsage, estimateTokens } from "../_shared/ai-usage.ts";
import { 
  validateString, 
  validateUUID, 
  validateArray,
  createValidationErrorResponse,
  sanitizeString
} from "../_shared/validation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Mapeia nomes de modelo para formato Gemini API
function mapToGeminiModel(model: string): string {
  const modelMap: Record<string, string> = {
    "flash": "gemini-2.5-flash",
    "pro": "gemini-2.5-pro",
    "flash-lite": "gemini-2.0-flash-lite",
    "google/gemini-2.5-flash": "gemini-2.5-flash",
    "google/gemini-2.5-pro": "gemini-2.5-pro",
    "google/gemini-2.5-flash-lite": "gemini-2.0-flash-lite",
    "google/gemini-3-pro-preview": "gemini-3-pro-preview",
  };
  return modelMap[model] || model;
}

// Chamada para Google Gemini
async function callGemini(
  messages: any[],
  model: string = "gemini-2.5-flash"
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const GOOGLE_API_KEY = Deno.env.get("GOOGLE_AI_STUDIO_API_KEY");
  if (!GOOGLE_API_KEY) throw new Error("GOOGLE_AI_STUDIO_API_KEY não configurada");

  const geminiModel = mapToGeminiModel(model);
  console.log(`[MULTI-AGENT] Calling Gemini with model: ${geminiModel}`);

  // Convert to Gemini format
  const contents = messages
    .filter(m => m.role !== "system")
    .map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    }));

  const systemInstruction = messages.find(m => m.role === "system")?.content;

  const requestBody: any = {
    contents,
    generationConfig: {
      temperature: 0.8,
      maxOutputTokens: 8192,
    }
  };

  if (systemInstruction) {
    requestBody.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${GOOGLE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[MULTI-AGENT] Gemini error: ${response.status}`, errorText);
    throw new Error(`Gemini error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const inputTokens = data.usageMetadata?.promptTokenCount || 0;
  const outputTokens = data.usageMetadata?.candidatesTokenCount || 0;

  return { content, inputTokens, outputTokens };
}

// ============ INTERFACE DO PIPELINE ============
interface PipelineAgent {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  model: "flash" | "pro" | "flash-lite";
}

interface PipelineConfig {
  id: string;
  name: string;
  agents: PipelineAgent[];
}

// ============ EXECUÇÃO GENÉRICA DE AGENTE ============
async function executeAgent(
  agent: PipelineAgent,
  context: {
    userMessage: string;
    clientName: string;
    identityGuide: string;
    copywritingGuide: string;
    contentLibrary: any[];
    referenceLibrary: any[];
    previousOutputs: Record<string, string>;
    contentType: string;
  }
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  console.log(`[AGENT-${agent.id}] Executing: ${agent.name} with model: ${agent.model}`);

  let userPrompt = "";

  if (agent.id === "researcher") {
    const libraryContext = context.contentLibrary.slice(0, 20).map(c => 
      `ID: ${c.id}\nTítulo: ${c.title}\nTipo: ${c.content_type}\nPreview: ${c.content.substring(0, 500)}...`
    ).join("\n\n---\n\n");

    const refContext = context.referenceLibrary.slice(0, 10).map(r =>
      `ID: ${r.id}\nTítulo: ${r.title}\nTipo: ${r.reference_type}\nPreview: ${r.content.substring(0, 300)}...`
    ).join("\n\n---\n\n");

    userPrompt = `Cliente: ${context.clientName}

## BIBLIOTECA DE CONTEÚDO (${context.contentLibrary.length} itens):
${libraryContext}

## BIBLIOTECA DE REFERÊNCIAS (${context.referenceLibrary.length} itens):
${refContext}

## SOLICITAÇÃO DO USUÁRIO:
${context.userMessage}

Analise e selecione os materiais mais relevantes para criar este conteúdo.`;
  } else if (agent.id === "writer") {
    const researchOutput = context.previousOutputs["researcher"] || "";
    const selectedMaterials = context.contentLibrary.filter(c => 
      researchOutput.includes(c.id) || researchOutput.includes(c.title)
    ).slice(0, 5);

    const materialsContext = selectedMaterials.map(m => 
      `### ${m.title} (${m.content_type})\n${m.content}`
    ).join("\n\n---\n\n");

    userPrompt = `## CLIENTE: ${context.clientName}

## GUIA DE IDENTIDADE:
${context.identityGuide || "Não disponível - use tom profissional e acessível"}

## MATERIAIS DE REFERÊNCIA:
${materialsContext || "Nenhum material selecionado"}

## INSIGHTS DO PESQUISADOR:
${researchOutput}

## TIPO DE CONTEÚDO: ${context.contentType}

## SOLICITAÇÃO:
${context.userMessage}

Crie agora o primeiro rascunho do conteúdo solicitado.`;
  } else if (agent.id === "editor") {
    const draft = context.previousOutputs["writer"] || "";
    const researchOutput = context.previousOutputs["researcher"] || "";
    
    const selectedMaterials = context.contentLibrary.filter(c => 
      researchOutput.includes(c.id) || researchOutput.includes(c.title)
    ).slice(0, 3);

    const examples = selectedMaterials.map(m => 
      `### EXEMPLO: ${m.title}\n${m.content}`
    ).join("\n\n---\n\n");

    userPrompt = `## CLIENTE: ${context.clientName}

## GUIA DE COPYWRITING:
${context.copywritingGuide || "Use tom conversacional, direto e envolvente. Evite jargões desnecessários."}

## EXEMPLOS REAIS DO CLIENTE (USE COMO REFERÊNCIA DE ESTILO):
${examples || "Sem exemplos disponíveis"}

## RASCUNHO A REFINAR:
${draft}

TAREFA: Reescreva o rascunho para que soe EXATAMENTE como os exemplos do cliente.
O leitor não deve perceber que foi escrito por IA.
Mantenha todo o conteúdo, mas refine completamente o estilo.`;
  } else if (agent.id === "reviewer") {
    const contentToReview = context.previousOutputs["editor"] || context.previousOutputs["writer"] || "";

    userPrompt = `## CLIENTE: ${context.clientName}
## TIPO DE CONTEÚDO: ${context.contentType || "geral"}

## CONTEÚDO PARA REVISÃO:
${contentToReview}

Faça a revisão final e retorne a versão PRONTA PARA PUBLICAÇÃO.`;
  } else {
    const lastOutput = Object.values(context.previousOutputs).pop() || "";
    userPrompt = `## CLIENTE: ${context.clientName}
## CONTEXTO ANTERIOR:
${lastOutput}

## SOLICITAÇÃO:
${context.userMessage}

Execute sua função.`;
  }

  const messages = [
    { role: "system", content: agent.systemPrompt },
    { role: "user", content: userPrompt }
  ];

  return await callGemini(messages, agent.model);
}

// Validate request body
function validateRequestBody(body: unknown): { field: string; message: string }[] {
  const errors: { field: string; message: string }[] = [];
  
  if (!body || typeof body !== "object") {
    errors.push({ field: "body", message: "Corpo da requisição deve ser um objeto" });
    return errors;
  }
  
  const data = body as Record<string, unknown>;
  
  // Required fields
  const userMessageError = validateString(data.userMessage, "userMessage", { required: true, maxLength: 50000 });
  if (userMessageError) errors.push(userMessageError);
  
  const clientNameError = validateString(data.clientName, "clientName", { required: true, maxLength: 500 });
  if (clientNameError) errors.push(clientNameError);
  
  // Optional fields
  const identityGuideError = validateString(data.identityGuide, "identityGuide", { maxLength: 100000 });
  if (identityGuideError) errors.push(identityGuideError);
  
  const copywritingGuideError = validateString(data.copywritingGuide, "copywritingGuide", { maxLength: 100000 });
  if (copywritingGuideError) errors.push(copywritingGuideError);
  
  const contentTypeError = validateString(data.contentType, "contentType", { maxLength: 100 });
  if (contentTypeError) errors.push(contentTypeError);
  
  const userIdError = validateUUID(data.userId, "userId");
  if (userIdError) errors.push(userIdError);
  
  const clientIdError = validateUUID(data.clientId, "clientId");
  if (clientIdError) errors.push(clientIdError);
  
  const contentLibraryError = validateArray(data.contentLibrary, "contentLibrary", { maxLength: 1000 });
  if (contentLibraryError) errors.push(contentLibraryError);
  
  const referenceLibraryError = validateArray(data.referenceLibrary, "referenceLibrary", { maxLength: 500 });
  if (referenceLibraryError) errors.push(referenceLibraryError);
  
  return errors;
}

// ============ PIPELINE PRINCIPAL ============

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
      console.error("[MULTI-AGENT] Validation errors:", validationErrors);
      return createValidationErrorResponse(validationErrors, corsHeaders);
    }
    
    const {
      userMessage: rawUserMessage,
      contentLibrary = [],
      referenceLibrary = [],
      identityGuide = "",
      copywritingGuide = "",
      clientName,
      contentType,
      userId,
      clientId,
      pipeline
    } = body as {
      userMessage: string;
      contentLibrary?: any[];
      referenceLibrary?: any[];
      identityGuide?: string;
      copywritingGuide?: string;
      clientName: string;
      contentType?: string;
      userId?: string;
      clientId?: string;
      pipeline?: PipelineConfig;
    };
    
    // Sanitize user message
    const userMessage = sanitizeString(rawUserMessage);

    console.log(`[MULTI-AGENT] Starting pipeline for ${clientName}`);
    console.log(`[MULTI-AGENT] Content type: ${contentType}`);
    console.log(`[MULTI-AGENT] Pipeline: ${pipeline?.name || "default"}`);
    console.log(`[MULTI-AGENT] Agents: ${pipeline?.agents?.map((a: any) => a.id).join(" → ") || "default"}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Use pipeline received or fallback to default
    const agents: PipelineAgent[] = pipeline?.agents || [
      {
        id: "researcher",
        name: "Pesquisador",
        description: "Analisa materiais disponíveis",
        model: "flash",
        systemPrompt: "Analise e selecione materiais relevantes da biblioteca."
      },
      {
        id: "writer",
        name: "Escritor",
        description: "Cria o primeiro rascunho",
        model: "pro",
        systemPrompt: "Crie o primeiro rascunho do conteúdo."
      },
      {
        id: "editor",
        name: "Editor de Estilo",
        description: "Refina o estilo do conteúdo",
        model: "pro",
        systemPrompt: "Refine o conteúdo para soar como o cliente."
      },
      {
        id: "reviewer",
        name: "Revisor Final",
        description: "Revisão final e polish",
        model: "flash",
        systemPrompt: "Faça revisão final e polish."
      }
    ];

    // Stream de progresso
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // Enhanced sendProgress with token tracking
        const sendProgress = (
          step: string, 
          status: string, 
          content?: string, 
          agentName?: string,
          tokens?: { input: number; output: number; cost: number }
        ) => {
          const data = JSON.stringify({ step, status, content, agentName, tokens });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        };

        // Track cumulative tokens
        let totalInputTokens = 0;
        let totalOutputTokens = 0;
        let totalCost = 0;

        // Model pricing per 1M tokens
        const MODEL_COSTS: Record<string, { input: number; output: number }> = {
          "gemini-2.5-flash": { input: 0.075, output: 0.30 },
          "gemini-2.5-pro": { input: 1.25, output: 5.00 },
          "gemini-2.0-flash-lite": { input: 0.02, output: 0.08 },
          "flash": { input: 0.075, output: 0.30 },
          "pro": { input: 1.25, output: 5.00 },
          "flash-lite": { input: 0.02, output: 0.08 },
        };

        const calculateCost = (model: string, inputTokens: number, outputTokens: number): number => {
          const pricing = MODEL_COSTS[model] || MODEL_COSTS["flash"];
          return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
        };

        try {
          const context = {
            userMessage,
            clientName,
            identityGuide,
            copywritingGuide,
            contentLibrary,
            referenceLibrary,
            previousOutputs: {} as Record<string, string>,
            contentType: contentType || "geral"
          };

          // Execute each agent and LOG INDIVIDUALLY
          for (let i = 0; i < agents.length; i++) {
            const agent = agents[i];
            const isLast = i === agents.length - 1;

            sendProgress(agent.id, "running", `${agent.description || agent.name}...`, agent.name);

            try {
              const result = await executeAgent(agent, context);
              
              context.previousOutputs[agent.id] = result.content;

              // Calculate cost for this agent
              const agentCost = calculateCost(agent.model, result.inputTokens, result.outputTokens);
              
              // Update cumulative totals
              totalInputTokens += result.inputTokens;
              totalOutputTokens += result.outputTokens;
              totalCost += agentCost;

              // LOG EACH AGENT INDIVIDUALLY with correct model
              const geminiModel = mapToGeminiModel(agent.model);
              if (userId) {
                await logAIUsage(
                  supabase,
                  userId,
                  geminiModel,
                  `chat-multi-agent/${agent.id}`,
                  result.inputTokens,
                  result.outputTokens,
                  { 
                    clientId, 
                    contentType, 
                    agentId: agent.id,
                    agentName: agent.name,
                    pipelineId: pipeline?.id || "default"
                  }
                );
              }

              // Send progress with token info
              if (isLast) {
                sendProgress(agent.id, "completed", `Finalizado`, agent.name, {
                  input: result.inputTokens,
                  output: result.outputTokens,
                  cost: agentCost
                });
                // Send final result with cumulative tokens
                sendProgress("complete", "done", result.content, undefined, {
                  input: totalInputTokens,
                  output: totalOutputTokens,
                  cost: totalCost
                });
              } else {
                sendProgress(agent.id, "completed", `${result.content.length} caracteres`, agent.name, {
                  input: result.inputTokens,
                  output: result.outputTokens,
                  cost: agentCost
                });
              }
            } catch (agentError: any) {
              console.error(`[AGENT-${agent.id}] Error:`, agentError);
              throw new Error(`Erro no agente ${agent.name}: ${agentError.message}`);
            }
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error: any) {
          console.error("[MULTI-AGENT] Pipeline error:", error);
          sendProgress("error", "failed", error.message);
          controller.close();
        }
      }
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
    console.error("[MULTI-AGENT] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
