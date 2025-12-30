import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logAIUsage } from "../_shared/ai-usage.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Agentes do pipeline de ideias
const IDEA_AGENTS = {
  analyzer: {
    id: "analyzer",
    name: "Analisador de Cliente",
    model: "gemini-2.5-flash",
    description: "Analisa o cliente, posts e identifica padrões",
  },
  competitor_reader: {
    id: "competitor_reader", 
    name: "Leitor de Concorrentes",
    model: "gemini-2.5-flash",
    description: "Lê posts de referência/concorrentes do mesmo formato",
  },
  idealizer: {
    id: "idealizer",
    name: "Gerador de Ideias",
    model: "gemini-2.5-pro",
    description: "Gera ideias criativas e únicas",
  },
  validator: {
    id: "validator",
    name: "Validador",
    model: "gemini-2.5-flash",
    description: "Valida e refina as ideias",
  },
};

async function callGemini(
  systemPrompt: string,
  userPrompt: string,
  model: string = "gemini-2.5-flash"
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const GOOGLE_API_KEY = Deno.env.get("GOOGLE_AI_STUDIO_API_KEY");
  if (!GOOGLE_API_KEY) throw new Error("GOOGLE_AI_STUDIO_API_KEY não configurada");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GOOGLE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
          temperature: 0.9,
          maxOutputTokens: 4096,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Gemini error: ${response.status}`, errorText);
    throw new Error(`Gemini error: ${response.status}`);
  }

  const data = await response.json();
  return {
    content: data.candidates?.[0]?.content?.parts?.[0]?.text || "",
    inputTokens: data.usageMetadata?.promptTokenCount || 0,
    outputTokens: data.usageMetadata?.candidatesTokenCount || 0,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const {
      clientId,
      clientName,
      contentFormat,
      identityGuide,
      contentLibrary = [],
      referenceLibrary = [],
      userRequest,
      ideaCount = 3,
      userId,
    } = await req.json();

    console.log(`[IDEAS-PIPELINE] Starting for ${clientName}, format: ${contentFormat}, count: ${ideaCount}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendProgress = (step: string, agentName?: string | null, ideas?: any[] | null, error?: string) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ step, agentName, ideas, error })}\n\n`));
        };

        try {
          // ===========================================
          // AGENTE 1: Analisador de Cliente
          // ===========================================
          sendProgress("analyzing_client", IDEA_AGENTS.analyzer.name);

          // Filtrar posts do mesmo formato que foi pedido
          const sameFormatPosts = contentLibrary.filter((c: any) => 
            c.content_type === contentFormat || 
            c.content_type?.toLowerCase().includes(contentFormat.toLowerCase())
          );

          // Preparar contexto do cliente
          const clientContext = `
## CLIENTE: ${clientName}

${identityGuide ? `## GUIA DE IDENTIDADE:\n${identityGuide.substring(0, 2000)}` : ''}

## POSTS DO CLIENTE (formato: ${contentFormat}) - ${sameFormatPosts.length} encontrados:
${sameFormatPosts.slice(0, 10).map((p: any, i: number) => 
  `### Post ${i + 1}: ${p.title || 'Sem título'}\n${p.content?.substring(0, 400) || ''}`
).join('\n\n---\n\n')}
`;

          const analyzerPrompt = `Analise o cliente ${clientName} e seus posts para entender:

1. **Temas principais** que o cliente aborda
2. **Tom de voz** característico
3. **Estrutura típica** dos conteúdos
4. **Elementos recorrentes** (emojis, CTAs, etc.)
5. **Pontos diferenciadores** do cliente

Contexto:
${clientContext}

Forneça uma análise concisa em até 300 palavras.`;

          const analysisResult = await callGemini(
            "Você é um analista de conteúdo especializado em identificar padrões e características de marcas.",
            analyzerPrompt,
            IDEA_AGENTS.analyzer.model
          );

          if (userId) {
            await logAIUsage(supabase, userId, IDEA_AGENTS.analyzer.model, "generate-ideas-pipeline/analyzer", 
              analysisResult.inputTokens, analysisResult.outputTokens, { clientId, step: "analyzer" });
          }

          // ===========================================
          // AGENTE 2: Leitor de Concorrentes/Referências
          // ===========================================
          sendProgress("reading_competitors", IDEA_AGENTS.competitor_reader.name);

          // Buscar referências do mesmo formato
          const sameFormatReferences = referenceLibrary.filter((r: any) =>
            r.reference_type === contentFormat ||
            r.reference_type?.toLowerCase().includes(contentFormat.toLowerCase()) ||
            r.content?.toLowerCase().includes(contentFormat.toLowerCase())
          );

          // Selecionar 3 referências para ler completamente
          const selectedReferences = sameFormatReferences.slice(0, 3);

          let competitorInsights = "";
          if (selectedReferences.length > 0) {
            const referencesContext = selectedReferences.map((r: any, i: number) => 
              `### Referência ${i + 1}: ${r.title}\nTipo: ${r.reference_type}\n${r.content || ''}`
            ).join('\n\n---\n\n');

            const competitorPrompt = `Analise estas referências/posts de concorrentes e extraia:

1. **Abordagens criativas** que funcionam bem
2. **Estruturas inovadoras** usadas
3. **Ganchos e CTAs** efetivos
4. **O que diferencia** cada um

Referências:
${referencesContext}

Liste insights acionáveis para inspirar novas ideias.`;

            const competitorResult = await callGemini(
              "Você é um especialista em análise competitiva de conteúdo digital.",
              competitorPrompt,
              IDEA_AGENTS.competitor_reader.model
            );

            competitorInsights = competitorResult.content;

            if (userId) {
              await logAIUsage(supabase, userId, IDEA_AGENTS.competitor_reader.model, "generate-ideas-pipeline/competitor", 
                competitorResult.inputTokens, competitorResult.outputTokens, { clientId, step: "competitor_reader" });
            }
          }

          // ===========================================
          // AGENTE 3: Gerador de Ideias (PRO para criatividade)
          // ===========================================
          sendProgress("generating_ideas", IDEA_AGENTS.idealizer.name);

          const idealizerPrompt = `Você deve gerar EXATAMENTE ${ideaCount} ideias criativas de ${contentFormat} para ${clientName}.

## ANÁLISE DO CLIENTE:
${analysisResult.content}

## INSIGHTS DE CONCORRENTES:
${competitorInsights || "Sem referências de concorrentes disponíveis"}

## PEDIDO DO USUÁRIO:
"${userRequest}"

## REGRAS CRÍTICAS:
1. Cada ideia deve ser ÚNICA e DIFERENTE das outras
2. NÃO repita temas que já existem nos posts do cliente
3. Use ângulos INOVADORES e CRIATIVOS
4. Ideias devem ser sobre os MESMOS TEMAS que o cliente aborda, mas com perspectivas novas
5. Cada ideia deve ter título + descrição + fonte de inspiração

## FORMATO DE RESPOSTA (JSON):
\`\`\`json
{
  "ideas": [
    {
      "title": "Título curto e impactante (máx 10 palavras)",
      "description": "Descrição do conceito em 2-3 frases",
      "inspiration": "De onde veio a inspiração (referência, insight, etc)"
    }
  ]
}
\`\`\`

Gere ${ideaCount} ideias no formato JSON acima.`;

          const ideaResult = await callGemini(
            `Você é um diretor criativo premiado especializado em ${contentFormat}. Sua missão é criar ideias únicas e memoráveis.`,
            idealizerPrompt,
            IDEA_AGENTS.idealizer.model
          );

          if (userId) {
            await logAIUsage(supabase, userId, IDEA_AGENTS.idealizer.model, "generate-ideas-pipeline/idealizer", 
              ideaResult.inputTokens, ideaResult.outputTokens, { clientId, step: "idealizer" });
          }

          // Parse ideas from JSON
          let rawIdeas: any[] = [];
          try {
            const jsonMatch = ideaResult.content.match(/```json\s*([\s\S]*?)\s*```/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[1]);
              rawIdeas = parsed.ideas || [];
            } else {
              // Try parsing directly
              const parsed = JSON.parse(ideaResult.content);
              rawIdeas = parsed.ideas || [];
            }
          } catch (e) {
            console.error("Failed to parse ideas JSON, falling back to text parsing");
            // Fallback: parse from text
            const ideaMatches = ideaResult.content.match(/\*\*Ideia \d+:?\s*([^*]+)\*\*\s*([^*]+)/gi) || [];
            rawIdeas = ideaMatches.map((match, idx) => ({
              title: `Ideia ${idx + 1}`,
              description: match.replace(/\*\*/g, '').trim(),
              inspiration: "Análise criativa"
            }));
          }

          // ===========================================
          // AGENTE 4: Validador
          // ===========================================
          sendProgress("validating_ideas", IDEA_AGENTS.validator.name);

          const validatorPrompt = `Revise estas ${rawIdeas.length} ideias para ${clientName}:

${rawIdeas.map((idea, i) => `
## Ideia ${i + 1}: ${idea.title}
${idea.description}
Inspiração: ${idea.inspiration || 'N/A'}
`).join('\n')}

## CRITÉRIOS DE VALIDAÇÃO:
1. A ideia é REALMENTE nova e não repete posts existentes?
2. A ideia está alinhada com a identidade do cliente?
3. O título é claro e atrativo?
4. A descrição é suficiente para desenvolver o conteúdo?

## TAREFA:
Retorne as ideias validadas (ou ligeiramente refinadas) no mesmo formato JSON:
\`\`\`json
{
  "ideas": [
    {
      "title": "...",
      "description": "...",
      "inspiration": "..."
    }
  ]
}
\`\`\``;

          const validatorResult = await callGemini(
            "Você é um editor sênior que garante qualidade e relevância de ideias de conteúdo.",
            validatorPrompt,
            IDEA_AGENTS.validator.model
          );

          if (userId) {
            await logAIUsage(supabase, userId, IDEA_AGENTS.validator.model, "generate-ideas-pipeline/validator", 
              validatorResult.inputTokens, validatorResult.outputTokens, { clientId, step: "validator" });
          }

          // Parse validated ideas
          let validatedIdeas: any[] = rawIdeas;
          try {
            const jsonMatch = validatorResult.content.match(/```json\s*([\s\S]*?)\s*```/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[1]);
              validatedIdeas = parsed.ideas || rawIdeas;
            }
          } catch (e) {
            console.log("Using raw ideas as validated ideas");
          }

          // Send final ideas
          sendProgress("ideas_ready", null, validatedIdeas);
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();

        } catch (error: any) {
          console.error("[IDEAS-PIPELINE] Error:", error);
          sendProgress("error", null, null, error.message);
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
    console.error("[IDEAS-PIPELINE] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
