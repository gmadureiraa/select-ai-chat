import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logAIUsage } from "../_shared/ai-usage.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Specialized agent types
type SpecializedAgentType = 
  | "content_writer"
  | "design_agent"
  | "metrics_analyst"
  | "email_developer"
  | "researcher"
  | "strategist";

interface ExecutionPlanStep {
  id: string;
  agentType: SpecializedAgentType;
  name: string;
  description: string;
  dependencies: string[];
  expectedOutput: string;
  tools: string[];
}

interface OrchestratorDecision {
  shouldUseOrchestrator: boolean;
  complexity: "simple" | "medium" | "complex";
  selectedAgents: SpecializedAgentType[];
  executionPlan: ExecutionPlanStep[];
  reasoning: string;
  estimatedDuration: number;
}

// Tool definition for structured output
const orchestratorTool = {
  type: "function",
  function: {
    name: "create_execution_plan",
    description: "Analisa o pedido do usuário e cria um plano de execução com agentes especializados",
    parameters: {
      type: "object",
      properties: {
        shouldUseOrchestrator: {
          type: "boolean",
          description: "Se true, indica que o pedido requer múltiplos agentes ou é complexo"
        },
        complexity: {
          type: "string",
          enum: ["simple", "medium", "complex"],
          description: "Nível de complexidade do pedido"
        },
        selectedAgents: {
          type: "array",
          items: {
            type: "string",
            enum: ["content_writer", "design_agent", "metrics_analyst", "email_developer", "researcher", "strategist"]
          },
          description: "Lista de agentes necessários para completar o pedido"
        },
        executionPlan: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "ID único do passo" },
              agentType: { 
                type: "string", 
                enum: ["content_writer", "design_agent", "metrics_analyst", "email_developer", "researcher", "strategist"]
              },
              name: { type: "string", description: "Nome curto do passo" },
              description: { type: "string", description: "O que será feito neste passo" },
              dependencies: { 
                type: "array", 
                items: { type: "string" },
                description: "IDs dos passos que devem ser concluídos antes"
              },
              expectedOutput: { type: "string", description: "O que esperar como resultado" },
              tools: { 
                type: "array", 
                items: { type: "string" },
                description: "Ferramentas que o agente usará"
              }
            },
            required: ["id", "agentType", "name", "description", "dependencies", "expectedOutput", "tools"]
          }
        },
        reasoning: {
          type: "string",
          description: "Explicação breve do porquê essa abordagem foi escolhida"
        },
        estimatedDuration: {
          type: "number",
          description: "Tempo estimado em segundos"
        }
      },
      required: ["shouldUseOrchestrator", "complexity", "selectedAgents", "executionPlan", "reasoning", "estimatedDuration"]
    }
  }
};

async function callGemini(
  systemPrompt: string,
  userPrompt: string,
  tools?: any[]
): Promise<{ content: any; inputTokens: number; outputTokens: number }> {
  const GOOGLE_API_KEY = Deno.env.get("GOOGLE_AI_STUDIO_API_KEY");
  if (!GOOGLE_API_KEY) throw new Error("GOOGLE_AI_STUDIO_API_KEY não configurada");

  const requestBody: any = {
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 4096,
    }
  };

  if (tools) {
    requestBody.tools = [{
      functionDeclarations: tools.map(t => ({
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters
      }))
    }];
    requestBody.toolConfig = {
      functionCallingConfig: {
        mode: "ANY",
        allowedFunctionNames: tools.map(t => t.function.name)
      }
    };
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[ORCHESTRATOR] Gemini error:", errorText);
    throw new Error(`Gemini error: ${response.status}`);
  }

  const data = await response.json();
  const functionCall = data.candidates?.[0]?.content?.parts?.[0]?.functionCall;
  const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
  
  return {
    content: functionCall?.args || textContent || "",
    inputTokens: data.usageMetadata?.promptTokenCount || 0,
    outputTokens: data.usageMetadata?.candidatesTokenCount || 0
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { 
      userMessage,
      clientContext,
      availableData,
      userId,
      clientId 
    } = await req.json();

    console.log("[ORCHESTRATOR] Analyzing request:", userMessage?.substring(0, 100));

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const systemPrompt = `Você é o Orquestrador kAI, responsável por analisar pedidos de usuários e decidir a melhor estratégia de execução.

## AGENTES DISPONÍVEIS:

1. **content_writer** - Escritor de Conteúdo
   - Cria posts, newsletters, artigos, copy, legendas
   - Usa: biblioteca de conteúdo, guia de identidade, guia de copywriting

2. **design_agent** - Designer Visual
   - Gera imagens com IA usando brand assets
   - Usa: brand assets, referências visuais, análise de estilo

3. **metrics_analyst** - Analista de Métricas
   - Analisa dados de performance e gera insights
   - Usa: métricas de plataformas, metas de performance, histórico

4. **email_developer** - Desenvolvedor de Email
   - Cria templates HTML responsivos para email
   - Usa: brand assets, templates existentes

5. **researcher** - Pesquisador
   - Pesquisa mercado, tendências e referências
   - Usa: biblioteca de referências, knowledge base global

6. **strategist** - Estrategista
   - Planeja campanhas e estratégias de conteúdo
   - Usa: todos os dados disponíveis

## DADOS DISPONÍVEIS DO CLIENTE:
${JSON.stringify(availableData, null, 2)}

## CONTEXTO DO CLIENTE:
${clientContext || "Não disponível"}

## REGRAS DE DECISÃO:

1. **SIMPLE** (1 agente, < 30s):
   - Pedidos diretos: "crie um post sobre X"
   - Perguntas simples: "qual foi o melhor post?"
   - Use apenas 1 agente

2. **MEDIUM** (1-2 agentes, 30-60s):
   - Pedidos com contexto: "crie um post baseado nos dados de performance"
   - Combina 2 capacidades: texto + imagem
   - Use 1-2 agentes em sequência

3. **COMPLEX** (2+ agentes, > 60s):
   - Campanhas completas
   - Estratégias que requerem pesquisa + criação + análise
   - Use múltiplos agentes com dependências

## IMPORTANTE:
- Se o pedido é simples (ex: "crie um tweet"), use shouldUseOrchestrator: false
- O orquestrador só deve ser ativado para pedidos que genuinamente precisam de múltiplos agentes
- Priorize eficiência: menos agentes = mais rápido

ANALISE o pedido e use a função create_execution_plan para retornar sua decisão.`;

    const result = await callGemini(
      systemPrompt,
      `Pedido do usuário: "${userMessage}"`,
      [orchestratorTool]
    );

    // Log usage
    if (userId) {
      await logAIUsage(
        supabase,
        userId,
        "gemini-2.5-flash",
        "orchestrator",
        result.inputTokens,
        result.outputTokens,
        { clientId }
      );
    }

    const decision = result.content as OrchestratorDecision;
    console.log("[ORCHESTRATOR] Decision:", JSON.stringify(decision, null, 2));

    return new Response(JSON.stringify(decision), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[ORCHESTRATOR] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
