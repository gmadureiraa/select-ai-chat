import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Pricing por 1M tokens (USD)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "gemini-3-pro-preview": { input: 0.00, output: 0.00 },
  "gemini-2.5-flash": { input: 0.075, output: 0.30 },
  "gemini-2.5-flash-lite": { input: 0.0375, output: 0.15 },
  "gemini-2.0-flash-lite": { input: 0.0375, output: 0.15 },
  "gemini-2.5-pro": { input: 1.25, output: 5.00 },
  "gpt-5": { input: 2.50, output: 10.00 },
  "claude-sonnet-4-5": { input: 3.00, output: 15.00 },
};

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model] || { input: 0, output: 0 };
  return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
}

function getProvider(model: string): string {
  if (model.includes("gemini")) return "google";
  if (model.includes("gpt-")) return "openai";
  if (model.includes("claude")) return "anthropic";
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

    await supabase.from("ai_usage_logs").insert({
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
    console.log(`[USAGE] Logged: ${model} - ${totalTokens} tokens - $${estimatedCost.toFixed(6)}`);
  } catch (error) {
    console.error("[USAGE] Error:", error);
  }
}

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

  // Construir contexto baseado no tipo de agente
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
    // Extrair materiais selecionados pelo pesquisador
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
    // Agente customizado - usar output anterior
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

// ============ PIPELINE PRINCIPAL ============

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const {
      userMessage,
      contentLibrary = [],
      referenceLibrary = [],
      identityGuide = "",
      copywritingGuide = "",
      clientName,
      contentType,
      userId,
      clientId,
      pipeline // Novo: recebe a configuração do pipeline
    } = await req.json();

    console.log(`[MULTI-AGENT] Starting pipeline for ${clientName}`);
    console.log(`[MULTI-AGENT] Content type: ${contentType}`);
    console.log(`[MULTI-AGENT] Pipeline: ${pipeline?.name || "default"}`);
    console.log(`[MULTI-AGENT] Agents: ${pipeline?.agents?.map((a: any) => a.id).join(" → ") || "default"}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    // Usar pipeline recebido ou fallback para pipeline padrão
    const agents: PipelineAgent[] = pipeline?.agents || [
      {
        id: "researcher",
        name: "Pesquisador",
        model: "flash",
        systemPrompt: "Analise e selecione materiais relevantes da biblioteca."
      },
      {
        id: "writer",
        name: "Escritor",
        model: "pro",
        systemPrompt: "Crie o primeiro rascunho do conteúdo."
      },
      {
        id: "editor",
        name: "Editor de Estilo",
        model: "pro",
        systemPrompt: "Refine o conteúdo para soar como o cliente."
      },
      {
        id: "reviewer",
        name: "Revisor Final",
        model: "flash",
        systemPrompt: "Faça revisão final e polish."
      }
    ];

    // Stream de progresso
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendProgress = (step: string, status: string, content?: string, agentName?: string) => {
          const data = JSON.stringify({ step, status, content, agentName });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
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

          // Executar cada agente em sequência
          for (let i = 0; i < agents.length; i++) {
            const agent = agents[i];
            const isLast = i === agents.length - 1;

            sendProgress(agent.id, "running", `${agent.description || agent.name}...`, agent.name);

            try {
              const result = await executeAgent(agent, context);
              
              // Armazenar output para próximo agente
              context.previousOutputs[agent.id] = result.content;
              totalInputTokens += result.inputTokens;
              totalOutputTokens += result.outputTokens;

              if (isLast) {
                // Último agente - enviar resultado final
                sendProgress(agent.id, "completed", `Finalizado`, agent.name);
                sendProgress("complete", "done", result.content);
              } else {
                sendProgress(agent.id, "completed", `${result.content.length} caracteres`, agent.name);
              }
            } catch (agentError: any) {
              console.error(`[AGENT-${agent.id}] Error:`, agentError);
              throw new Error(`Erro no agente ${agent.name}: ${agentError.message}`);
            }
          }

          // Log usage
          if (userId) {
            await logAIUsage(
              supabase,
              userId,
              "multi-agent-pipeline",
              "chat-multi-agent",
              totalInputTokens,
              totalOutputTokens,
              { 
                clientId, 
                contentType, 
                pipelineId: pipeline?.id || "default",
                agentCount: agents.length 
              }
            );
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
