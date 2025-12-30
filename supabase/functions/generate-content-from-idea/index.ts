import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logAIUsage } from "../_shared/ai-usage.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Agentes do pipeline de conteúdo
const CONTENT_AGENTS = {
  writer: {
    id: "writer",
    name: "Escritor de Conteúdo",
    model: "gemini-2.5-pro",
    description: "Cria o primeiro rascunho completo",
  },
  style_editor: {
    id: "style_editor",
    name: "Editor de Estilo",
    model: "gemini-2.5-pro",
    description: "Ajusta para base de conhecimento de copywriting",
  },
  consistency_editor: {
    id: "consistency_editor",
    name: "Editor de Consistência",
    model: "gemini-2.5-flash",
    description: "Garante consistência com biblioteca existente",
  },
  final_reviewer: {
    id: "final_reviewer",
    name: "Revisor Final",
    model: "gemini-2.5-flash",
    description: "Revisão final e polish",
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
          temperature: 0.7,
          maxOutputTokens: 8192,
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
      globalKnowledge = [],
      idea,
      userId,
    } = await req.json();

    console.log(`[CONTENT-PIPELINE] Generating content for idea: ${idea.title}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendProgress = (step: string, agentName?: string | null, content?: string | null, error?: string) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ step, agentName, content, error })}\n\n`));
        };

        try {
          // ===========================================
          // AGENTE 1: Escritor (cria rascunho)
          // ===========================================
          sendProgress("writer", CONTENT_AGENTS.writer.name);

          // Buscar exemplos do mesmo formato
          const sameFormatExamples = contentLibrary
            .filter((c: any) => c.content_type === contentFormat)
            .slice(0, 5);

          const writerPrompt = `Crie um ${contentFormat} completo para ${clientName} baseado nesta ideia:

## IDEIA:
**Título:** ${idea.title}
**Conceito:** ${idea.description}
${idea.inspiration ? `**Inspiração:** ${idea.inspiration}` : ''}

## IDENTIDADE DO CLIENTE:
${identityGuide?.substring(0, 1500) || 'Não disponível - use tom profissional e acessível'}

## EXEMPLOS DE ${contentFormat.toUpperCase()} DO CLIENTE:
${sameFormatExamples.length > 0 
  ? sameFormatExamples.map((e: any, i: number) => `
### Exemplo ${i + 1}: ${e.title}
${e.content}
`).join('\n---\n')
  : 'Sem exemplos disponíveis'}

## INSTRUÇÕES:
1. O conteúdo deve seguir a estrutura típica de ${contentFormat}
2. Use o tom de voz do cliente (baseado nos exemplos)
3. Seja criativo mas mantenha a essência da ideia
4. Inclua elementos como ganchos, CTAs conforme o formato

Escreva o conteúdo completo agora:`;

          const writerResult = await callGemini(
            `Você é um copywriter sênior especializado em ${contentFormat}. Crie conteúdos envolventes e profissionais.`,
            writerPrompt,
            CONTENT_AGENTS.writer.model
          );

          let currentDraft = writerResult.content;

          if (userId) {
            await logAIUsage(supabase, userId, CONTENT_AGENTS.writer.model, "generate-content-from-idea/writer",
              writerResult.inputTokens, writerResult.outputTokens, { clientId, ideaTitle: idea.title });
          }

          // ===========================================
          // AGENTE 2: Editor de Estilo (base de conhecimento)
          // ===========================================
          sendProgress("style_editor", CONTENT_AGENTS.style_editor.name);

          // Buscar conhecimento de copywriting
          const copywritingKnowledge = globalKnowledge.filter((k: any) => 
            k.category === 'copywriting' || 
            k.title?.toLowerCase().includes('copy') ||
            k.title?.toLowerCase().includes('escrita')
          ).slice(0, 3);

          const stylePrompt = `Revise este conteúdo aplicando as melhores práticas de copywriting:

## RASCUNHO ATUAL:
${currentDraft}

## BASE DE CONHECIMENTO DE COPYWRITING:
${copywritingKnowledge.length > 0 
  ? copywritingKnowledge.map((k: any) => `### ${k.title}\n${k.content?.substring(0, 800) || ''}`).join('\n\n')
  : `
Aplique estas práticas:
- Ganchos fortes no início
- Parágrafos curtos e escaneáveis
- Linguagem clara e direta
- CTAs convincentes
- Storytelling quando apropriado
`}

## TAREFA:
Reescreva o conteúdo aplicando as técnicas de copywriting.
Mantenha a essência mas melhore a escrita profissionalmente.`;

          const styleResult = await callGemini(
            "Você é um especialista em copywriting e persuasão. Aplique técnicas avançadas de escrita.",
            stylePrompt,
            CONTENT_AGENTS.style_editor.model
          );

          currentDraft = styleResult.content;

          if (userId) {
            await logAIUsage(supabase, userId, CONTENT_AGENTS.style_editor.model, "generate-content-from-idea/style_editor",
              styleResult.inputTokens, styleResult.outputTokens, { clientId, ideaTitle: idea.title });
          }

          // ===========================================
          // AGENTE 3: Editor de Consistência (biblioteca)
          // ===========================================
          sendProgress("consistency_editor", CONTENT_AGENTS.consistency_editor.name);

          // Pegar mais exemplos para consistência
          const consistencyExamples = contentLibrary.slice(0, 8);

          const consistencyPrompt = `Compare este conteúdo com a biblioteca do cliente e ajuste para manter consistência:

## CONTEÚDO ATUAL:
${currentDraft}

## BIBLIOTECA DO CLIENTE (exemplos de linguagem):
${consistencyExamples.map((c: any, i: number) => `
[${i + 1}] ${c.title} (${c.content_type}):
"${c.content?.substring(0, 300)}..."
`).join('\n')}

## TAREFA:
1. Identifique padrões de linguagem na biblioteca
2. Ajuste o conteúdo para soar como foi escrito pelo mesmo autor
3. Mantenha expressões, termos e estilo característicos do cliente
4. NÃO mude o conteúdo, apenas refine o estilo de escrita

Retorne o conteúdo ajustado:`;

          const consistencyResult = await callGemini(
            "Você é um editor que garante consistência de voz e tom em todos os conteúdos de uma marca.",
            consistencyPrompt,
            CONTENT_AGENTS.consistency_editor.model
          );

          currentDraft = consistencyResult.content;

          if (userId) {
            await logAIUsage(supabase, userId, CONTENT_AGENTS.consistency_editor.model, "generate-content-from-idea/consistency",
              consistencyResult.inputTokens, consistencyResult.outputTokens, { clientId, ideaTitle: idea.title });
          }

          // ===========================================
          // AGENTE 4: Revisor Final
          // ===========================================
          sendProgress("final_reviewer", CONTENT_AGENTS.final_reviewer.name);

          const reviewPrompt = `Faça a revisão final deste ${contentFormat}:

## CONTEÚDO:
${currentDraft}

## CHECKLIST DE REVISÃO:
1. ✓ Erros de gramática e ortografia
2. ✓ Fluidez e legibilidade
3. ✓ Impacto do gancho inicial
4. ✓ Clareza da mensagem principal
5. ✓ Força do CTA (se houver)
6. ✓ Adequação ao formato ${contentFormat}

## TAREFA:
- Faça ajustes finais necessários
- Polish o texto para publicação
- Retorne APENAS o conteúdo final pronto

Conteúdo final:`;

          const reviewResult = await callGemini(
            "Você é um revisor meticuloso que garante que cada conteúdo esteja impecável para publicação.",
            reviewPrompt,
            CONTENT_AGENTS.final_reviewer.model
          );

          const finalContent = reviewResult.content;

          if (userId) {
            await logAIUsage(supabase, userId, CONTENT_AGENTS.final_reviewer.model, "generate-content-from-idea/reviewer",
              reviewResult.inputTokens, reviewResult.outputTokens, { clientId, ideaTitle: idea.title });
          }

          // Send final content
          sendProgress("complete", null, finalContent);
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();

        } catch (error: any) {
          console.error("[CONTENT-PIPELINE] Error:", error);
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
    console.error("[CONTENT-PIPELINE] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
