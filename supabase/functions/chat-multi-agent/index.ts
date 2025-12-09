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

// Mapeia nomes de modelo para formato Gemini
function mapToGeminiModel(model: string): string {
  const modelMap: Record<string, string> = {
    "google/gemini-2.5-flash": "gemini-2.5-flash-preview-05-20",
    "google/gemini-2.5-pro": "gemini-2.5-pro-preview-06-05",
    "google/gemini-2.5-flash-lite": "gemini-2.5-flash-lite-preview-06-17",
    "gemini-2.5-flash": "gemini-2.5-flash-preview-05-20",
    "gemini-2.5-pro": "gemini-2.5-pro-preview-06-05",
    "gemini-2.5-flash-lite": "gemini-2.5-flash-lite-preview-06-17",
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

  console.log(`[MULTI-AGENT] Calling Gemini with model: ${model}`);

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
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GOOGLE_API_KEY}`,
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

// ============ AGENTES ESPECIALIZADOS ============

// AGENTE 1: PESQUISADOR - Seleciona materiais relevantes
async function agentResearcher(
  userMessage: string,
  contentLibrary: any[],
  referenceLibrary: any[],
  clientName: string
): Promise<{ selectedMaterials: any[]; insights: string }> {
  console.log(`[AGENT-1] Researcher analyzing request...`);

  const systemPrompt = `Você é o AGENTE PESQUISADOR especializado em análise de bibliotecas de conteúdo.

Sua função é:
1. Analisar a solicitação do usuário
2. Identificar os materiais MAIS RELEVANTES da biblioteca de conteúdo
3. Priorizar conteúdos com TOM, ESTRUTURA e ESTILO similares ao que será criado
4. Extrair insights sobre padrões de sucesso

IMPORTANTE:
- Selecione no MÁXIMO 5 materiais (os mais relevantes)
- Priorize conteúdos do MESMO TIPO do que está sendo pedido
- Identifique padrões de linguagem, estrutura e abordagem

Retorne sua análise em formato estruturado:

## MATERIAIS SELECIONADOS
[Liste os IDs e títulos dos materiais selecionados, explicando brevemente por quê cada um é relevante]

## PADRÕES IDENTIFICADOS
[Descreva padrões de estrutura, linguagem e abordagem que você identificou]

## INSIGHTS PARA CRIAÇÃO
[Dicas específicas baseadas na análise para guiar a criação do novo conteúdo]`;

  const libraryContext = contentLibrary.slice(0, 20).map(c => 
    `ID: ${c.id}\nTítulo: ${c.title}\nTipo: ${c.content_type}\nPreview: ${c.content.substring(0, 500)}...`
  ).join("\n\n---\n\n");

  const refContext = referenceLibrary.slice(0, 10).map(r =>
    `ID: ${r.id}\nTítulo: ${r.title}\nTipo: ${r.reference_type}\nPreview: ${r.content.substring(0, 300)}...`
  ).join("\n\n---\n\n");

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: `Cliente: ${clientName}

## BIBLIOTECA DE CONTEÚDO (${contentLibrary.length} itens):
${libraryContext}

## BIBLIOTECA DE REFERÊNCIAS (${referenceLibrary.length} itens):
${refContext}

## SOLICITAÇÃO DO USUÁRIO:
${userMessage}

Analise e selecione os materiais mais relevantes para criar este conteúdo.` }
  ];

  const result = await callGemini(messages, "gemini-2.5-flash-preview-05-20");
  
  // Extrair IDs dos materiais mencionados
  const selectedIds = contentLibrary
    .filter(c => result.content.includes(c.id) || result.content.includes(c.title))
    .slice(0, 5);

  console.log(`[AGENT-1] Selected ${selectedIds.length} materials`);

  return {
    selectedMaterials: selectedIds,
    insights: result.content
  };
}

// AGENTE 2: ESCRITOR - Cria o primeiro rascunho
async function agentWriter(
  userMessage: string,
  selectedMaterials: any[],
  identityGuide: string,
  clientName: string,
  researchInsights: string,
  writerModel: string = "google/gemini-2.5-pro"
): Promise<string> {
  console.log(`[AGENT-2] Writer creating first draft with model: ${writerModel}...`);

  const materialsContext = selectedMaterials.map(m => 
    `### ${m.title} (${m.content_type})\n${m.content}`
  ).join("\n\n---\n\n");

  const systemPrompt = `Você é o AGENTE ESCRITOR especializado em criação de conteúdo de alta qualidade.

Sua função é criar um PRIMEIRO RASCUNHO completo baseado em:
1. A solicitação específica do usuário
2. O guia de identidade do cliente
3. Os materiais de referência selecionados pelo Pesquisador
4. Os insights e padrões identificados

DIRETRIZES:
- Crie conteúdo COMPLETO e bem estruturado
- SIGA os padrões de estrutura dos materiais de referência
- ADAPTE o tom de voz ao guia de identidade
- Seja ORIGINAL - não copie, mas siga os padrões
- Use dados e informações precisas
- Inclua todos os elementos necessários (hooks, CTAs, etc.)

IMPORTANTE: Seu rascunho será REFINADO por outro agente, então foque em:
- Conteúdo correto e completo
- Estrutura adequada
- Informações precisas`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: `## CLIENTE: ${clientName}

## GUIA DE IDENTIDADE:
${identityGuide || "Não disponível - use tom profissional e acessível"}

## MATERIAIS DE REFERÊNCIA:
${materialsContext || "Nenhum material selecionado"}

## INSIGHTS DO PESQUISADOR:
${researchInsights}

## SOLICITAÇÃO:
${userMessage}

Crie agora o primeiro rascunho do conteúdo solicitado.` }
  ];

  const result = await callGemini(messages, mapToGeminiModel(writerModel));
  console.log(`[AGENT-2] Draft created: ${result.content.length} chars`);
  
  return result.content;
}

// AGENTE 3: EDITOR DE ESTILO - Refina para parecer com a biblioteca
async function agentStyleEditor(
  draft: string,
  selectedMaterials: any[],
  copywritingGuide: string,
  clientName: string,
  editorModel: string = "google/gemini-2.5-pro"
): Promise<string> {
  console.log(`[AGENT-3] Style Editor refining with model: ${editorModel}...`);

  // Pegar exemplos completos para comparação
  const examples = selectedMaterials.slice(0, 3).map(m => 
    `### EXEMPLO: ${m.title}\n${m.content}`
  ).join("\n\n---\n\n");

  const systemPrompt = `Você é o AGENTE EDITOR DE ESTILO especializado em refinar conteúdo para máxima qualidade.

Sua função CRÍTICA é:
1. Comparar o rascunho com os EXEMPLOS REAIS da biblioteca do cliente
2. Ajustar o TOM DE VOZ para soar EXATAMENTE como os exemplos
3. Refinar VOCABULÁRIO, expressões e estilo de escrita
4. Aplicar as regras do guia de copywriting
5. Garantir que o conteúdo pareça ESCRITO PELO CLIENTE, não por IA

PROCESSO DE REFINAMENTO:
1. Analise os exemplos: Como eles começam? Que palavras usam? Qual o ritmo?
2. Compare com o rascunho: O que está diferente? O que precisa mudar?
3. Refine cada seção: Reescreva mantendo a essência mas melhorando o estilo
4. Verifique: O resultado parece ter sido escrito pelo cliente?

REGRAS ABSOLUTAS:
- NUNCA use linguagem genérica de IA
- SEMPRE use o vocabulário específico do cliente
- MANTENHA a estrutura dos exemplos de referência
- USE as mesmas expressões e turns of phrase
- ADAPTE hooks e CTAs ao estilo do cliente`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: `## CLIENTE: ${clientName}

## GUIA DE COPYWRITING:
${copywritingGuide || "Use tom conversacional, direto e envolvente. Evite jargões desnecessários."}

## EXEMPLOS REAIS DO CLIENTE (USE COMO REFERÊNCIA DE ESTILO):
${examples || "Sem exemplos disponíveis"}

## RASCUNHO A REFINAR:
${draft}

TAREFA: Reescreva o rascunho para que soe EXATAMENTE como os exemplos do cliente.
O leitor não deve perceber que foi escrito por IA.
Mantenha todo o conteúdo, mas refine completamente o estilo.` }
  ];

  const result = await callGemini(messages, mapToGeminiModel(editorModel));
  console.log(`[AGENT-3] Refined: ${result.content.length} chars`);
  
  return result.content;
}

// AGENTE 4: REVISOR FINAL - Checklist de qualidade
async function agentReviewer(
  content: string,
  contentType: string,
  clientName: string
): Promise<string> {
  console.log(`[AGENT-4] Reviewer doing final check...`);

  const systemPrompt = `Você é o AGENTE REVISOR FINAL responsável pelo polish e verificação de qualidade.

CHECKLIST DE QUALIDADE:
1. ✓ Sem erros de gramática ou ortografia
2. ✓ Sem emojis no meio de frases (apenas início/fim de seções)
3. ✓ CTAs claros e persuasivos
4. ✓ Hook forte e envolvente
5. ✓ Formatação correta para o tipo de conteúdo
6. ✓ Fluxo lógico e coeso
7. ✓ Sem linguagem genérica de IA ("certamente", "com certeza", etc.)
8. ✓ Separadores de página/slide quando aplicável

REGRAS DE FORMATAÇÃO:
- Para carrosséis: Use "---PÁGINA N---" entre slides
- Para stories: Use "---STORIE N---" entre stories
- Para threads: Use "---TWEET N---" entre tweets
- Sempre termine com CTA claro

Se encontrar problemas, CORRIJA diretamente.
Retorne a versão FINAL polida e pronta para publicação.`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: `## CLIENTE: ${clientName}
## TIPO DE CONTEÚDO: ${contentType || "geral"}

## CONTEÚDO PARA REVISÃO:
${content}

Faça a revisão final e retorne a versão PRONTA PARA PUBLICAÇÃO.` }
  ];

  const result = await callGemini(messages, "gemini-2.5-flash-preview-05-20");
  console.log(`[AGENT-4] Final version: ${result.content.length} chars`);
  
  return result.content;
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
      writerModel = "google/gemini-2.5-pro",
      editorModel = "google/gemini-2.5-pro"
    } = await req.json();

    console.log(`[MULTI-AGENT] Starting pipeline for ${clientName}`);
    console.log(`[MULTI-AGENT] Writer model: ${writerModel}, Editor model: ${editorModel}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    // Stream de progresso
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendProgress = (step: string, status: string, content?: string) => {
          const data = JSON.stringify({ step, status, content });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        };

        try {
          // FASE 1: Pesquisador
          sendProgress("researcher", "running");
          const research = await agentResearcher(
            userMessage,
            contentLibrary,
            referenceLibrary,
            clientName
          );
          sendProgress("researcher", "completed", `Selecionados ${research.selectedMaterials.length} materiais`);

          // FASE 2: Escritor
          sendProgress("writer", "running");
          const draft = await agentWriter(
            userMessage,
            research.selectedMaterials,
            identityGuide,
            clientName,
            research.insights,
            writerModel
          );
          sendProgress("writer", "completed", `Rascunho: ${draft.length} caracteres`);

          // FASE 3: Editor de Estilo
          sendProgress("editor", "running");
          const refined = await agentStyleEditor(
            draft,
            research.selectedMaterials,
            copywritingGuide,
            clientName,
            editorModel
          );
          sendProgress("editor", "completed", `Refinado: ${refined.length} caracteres`);

          // FASE 4: Revisor Final
          sendProgress("reviewer", "running");
          const final = await agentReviewer(
            refined,
            contentType,
            clientName
          );
          sendProgress("reviewer", "completed");

          // Enviar resultado final
          sendProgress("complete", "done", final);

          // Log usage
          if (userId) {
            await logAIUsage(
              supabase,
              userId,
              "multi-agent-pipeline",
              "chat-multi-agent",
              totalInputTokens,
              totalOutputTokens,
              { clientId, contentType, writerModel, editorModel }
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
