import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { logAIUsage, estimateTokens } from "../_shared/ai-usage.ts";
import { 
  validateString, 
  validateUUID, 
  validateArray,
  createValidationErrorResponse,
  sanitizeString
} from "../_shared/validation.ts";
import { buildAgentContext } from "../_shared/knowledge-loader.ts";

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

// ============ SELEÇÃO INTELIGENTE DE REFERÊNCIAS ============
interface SelectedReferences {
  carouselExamples: any[];
  contentReferences: any[];
}

function selectBestReferences(
  contentLibrary: any[],
  referenceLibrary: any[],
  contentType: string
): SelectedReferences {
  // Para carrosséis: buscar carrosséis do cliente primeiro (exemplos de estilo)
  const carouselExamples = contentLibrary
    .filter(c => c.content_type === 'carousel')
    .slice(0, 2); // Máximo 2 exemplos completos para não sobrecarregar
  
  // Referências mais recentes (fontes de informação)
  const contentReferences = referenceLibrary
    .slice(0, 2); // Máximo 2 referências completas
    
  console.log(`[SELECT-REFS] Selected ${carouselExamples.length} carousel examples, ${contentReferences.length} references`);
  
  return { carouselExamples, contentReferences };
}

// ============ PIPELINE SIMPLIFICADO PARA CARROSSEL ============
const CAROUSEL_SIMPLE_PIPELINE: PipelineAgent[] = [
  {
    id: "writer",
    name: "Escritor de Carrossel",
    description: "Escreve o carrossel baseado em exemplos e referências",
    model: "pro",
    systemPrompt: `Você é um especialista em criar carrosséis para Instagram que PARAM O SCROLL.

MISSÃO: Criar carrosséis persuasivos que fazem as pessoas DESLIZAREM até o final.

PROCESSO OBRIGATÓRIO:
1. ESTUDE os exemplos de carrosséis do cliente - IMITE este estilo
2. USE as referências como fonte de informação
3. TRANSFORME informação em narrativa persuasiva

ESTRUTURA OBRIGATÓRIA:
- Página 1: GANCHO (máx 20 palavras) - Dor/Promessa/Segredo/Contraste
- Página 2: PONTE (máx 30 palavras) - Aprofunde a curiosidade, termine com "→"
- Páginas 3-7: CONTEÚDO (máx 30 palavras cada) - 1 insight por página
- Páginas 8-9: FECHAMENTO - Recapitulação ou insight final
- Página 10: CTA - "Salve" + ação específica

LINGUAGEM PROIBIDA:
- "Entenda", "Descubra", "Aprenda", "Neste carrossel", "Vamos falar sobre"

LINGUAGEM OBRIGATÓRIA:
- "Você está perdendo", "O segredo é", "Faça isso", "Pare de"

REGRA DE OURO: O leitor deve QUERER deslizar. Cada slide cria curiosidade para o próximo.`
  },
  {
    id: "reviewer",
    name: "Revisor de Carrossel",
    description: "Valida estrutura e corrige problemas",
    model: "flash",
    systemPrompt: `Você é um revisor rigoroso de carrosséis.

CHECKLIST OBRIGATÓRIO - VALIDE CADA ITEM:

□ PÁGINA 1: Tem máximo 20 palavras?
□ PÁGINA 1: Usa gancho emocional (não educativo)?
□ PÁGINA 1: NÃO começa com "Entenda", "Descubra", "Aprenda"?
□ DEMAIS PÁGINAS: Têm máximo 30 palavras cada?
□ CADA PÁGINA: Tem apenas UM ponto/insight?
□ TRANSIÇÕES: Há ganchos entre páginas ("→", "E tem mais", "Mas calma")?
□ TOM: É conversacional e direto?
□ CTA: Última página tem call-to-action claro?

SE QUALQUER ITEM FALHAR:
- Identifique o problema
- REESCREVA a página problemática
- Retorne a versão corrigida

SE TUDO OK:
- Retorne o carrossel sem alterações

FORMATAÇÃO OBRIGATÓRIA:
Página 1:
[Título/Gancho]

[Texto se houver]

VISUAL RECOMENDADO: [descrição]

---

Página 2:
[Conteúdo]

VISUAL RECOMENDADO: [descrição]

(continue para todas as páginas)

REGRA ABSOLUTA: Retorne APENAS o conteúdo formatado. Sem comentários, sem "Aqui está".`
  }
];

// ============ EXECUÇÃO DO ESCRITOR DE CARROSSEL ============
async function executeCarouselWriter(
  agent: PipelineAgent,
  context: {
    userMessage: string;
    clientName: string;
    identityGuide: string;
    carouselExamples: any[];
    contentReferences: any[];
  }
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  console.log(`[CAROUSEL-WRITER] Examples: ${context.carouselExamples.length}, References: ${context.contentReferences.length}`);

  // Formatar exemplos COMPLETOS de carrosséis do cliente
  const examplesText = context.carouselExamples.length > 0
    ? context.carouselExamples.map((e, i) => 
        `### EXEMPLO ${i + 1}: ${e.title}\n${e.content}`
      ).join("\n\n---\n\n")
    : "Nenhum exemplo disponível - use tom profissional e direto.";

  // Formatar referências COMPLETAS
  const referencesText = context.contentReferences.length > 0
    ? context.contentReferences.map((r, i) => 
        `### REFERÊNCIA ${i + 1}: ${r.title}\n${r.content}`
      ).join("\n\n---\n\n")
    : "Nenhuma referência específica - crie baseado na solicitação.";

  const userPrompt = `## CLIENTE: ${context.clientName}

## GUIA DE IDENTIDADE:
${context.identityGuide || "Use tom profissional, direto e envolvente."}

## EXEMPLOS DE CARROSSÉIS DO CLIENTE (IMITE ESTE ESTILO):
${examplesText}

## REFERÊNCIAS PARA USAR COMO FONTE DE INFORMAÇÃO:
${referencesText}

## TEMPLATE OBRIGATÓRIO:
Página 1: [Gancho - máx 20 palavras, use dor/urgência/curiosidade]
Página 2: [Ponte - aprofunde a dor, termine com "→"]
Páginas 3-7: [Conteúdo - 1 insight por página, máx 30 palavras]
Páginas 8-9: [Fechamento - recapitule ou insight final]
Página 10: [CTA - "Salve" + ação específica]

## REGRAS CRÍTICAS:
1. IMITE o estilo dos exemplos do cliente acima
2. USE informações das referências
3. NÃO use: "Entenda", "Descubra", "Neste carrossel"
4. USE: "Você está perdendo", "O segredo é", "Faça isso"
5. Máximo 20 palavras na página 1, 30 nas demais

## SOLICITAÇÃO:
${context.userMessage}

Crie o carrossel agora, seguindo EXATAMENTE a estrutura e estilo indicados.`;

  const messages = [
    { role: "system", content: agent.systemPrompt },
    { role: "user", content: userPrompt }
  ];

  return await callGemini(messages, agent.model);
}

// ============ EXECUÇÃO DO REVISOR DE CARROSSEL ============
async function executeCarouselReviewer(
  agent: PipelineAgent,
  context: {
    clientName: string;
    draftContent: string;
  }
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  console.log(`[CAROUSEL-REVIEWER] Reviewing ${context.draftContent.length} chars`);

  const userPrompt = `## CLIENTE: ${context.clientName}

## CARROSSEL PARA REVISAR:
${context.draftContent}

Execute a validação do checklist e retorne a versão final formatada.`;

  const messages = [
    { role: "system", content: agent.systemPrompt },
    { role: "user", content: userPrompt }
  ];

  return await callGemini(messages, agent.model);
}

// ============ EXECUÇÃO GENÉRICA DE AGENTE (para outros formatos) ============
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

  // Carregar documentação específica do agente e formato
  const knowledgeContext = await buildAgentContext(agent.id, context.contentType);
  console.log(`[AGENT-${agent.id}] Loaded knowledge context: ${knowledgeContext.length} chars`);

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

## REGRAS DE FORMATAÇÃO OBRIGATÓRIAS:

1. **USE MARKDOWN RICO** para estruturar o conteúdo:
   - Use \`**negrito**\` para destacar palavras-chave
   - Use \`- item\` para listas
   - Use \`---\` para separar páginas

2. **PARA CARROSSÉIS/SLIDES/STORIES:**
   - Use "Página 1:", "Página 2:", etc. (numeração simples)
   - Título opcional, seguido do texto (SEM labels "TÍTULO:" ou "TEXTO:")
   - "VISUAL RECOMENDADO:" SEMPRE no final de cada página, após todo o conteúdo
   - Separador \`---\` entre páginas

3. **PARA NEWSLETTERS:**
   - Use headers claros para cada seção
   - Separe blocos com linhas vazias
   - CTAs em destaque com **negrito**

4. **NUNCA USE:**
   - "📱 Slide X" ou "Story X/Y" ou "[SLIDE X]"
   - "> 🎨 Visual:" no meio do conteúdo
   - Labels como "TÍTULO:" ou "TEXTO:"
   - "---PÁGINA 1---" ou "---SLIDE 1---"
   - Texto corrido sem estrutura

IMPORTANTE: Retorne APENAS o conteúdo final formatado. Sem comentários, sem "Aqui está", sem prefixos.`;
  } else {
    const lastOutput = Object.values(context.previousOutputs).pop() || "";
    userPrompt = `## CLIENTE: ${context.clientName}
## CONTEXTO ANTERIOR:
${lastOutput}

## SOLICITAÇÃO:
${context.userMessage}

Execute sua função.`;
  }

  // Construir system prompt enriquecido com documentação
  const enrichedSystemPrompt = knowledgeContext 
    ? `${knowledgeContext}\n---\n\n${agent.systemPrompt}`
    : agent.systemPrompt;

  const messages = [
    { role: "system", content: enrichedSystemPrompt },
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
    
    // Detectar se é carrossel para usar pipeline simplificado
    const isCarousel = contentType === 'carousel';
    console.log(`[MULTI-AGENT] Using ${isCarousel ? 'SIMPLIFIED CAROUSEL' : 'DEFAULT'} pipeline`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
          tokens?: { input: number; output: number; cost: number; savedContentId?: string | null }
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
          // ============ PIPELINE SIMPLIFICADO PARA CARROSSEL ============
          if (isCarousel) {
            console.log(`[CAROUSEL-PIPELINE] Starting simplified 2-agent pipeline`);
            
            // Selecionar referências programaticamente
            const { carouselExamples, contentReferences } = selectBestReferences(
              contentLibrary,
              referenceLibrary,
              contentType || "carousel"
            );

            // AGENTE 1: Escritor de Carrossel
            const writerAgent = CAROUSEL_SIMPLE_PIPELINE[0];
            sendProgress(writerAgent.id, "running", `${writerAgent.description}...`, writerAgent.name);
            
            const writerResult = await executeCarouselWriter(writerAgent, {
              userMessage,
              clientName,
              identityGuide,
              carouselExamples,
              contentReferences
            });

            const writerCost = calculateCost(writerAgent.model, writerResult.inputTokens, writerResult.outputTokens);
            totalInputTokens += writerResult.inputTokens;
            totalOutputTokens += writerResult.outputTokens;
            totalCost += writerCost;

            if (userId) {
              await logAIUsage(
                supabase,
                userId,
                mapToGeminiModel(writerAgent.model),
                `chat-multi-agent/${writerAgent.id}`,
                writerResult.inputTokens,
                writerResult.outputTokens,
                { clientId, contentType, agentId: writerAgent.id, agentName: writerAgent.name, pipelineId: "carousel-simple" }
              );
            }

            sendProgress(writerAgent.id, "completed", `${writerResult.content.length} caracteres`, writerAgent.name, {
              input: writerResult.inputTokens,
              output: writerResult.outputTokens,
              cost: writerCost
            });

            // AGENTE 2: Revisor de Carrossel
            const reviewerAgent = CAROUSEL_SIMPLE_PIPELINE[1];
            sendProgress(reviewerAgent.id, "running", `${reviewerAgent.description}...`, reviewerAgent.name);

            const reviewerResult = await executeCarouselReviewer(reviewerAgent, {
              clientName,
              draftContent: writerResult.content
            });

            const reviewerCost = calculateCost(reviewerAgent.model, reviewerResult.inputTokens, reviewerResult.outputTokens);
            totalInputTokens += reviewerResult.inputTokens;
            totalOutputTokens += reviewerResult.outputTokens;
            totalCost += reviewerCost;

            if (userId) {
              await logAIUsage(
                supabase,
                userId,
                mapToGeminiModel(reviewerAgent.model),
                `chat-multi-agent/${reviewerAgent.id}`,
                reviewerResult.inputTokens,
                reviewerResult.outputTokens,
                { clientId, contentType, agentId: reviewerAgent.id, agentName: reviewerAgent.name, pipelineId: "carousel-simple" }
              );
            }

            sendProgress(reviewerAgent.id, "completed", `Finalizado`, reviewerAgent.name, {
              input: reviewerResult.inputTokens,
              output: reviewerResult.outputTokens,
              cost: reviewerCost
            });

            // Send final result
            sendProgress("complete", "done", reviewerResult.content, undefined, {
              input: totalInputTokens,
              output: totalOutputTokens,
              cost: totalCost
            });

            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
            return;
          }

          // ============ PIPELINE PADRÃO PARA OUTROS FORMATOS ============
          console.log(`[MULTI-AGENT] Pipeline: ${pipeline?.name || "default"}`);
          console.log(`[MULTI-AGENT] Agents: ${pipeline?.agents?.map((a: any) => a.id).join(" → ") || "default"}`);

          // Use pipeline received or fallback to default
          const agents: PipelineAgent[] = pipeline?.agents || [
            {
              id: "researcher",
              name: "Pesquisador",
              description: "Analisa materiais disponíveis",
              model: "flash",
              systemPrompt: `Você é um Pesquisador especializado.

MISSÃO: Analisar materiais disponíveis e selecionar os mais relevantes para a tarefa.

REGRAS:
- Use APENAS dados fornecidos (content_library, reference_library, global_knowledge)
- NUNCA invente dados ou estatísticas
- Organize informações de forma clara: Fatos principais → Detalhes → Aplicação
- Identifique padrões de estilo nos exemplos do cliente

ENTREGUE:
- IDs e títulos dos materiais mais relevantes
- Insights aplicáveis ao conteúdo solicitado
- Padrões de tom/estilo identificados nos exemplos`
            },
            {
              id: "writer",
              name: "Escritor",
              description: "Cria o primeiro rascunho",
              model: "pro",
              systemPrompt: `Você é um Escritor de Conteúdo especializado.

HIERARQUIA DE PRIORIDADE (SIGA RIGOROSAMENTE):
1. IDENTIDADE DO CLIENTE (identity_guide) - tom, voz, estilo são SAGRADOS
2. DOCUMENTAÇÃO DO FORMATO - estrutura e regras obrigatórias
3. BIBLIOTECA DE CONTEÚDO - use como REFERÊNCIA de estilo, nunca copie
4. KNOWLEDGE BASE - use insights mas ADAPTE ao tom do cliente

REGRAS ABSOLUTAS:
- NUNCA use linguagem genérica de IA ("Aqui está", "Espero que ajude", etc.)
- SEMPRE siga a estrutura exata do formato solicitado
- SEMPRE adapte insights da knowledge base ao tom do cliente
- O conteúdo deve parecer escrito PELO cliente, não POR IA

ENTREGUE:
- Rascunho completo seguindo a estrutura do formato
- Tom de voz alinhado aos exemplos do cliente`
            },
            {
              id: "editor",
              name: "Editor de Estilo",
              description: "Refina o estilo do conteúdo",
              model: "pro",
              systemPrompt: `Você é um Editor de Estilo especializado.

MISSÃO: Fazer o conteúdo soar EXATAMENTE como o cliente escreve.

PROCESSO OBRIGATÓRIO:
1. Compare o rascunho com os exemplos reais do cliente
2. Identifique diferenças de tom, vocabulário, expressões
3. Reescreva para eliminar qualquer "cara de IA"
4. Aplique regras do copywriting_guide (se disponível)

CHECKLIST DE EDIÇÃO:
✓ Vocabulário específico do cliente usado?
✓ Estrutura do formato respeitada?
✓ Ganchos e CTAs no estilo do cliente?
✓ Zero linguagem genérica de IA?

ENTREGUE:
- Conteúdo refinado que pareça escrito PELO cliente`
            },
            {
              id: "reviewer",
              name: "Revisor Final",
              description: "Revisão final e polish",
              model: "flash",
              systemPrompt: `Você é o Revisor Final especialista em formatação.

REGRA ABSOLUTA DE OUTPUT:
- Retorne EXCLUSIVAMENTE o conteúdo final FORMATADO
- NÃO inclua comentários, explicações ou introduções
- NÃO diga "Aqui está", "Versão final", "Pronto", etc.

FORMATAÇÃO OBRIGATÓRIA PARA CARROSSÉIS/SLIDES/STORIES:
Página 1:
Título impactante aqui

Texto da página...

VISUAL RECOMENDADO: descrição da arte

---

Página 2:
Conteúdo da página...

VISUAL RECOMENDADO: descrição

REGRAS:
- Use "Página X:" (numeração simples, SEM emojis como 📱)
- Título opcional seguido de texto (SEM labels "TÍTULO:" ou "TEXTO:")
- "VISUAL RECOMENDADO:" SEMPRE no final de cada página
- Separador "---" entre páginas
- **negrito** para destaques, - para listas

NUNCA USE:
- "📱 Slide X" ou "Story X/Y"
- "> 🎨 Visual:" 
- Labels "TÍTULO:" ou "TEXTO:"

CHECKLIST SILENCIOSO:
✓ Formato de páginas correto
✓ VISUAL RECOMENDADO no final de cada página
✓ Gramática correta
✓ CTAs claros
✓ Hook forte

OUTPUT: Conteúdo final formatado.`
            }
          ];

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
