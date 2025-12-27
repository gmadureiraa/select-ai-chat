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

interface LayoutSlide {
  slideNumber: number;
  mainText: string;
  mainTextStyle?: { font?: string; size?: string; color?: string };
  secondaryText?: string;
  secondaryTextStyle?: { font?: string; size?: string; color?: string };
  background?: string;
  imagePrompt?: string;
}

interface LayoutGuide {
  slides: LayoutSlide[];
  generalNotes?: string;
}

interface ProcessMetadata {
  knowledgeUsed: { id: string; title: string; category: string }[];
  structureExamples: { id: string; title: string; contentType: string }[];
  agentSteps: { agentId: string; agentName: string; inputTokens: number; outputTokens: number; durationMs: number }[];
  totalTokens: { input: number; output: number };
  totalCost: number;
  layoutGuide?: LayoutGuide;
  strategicInsights?: string[];
}

// Search knowledge base for relevant techniques
async function searchKnowledgeBase(
  supabaseUrl: string,
  authHeader: string,
  workspaceId: string,
  query: string,
  contentType: string
): Promise<{ id: string; title: string; content: string; category: string }[]> {
  try {
    const searchQuery = `${contentType} ${query}`.trim();
    console.log(`[KNOWLEDGE] Searching for: ${searchQuery}`);
    
    const response = await fetch(`${supabaseUrl}/functions/v1/search-knowledge`, {
      method: "POST",
      headers: {
        "Authorization": authHeader,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        query: searchQuery,
        workspaceId: workspaceId,
        limit: 5
      })
    });

    if (!response.ok) {
      console.error("[KNOWLEDGE] Search failed:", response.status);
      return [];
    }

    const data = await response.json();
    console.log(`[KNOWLEDGE] Found ${data.results?.length || 0} relevant documents`);
    return data.results || [];
  } catch (error) {
    console.error("[KNOWLEDGE] Search error:", error);
    return [];
  }
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
    knowledgeBase: { id: string; title: string; content: string; category: string }[];
    structureExamples: any[];
  }
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  console.log(`[AGENT-${agent.id}] Executing: ${agent.name} with model: ${agent.model}`);

  let userPrompt = "";

  if (agent.id === "researcher") {
    // Build knowledge base context
    const knowledgeContext = context.knowledgeBase.length > 0
      ? context.knowledgeBase.map(k => 
          `### ${k.title} (${k.category}):\n${k.content.substring(0, 2000)}...`
        ).join("\n\n---\n\n")
      : "Nenhum conhecimento específico encontrado na base.";

    const libraryContext = context.contentLibrary.slice(0, 15).map(c => 
      `ID: ${c.id}\nTítulo: ${c.title}\nTipo: ${c.content_type}\nPreview: ${c.content.substring(0, 400)}...`
    ).join("\n\n---\n\n");

    const refContext = context.referenceLibrary.slice(0, 8).map(r =>
      `ID: ${r.id}\nTítulo: ${r.title}\nTipo: ${r.reference_type}\nPreview: ${r.content.substring(0, 250)}...`
    ).join("\n\n---\n\n");

    userPrompt = `Cliente: ${context.clientName}

## 📚 BASE DE CONHECIMENTO (TÉCNICAS E METODOLOGIAS):
${knowledgeContext}

## BIBLIOTECA DE CONTEÚDO (${context.contentLibrary.length} itens):
${libraryContext}

## BIBLIOTECA DE REFERÊNCIAS (${context.referenceLibrary.length} itens):
${refContext}

## SOLICITAÇÃO DO USUÁRIO:
${context.userMessage}

TAREFA: Analise a Base de Conhecimento para identificar as melhores técnicas e práticas para criar este tipo de conteúdo.
Selecione os materiais mais relevantes da biblioteca e sintetize as técnicas que devem ser aplicadas.`;
  } else if (agent.id === "writer") {
    const researchOutput = context.previousOutputs["researcher"] || "";
    const selectedMaterials = context.contentLibrary.filter(c => 
      researchOutput.includes(c.id) || researchOutput.includes(c.title)
    ).slice(0, 5);

    const materialsContext = selectedMaterials.map(m => 
      `### ${m.title} (${m.content_type})\n${m.content}`
    ).join("\n\n---\n\n");

    // Add knowledge techniques summary
    const knowledgeTechniques = context.knowledgeBase.length > 0
      ? `## 📚 TÉCNICAS DA BASE DE CONHECIMENTO:\n${context.knowledgeBase.map(k => `- **${k.title}**: Aplicar técnicas descritas neste guia`).join("\n")}`
      : "";

    userPrompt = `## CLIENTE: ${context.clientName}

## GUIA DE IDENTIDADE:
${context.identityGuide || "Não disponível - use tom profissional e acessível"}

${knowledgeTechniques}

## MATERIAIS DE REFERÊNCIA:
${materialsContext || "Nenhum material selecionado"}

## INSIGHTS DO PESQUISADOR:
${researchOutput}

## TIPO DE CONTEÚDO: ${context.contentType}

## SOLICITAÇÃO:
${context.userMessage}

IMPORTANTE: Siga as técnicas e melhores práticas identificadas pelo Pesquisador.
NÃO use números fixos (como "10 slides") - deixe o conteúdo fluir naturalmente baseado nas técnicas.
Crie agora o primeiro rascunho do conteúdo solicitado.`;
  } else if (agent.id === "editor") {
    const draft = context.previousOutputs["writer"] || "";
    
    // Use structure examples for consistency
    const structureExamplesContext = context.structureExamples.length > 0
      ? context.structureExamples.map((m, i) => 
          `### EXEMPLO ${i + 1}: "${m.title}" (${m.content_type})\n\`\`\`\n${m.content}\n\`\`\``
        ).join("\n\n---\n\n")
      : "";

    userPrompt = `## CLIENTE: ${context.clientName}

## GUIA DE COPYWRITING:
${context.copywritingGuide || "Use tom conversacional, direto e envolvente. Evite jargões desnecessários."}

${structureExamplesContext ? `## 📐 EXEMPLOS REAIS DO CLIENTE (SIGA ESTE ESTILO!):
**CRÍTICO:** O leitor NÃO PODE perceber que foi escrito por IA.
Reescreva para soar EXATAMENTE como estes exemplos:

${structureExamplesContext}

**INSTRUÇÕES:**
- Copie o ESTILO de escrita e tom de voz dos exemplos
- Mantenha a estrutura de formatação similar
- Use as mesmas expressões e maneirismos
- Adapte o conteúdo para seguir estes padrões` : ""}

## RASCUNHO A REFINAR:
${draft}

TAREFA: Reescreva o rascunho para que soe EXATAMENTE como os exemplos do cliente.
Mantenha todo o conteúdo, mas refine completamente o estilo e tom.`;
  } else if (agent.id === "reviewer") {
    const contentToReview = context.previousOutputs["editor"] || context.previousOutputs["writer"] || "";

    // Dynamic validation based on content type (no hardcoded numbers)
    const validationGuidelines = context.knowledgeBase.length > 0
      ? `\n## VALIDAÇÕES BASEADAS NA BASE DE CONHECIMENTO:
Use as técnicas dos guias abaixo para validar o conteúdo:
${context.knowledgeBase.map(k => `- ${k.title}`).join("\n")}`
      : "";

    userPrompt = `## CLIENTE: ${context.clientName}
## TIPO DE CONTEÚDO: ${context.contentType || "geral"}
${validationGuidelines}

## CONTEÚDO PARA REVISÃO:
${contentToReview}

TAREFA: 
1. Verifique se o conteúdo segue as melhores práticas da Base de Conhecimento
2. Confirme que o tom está alinhado com o guia de identidade do cliente
3. Faça ajustes finais de clareza e fluidez
4. Retorne a versão PRONTA PARA PUBLICAÇÃO (apenas o conteúdo final, sem comentários)`;
  } else if (agent.id === "layout") {
    // Layout Agent - Art Director
    const finalContent = context.previousOutputs["reviewer"] || context.previousOutputs["editor"] || context.previousOutputs["writer"] || "";
    
    userPrompt = `## CLIENTE: ${context.clientName}
## TIPO DE CONTEÚDO: ${context.contentType || "geral"}

## CONTEÚDO FINAL:
${finalContent}

## BRAND ASSETS (se disponível):
${context.identityGuide ? `Guia de identidade: ${context.identityGuide}` : "Não disponível - use paleta moderna e profissional"}

TAREFA: Você é um Diretor de Arte. Analise o conteúdo e crie um GUIA DE LAYOUT completo.

Para CADA slide/seção, forneça:

1. **HIERARQUIA VISUAL**:
   - Qual texto é título principal (fonte sugerida, tamanho, cor hex)
   - Qual é texto secundário (fonte, tamanho, cor)
   - Sugestão de fundo (cor sólida, degradê, ou imagem)

2. **PROMPT DE IMAGEM** para IA:
   - Prompt detalhado e específico para gerar imagem perfeita
   - Incluir estilo artístico, composição, cores, mood
   - Formato: "A detailed image of [descrição], [estilo], [cores], [mood], high quality, 4K"

FORMATO DE RESPOSTA (JSON):
\`\`\`json
{
  "slides": [
    {
      "slideNumber": 1,
      "mainText": "Texto principal do slide",
      "mainTextStyle": { "font": "Inter Bold", "size": "36px", "color": "#FFFFFF" },
      "secondaryText": "Texto secundário se houver",
      "secondaryTextStyle": { "font": "Inter", "size": "18px", "color": "#CCCCCC" },
      "background": "Gradiente de #1a1a2e para #16213e",
      "imagePrompt": "A minimalist illustration of coins falling in slow motion, dark gradient background with red accents, financial theme, high quality, 4K"
    }
  ],
  "generalNotes": "Manter consistência visual entre todos os slides, usar a paleta primária do cliente"
}
\`\`\`

Responda APENAS com o JSON, sem texto adicional.`;
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

    // Get workspace_id and search knowledge base
    let knowledgeBase: { id: string; title: string; content: string; category: string }[] = [];
    let structureExamples: any[] = [];
    
    if (clientId) {
      const { data: clientData } = await supabase
        .from("clients")
        .select("workspace_id")
        .eq("id", clientId)
        .single();
      
      if (clientData?.workspace_id) {
        // Get auth header for knowledge search
        const authHeader = req.headers.get("Authorization") || "";
        
        // Search knowledge base for relevant techniques
        knowledgeBase = await searchKnowledgeBase(
          supabaseUrl,
          authHeader,
          clientData.workspace_id,
          userMessage,
          contentType || ""
        );
        
        console.log(`[MULTI-AGENT] Found ${knowledgeBase.length} knowledge documents`);
      }
      
      // Get structure examples from content library (same content type)
      if (contentType) {
        const contentTypeMap: Record<string, string[]> = {
          "carousel": ["carousel", "carrossel"],
          "carrossel": ["carousel", "carrossel"],
          "newsletter": ["newsletter", "email"],
          "email": ["newsletter", "email"],
          "reels": ["reels", "short_video"],
          "thread": ["thread"],
          "linkedin": ["linkedin"],
          "tweet": ["tweet"],
          "blog": ["blog", "blog_post"],
          "article": ["article", "artigo"],
          "video": ["video", "long_video", "youtube"]
        };
        
        const matchingTypes = contentTypeMap[contentType.toLowerCase()] || [contentType];
        
        const { data: examples } = await supabase
          .from("client_content_library")
          .select("id, title, content_type, content")
          .eq("client_id", clientId)
          .in("content_type", matchingTypes)
          .order("created_at", { ascending: false })
          .limit(3);
        
        structureExamples = examples || [];
        console.log(`[MULTI-AGENT] Found ${structureExamples.length} structure examples`);
      }
    }

    // Use pipeline received or fallback to default (now includes Layout Agent)
    const agents: PipelineAgent[] = pipeline?.agents || [
      {
        id: "researcher",
        name: "Pesquisador",
        description: "Analisa materiais e busca técnicas na Base de Conhecimento",
        model: "flash",
        systemPrompt: "Você é um pesquisador especializado. Analise a Base de Conhecimento para identificar técnicas e melhores práticas. Sintetize as informações mais relevantes para criar o conteúdo solicitado."
      },
      {
        id: "writer",
        name: "Escritor",
        description: "Cria o primeiro rascunho aplicando as técnicas",
        model: "pro",
        systemPrompt: "Você é um escritor especializado. Aplique as técnicas identificadas pelo Pesquisador para criar conteúdo de alta qualidade. Siga as melhores práticas da Base de Conhecimento, sem usar números fixos ou estruturas rígidas."
      },
      {
        id: "editor",
        name: "Editor de Estilo",
        description: "Ajusta o estilo para soar como o cliente",
        model: "pro",
        systemPrompt: "Você é um editor de estilo. Seu trabalho é fazer o conteúdo soar EXATAMENTE como o cliente escreve. Use os exemplos da Biblioteca de Conteúdo como referência absoluta de tom e estilo."
      },
      {
        id: "reviewer",
        name: "Revisor Final",
        description: "Validação e polish final",
        model: "flash",
        systemPrompt: "Você é um revisor final. Verifique se o conteúdo segue as melhores práticas da Base de Conhecimento e está alinhado com o guia de identidade do cliente. Retorne apenas o conteúdo final pronto para publicação."
      },
      {
        id: "layout",
        name: "Diretor de Arte",
        description: "Cria guia visual e prompts de imagem",
        model: "flash",
        systemPrompt: "Você é um Diretor de Arte especializado em conteúdo digital. Analise o conteúdo finalizado e crie um guia de layout completo com hierarquia visual, tipografia, cores e prompts detalhados para geração de imagens por IA. Responda em formato JSON estruturado."
      }
    ];

    // Process metadata for transparency
    const processMetadata: ProcessMetadata = {
      knowledgeUsed: knowledgeBase.map(k => ({ id: k.id, title: k.title, category: k.category })),
      structureExamples: structureExamples.map(e => ({ id: e.id, title: e.title, contentType: e.content_type })),
      agentSteps: [],
      totalTokens: { input: 0, output: 0 },
      totalCost: 0,
      layoutGuide: undefined,
      strategicInsights: []
    };

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
          tokens?: { input: number; output: number; cost: number },
          metadata?: ProcessMetadata
        ) => {
          const data = JSON.stringify({ step, status, content, agentName, tokens, metadata });
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
            contentType: contentType || "geral",
            knowledgeBase,
            structureExamples
          };

          // Send initial metadata about knowledge and examples
          sendProgress("init", "starting", 
            `Usando ${knowledgeBase.length} docs da Base de Conhecimento e ${structureExamples.length} exemplos de referência`,
            undefined, undefined, processMetadata);

          // Execute each agent and LOG INDIVIDUALLY
          for (let i = 0; i < agents.length; i++) {
            const agent = agents[i];
            const isLast = i === agents.length - 1;

            sendProgress(agent.id, "running", `${agent.description || agent.name}...`, agent.name);

            try {
              const result = await executeAgent(agent, context);
              
              context.previousOutputs[agent.id] = result.content;

              // Parse layout guide from layout agent
              if (agent.id === "layout") {
                try {
                  // Try to extract JSON from the response
                  const jsonMatch = result.content.match(/```json\s*([\s\S]*?)```/);
                  const jsonStr = jsonMatch ? jsonMatch[1] : result.content;
                  const layoutData = JSON.parse(jsonStr.trim());
                  processMetadata.layoutGuide = layoutData;
                  console.log(`[LAYOUT-AGENT] Parsed layout guide with ${layoutData.slides?.length || 0} slides`);
                } catch (parseError) {
                  console.error("[LAYOUT-AGENT] Failed to parse layout JSON:", parseError);
                }
              }

              // Calculate cost for this agent
              const agentCost = calculateCost(agent.model, result.inputTokens, result.outputTokens);
              
              // Update cumulative totals
              totalInputTokens += result.inputTokens;
              totalOutputTokens += result.outputTokens;
              totalCost += agentCost;

              // Add to agent steps
              processMetadata.agentSteps.push({
                agentId: agent.id,
                agentName: agent.name,
                inputTokens: result.inputTokens,
                outputTokens: result.outputTokens,
                durationMs: 0 // Could add timing if needed
              });

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
                
                // Update final metadata
                processMetadata.totalTokens = { input: totalInputTokens, output: totalOutputTokens };
                processMetadata.totalCost = totalCost;
                
                // Get the reviewer's content as final (not layout's JSON)
                const finalContent = context.previousOutputs["reviewer"] || result.content;
                
                // Send final result with cumulative tokens AND metadata
                sendProgress("complete", "done", finalContent, undefined, {
                  input: totalInputTokens,
                  output: totalOutputTokens,
                  cost: totalCost
                }, processMetadata);
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
