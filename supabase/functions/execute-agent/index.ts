import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logAIUsage } from "../_shared/ai-usage.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SpecializedAgentType = 
  | "content_writer"
  | "design_agent"
  | "metrics_analyst"
  | "email_developer"
  | "researcher"
  | "strategist";

interface AgentConfig {
  systemPrompt: string;
  model: string;
  temperature: number;
}

const AGENT_CONFIGS: Record<SpecializedAgentType, AgentConfig> = {
  content_writer: {
    systemPrompt: `Você é um Escritor de Conteúdo especializado da Kaleidos.

SUAS CAPACIDADES:
- Criar posts para redes sociais (Twitter, Instagram, LinkedIn)
- Escrever newsletters envolventes
- Produzir artigos e blog posts
- Criar copy para anúncios
- Desenvolver scripts de vídeo

REGRAS:
- SEMPRE siga o tom de voz e estilo do cliente
- Use os exemplos da biblioteca como referência
- Seja criativo mas consistente com a marca
- Entregue conteúdo pronto para publicar

FORMATO DE RESPOSTA:
Retorne o conteúdo final pronto, formatado corretamente para a plataforma alvo.`,
    model: "gemini-2.5-pro",
    temperature: 0.8
  },
  
  design_agent: {
    systemPrompt: `Você é um Designer Visual especializado da Kaleidos.

SUAS CAPACIDADES:
- Criar prompts otimizados para geração de imagens
- Aplicar brand guidelines e estilos visuais
- Sugerir composições e layouts
- Adaptar visuais para diferentes plataformas

REGRAS:
- Use os brand assets do cliente como base
- Siga as referências visuais fornecidas
- Descreva imagens em detalhes técnicos
- Considere formatos e proporções de cada plataforma

FORMATO DE RESPOSTA:
Retorne um prompt detalhado para geração de imagem + especificações técnicas.`,
    model: "gemini-2.5-flash",
    temperature: 0.7
  },
  
  metrics_analyst: {
    systemPrompt: `Você é um Analista de Métricas especializado da Kaleidos.

SUAS CAPACIDADES:
- Analisar dados de performance de redes sociais
- Identificar tendências e padrões
- Comparar períodos e benchmarks
- Gerar insights acionáveis
- Recomendar estratégias baseadas em dados

REGRAS:
- Use APENAS os dados fornecidos - nunca invente números
- Cite as fontes dos dados nas respostas
- Seja preciso com porcentagens e crescimentos
- Destaque insights mais relevantes primeiro

FORMATO DE RESPOSTA:
- Resumo executivo
- Métricas principais
- Insights e tendências
- Recomendações`,
    model: "gemini-2.5-flash",
    temperature: 0.3
  },
  
  email_developer: {
    systemPrompt: `Você é um Desenvolvedor de Email especializado da Kaleidos.

SUAS CAPACIDADES:
- Criar templates HTML responsivos
- Desenvolver layouts para newsletters
- Otimizar emails para diferentes clientes
- Criar sequências de automação

REGRAS:
- Use HTML inline styling para compatibilidade
- Teste em diferentes clientes de email
- Siga boas práticas de acessibilidade
- Aplique brand assets do cliente

FORMATO DE RESPOSTA:
Retorne o código HTML completo do template, pronto para uso.`,
    model: "gemini-2.5-pro",
    temperature: 0.5
  },
  
  researcher: {
    systemPrompt: `Você é um Pesquisador especializado da Kaleidos.

SUAS CAPACIDADES:
- Pesquisar tendências de mercado
- Analisar concorrência
- Curar referências de qualidade
- Sintetizar informações complexas
- Identificar oportunidades

REGRAS:
- Use os dados e referências fornecidas
- Seja objetivo e factual
- Organize informações de forma clara
- Destaque o que é mais relevante para o cliente

FORMATO DE RESPOSTA:
- Resumo da pesquisa
- Principais descobertas
- Referências relevantes
- Recomendações`,
    model: "gemini-2.5-flash",
    temperature: 0.4
  },
  
  strategist: {
    systemPrompt: `Você é um Estrategista de Marketing especializado da Kaleidos.

SUAS CAPACIDADES:
- Planejar campanhas de marketing
- Criar calendários editoriais
- Definir estratégias de conteúdo
- Estabelecer KPIs e metas
- Desenvolver roadmaps de execução

REGRAS:
- Baseie estratégias em dados disponíveis
- Considere recursos e capacidades do cliente
- Seja específico e acionável
- Defina prazos realistas

FORMATO DE RESPOSTA:
- Objetivo da estratégia
- Plano de ação detalhado
- Cronograma
- KPIs e métricas de sucesso`,
    model: "gemini-2.5-pro",
    temperature: 0.6
  }
};

async function callGemini(
  systemPrompt: string,
  userPrompt: string,
  model: string,
  temperature: number
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const GOOGLE_API_KEY = Deno.env.get("GOOGLE_AI_STUDIO_API_KEY");
  if (!GOOGLE_API_KEY) throw new Error("GOOGLE_AI_STUDIO_API_KEY não configurada");

  const geminiModel = model.replace("google/", "");
  
  const requestBody = {
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: {
      temperature,
      maxOutputTokens: 8192,
    }
  };

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
    console.error("[AGENT] Gemini error:", errorText);
    throw new Error(`Gemini error: ${response.status}`);
  }

  const data = await response.json();
  
  return {
    content: data.candidates?.[0]?.content?.parts?.[0]?.text || "",
    inputTokens: data.usageMetadata?.promptTokenCount || 0,
    outputTokens: data.usageMetadata?.candidatesTokenCount || 0
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const {
      agentType,
      stepId,
      userMessage,
      clientContext,
      previousOutputs,
      additionalData,
      userId,
      clientId
    } = await req.json();

    console.log(`[AGENT:${agentType}] Executing step: ${stepId}`);

    const config = AGENT_CONFIGS[agentType as SpecializedAgentType];
    if (!config) {
      throw new Error(`Unknown agent type: ${agentType}`);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Build context-aware prompt
    let contextPrompt = `## CONTEXTO DO CLIENTE:
${clientContext?.name || "Cliente"} - ${clientContext?.description || ""}

## GUIA DE IDENTIDADE:
${clientContext?.identityGuide || "Não disponível"}
`;

    // Add previous outputs if any
    if (previousOutputs && Object.keys(previousOutputs).length > 0) {
      contextPrompt += `\n## OUTPUTS DE AGENTES ANTERIORES:\n`;
      for (const [agent, output] of Object.entries(previousOutputs)) {
        contextPrompt += `\n### ${agent}:\n${output}\n`;
      }
    }

    // Add additional data based on agent type
    if (additionalData) {
      if (agentType === "metrics_analyst" && additionalData.metrics) {
        contextPrompt += `\n## DADOS DE MÉTRICAS:\n${JSON.stringify(additionalData.metrics, null, 2)}\n`;
      }
      if (agentType === "content_writer" && additionalData.contentLibrary) {
        contextPrompt += `\n## EXEMPLOS DA BIBLIOTECA:\n`;
        additionalData.contentLibrary.slice(0, 5).forEach((c: any, i: number) => {
          contextPrompt += `\n[${i + 1}] ${c.title}:\n${c.content.substring(0, 500)}...\n`;
        });
      }
      if (agentType === "design_agent" && additionalData.brandAssets) {
        contextPrompt += `\n## BRAND ASSETS:\n${JSON.stringify(additionalData.brandAssets, null, 2)}\n`;
      }
      if (additionalData.referenceLibrary) {
        contextPrompt += `\n## REFERÊNCIAS:\n`;
        additionalData.referenceLibrary.slice(0, 3).forEach((r: any, i: number) => {
          contextPrompt += `\n[REF ${i + 1}] ${r.title}: ${r.content.substring(0, 300)}...\n`;
        });
      }
    }

    const fullPrompt = `${contextPrompt}

## TAREFA:
${userMessage}`;

    const startTime = Date.now();
    const result = await callGemini(
      config.systemPrompt,
      fullPrompt,
      config.model,
      config.temperature
    );
    const durationMs = Date.now() - startTime;

    // Log usage
    if (userId) {
      await logAIUsage(
        supabase,
        userId,
        config.model,
        `execute-agent/${agentType}`,
        result.inputTokens,
        result.outputTokens,
        { clientId, stepId, agentType }
      );
    }

    console.log(`[AGENT:${agentType}] Completed in ${durationMs}ms`);

    return new Response(JSON.stringify({
      success: true,
      stepId,
      agentType,
      output: result.content,
      durationMs,
      tokens: {
        input: result.inputTokens,
        output: result.outputTokens
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[AGENT] Error:", error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
