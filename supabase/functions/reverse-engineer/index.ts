import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Pricing por 1M tokens (USD) - Preços oficiais do Google AI Studio
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "gemini-2.0-flash-exp": { input: 0.00, output: 0.00 }, // Free tier
  "gemini-2.5-flash": { input: 0.075, output: 0.30 },
  "gemini-2.5-flash-8b": { input: 0.0375, output: 0.15 },
  "gemini-2.5-pro": { input: 1.25, output: 5.00 },
  "gemini-1.5-flash": { input: 0.075, output: 0.30 },
  "gemini-1.5-pro": { input: 1.25, output: 5.00 },
};

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model] || { input: 0, output: 0 };
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
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

    const { error } = await supabase.from("ai_usage_logs").insert({
      user_id: userId,
      model_name: model,
      provider: "google",
      edge_function: edgeFunction,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: totalTokens,
      estimated_cost_usd: estimatedCost,
      metadata,
    });

    if (error) {
      console.error("[USAGE] Failed to log:", error);
    } else {
      console.log(`[USAGE] Logged: ${model} - ${totalTokens} tokens - $${estimatedCost.toFixed(6)}`);
    }
  } catch (error) {
    console.error("[USAGE] Error:", error);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clientId, referenceImages, referenceText, instagramCaption, phase, analysis, userId } = await req.json();
    
    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_AI_STUDIO_API_KEY");
    if (!GOOGLE_API_KEY) throw new Error("GOOGLE_AI_STUDIO_API_KEY não configurada");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar informações do cliente
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("*")
      .eq("id", clientId)
      .single();

    if (clientError) throw clientError;

    // Buscar templates do cliente
    const { data: templates } = await supabase
      .from("client_templates")
      .select("*")
      .eq("client_id", clientId);

    if (phase === "analyze") {
      // FASE 1: ANÁLISE COM GEMINI 2.0 FLASH EXP (grátis e ótimo para multimodal)
      console.log("[REVERSE] Phase 1: Analysis with Gemini 2.0 Flash Exp");
      
      const parts: any[] = [];
      
      if (referenceImages && referenceImages.length > 0) {
        let textPrompt = `Analise este conteúdo visual em detalhes. Cada imagem representa uma página/slide do conteúdo.

Forneça uma análise estruturada em JSON com os seguintes campos:
- content_type: tipo do conteúdo (carrossel, reels, post_unico, video_longo, blog, newsletter, outro)
- page_count: número de páginas/slides/frames
- hook: gancho inicial que prende atenção
- structure: array com {page, purpose, content_summary} para cada página
- tone: tom de voz identificado
- cta: call-to-action final
- engagement_tactics: array de táticas de engajamento identificadas
- visual_elements: array de elementos visuais importantes (cores, fontes, layout)`;

        if (instagramCaption) {
          textPrompt += `\n\nLEGENDA ORIGINAL DO POST:\n${instagramCaption}\n\nAnalise esta legenda em conjunto com as imagens.`;
        }

        parts.push({ text: textPrompt });
        
        for (const imageUrl of referenceImages) {
          // Se é base64, usar direto
          if (imageUrl.startsWith("data:image")) {
            const base64Data = imageUrl.split(",")[1];
            const mimeType = imageUrl.split(";")[0].split(":")[1];
            parts.push({
              inlineData: {
                mimeType,
                data: base64Data
              }
            });
          } else {
            // Se é URL, fazer fetch e converter para base64
            const imgResponse = await fetch(imageUrl);
            const imgBuffer = await imgResponse.arrayBuffer();
            const base64 = btoa(String.fromCharCode(...new Uint8Array(imgBuffer)));
            parts.push({
              inlineData: {
                mimeType: "image/jpeg",
                data: base64
              }
            });
          }
        }
      } else if (referenceText) {
        parts.push({
          text: `Analise este conteúdo em detalhes:\n\n${referenceText}\n\nForneça uma análise estruturada em JSON com os campos: content_type, page_count, hook, structure (array), tone, cta, engagement_tactics (array), visual_elements (array).`
        });
      } else {
        throw new Error("Nenhum conteúdo de referência fornecido");
      }

      const analysisResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GOOGLE_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              role: "user",
              parts
            }],
            systemInstruction: {
              parts: [{ text: "Você é um especialista em engenharia reversa de conteúdo digital. Sempre retorne análises em formato JSON válido." }]
            },
            generationConfig: {
              temperature: 1.0,
              maxOutputTokens: 8192,
            }
          }),
        }
      );

      if (!analysisResponse.ok) {
        const errorText = await analysisResponse.text();
        console.error("[REVERSE] Analysis error:", errorText);
        throw new Error(`Google API error: ${analysisResponse.status}`);
      }

      const analysisData = await analysisResponse.json();
      const content = analysisData.candidates[0]?.content?.parts[0]?.text;
      
      if (!content) throw new Error("Nenhuma análise foi retornada");
      
      // Extrair JSON da resposta
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Resposta não está em formato JSON válido");
      
      const structuredAnalysis = JSON.parse(jsonMatch[0]);
      console.log("[REVERSE] Analysis completed");

      // Log de uso
      if (userId && analysisData.usageMetadata) {
        await logAIUsage(
          supabase,
          userId,
          "gemini-2.0-flash-exp",
          "reverse-engineer-analyze",
          analysisData.usageMetadata.promptTokenCount || 0,
          analysisData.usageMetadata.candidatesTokenCount || 0,
          { client_id: clientId, phase: "analyze" }
        );
      }

      return new Response(JSON.stringify(structuredAnalysis), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
      
    } else if (phase === "generate") {
      // FASE 2: GERAÇÃO COM GEMINI 2.5 FLASH (melhor custo-benefício)
      console.log("[REVERSE] Phase 2: Generation with Gemini 2.5 Flash");

      const clientContext = `
## PERFIL COMPLETO DO CLIENTE: ${client.name}

### Contexto Base
${client.context_notes || ""}

### Tags Estratégicas
${client.tags ? `
- Segmento: ${client.tags.segment || ""}
- Tom de Voz: ${client.tags.tone || ""}
- Objetivos: ${client.tags.objectives || ""}
- Público-Alvo: ${client.tags.audience || ""}
` : ""}

### Templates e Padrões
${templates?.map(t => `- ${t.name}: ${JSON.stringify(t.rules).substring(0, 500)}`).join('\n') || "Nenhum template específico"}

### Redes Sociais
${client.social_media ? Object.entries(client.social_media).map(([k, v]) => `- ${k}: ${v}`).join('\n') : ""}
`.trim();

      const generationPrompt = `## ANÁLISE ESTRUTURADA DO CONTEÚDO ORIGINAL

**Tipo:** ${analysis.content_type}
**Número de Páginas:** ${analysis.page_count}
**Hook Inicial:** ${analysis.hook}
**Tom:** ${analysis.tone}
**CTA:** ${analysis.cta}

**Estrutura:**
${analysis.structure.map((s: any) => `- Página ${s.page}: ${s.purpose} - ${s.content_summary}`).join('\n')}

**Táticas de Engajamento:**
${analysis.engagement_tactics.map((t: string) => `- ${t}`).join('\n')}

**Elementos Visuais:**
${analysis.visual_elements?.map((e: string) => `- ${e}`).join('\n') || 'Não especificados'}

---

${clientContext}

---

## TAREFA: RECRIAÇÃO ADAPTADA

Recrie o conteúdo MANTENDO:
- A estrutura de ${analysis.page_count} páginas/slides
- O tipo de hook identificado
- As táticas de engajamento

MAS ADAPTANDO:
- Tom de voz para ${client.tags?.tone || analysis.tone}
- Linguagem para o público ${client.tags?.audience || 'do cliente'}
- CTA alinhado aos objetivos: ${client.tags?.objectives || 'do cliente'}
- Seguindo os padrões dos templates

**FORMATO DE SAÍDA OBRIGATÓRIO:**
${analysis.page_count > 1 ? `
Separe cada página com ---PÁGINA N--- assim:

---PÁGINA 1---
[conteúdo da primeira página]

---PÁGINA 2---
[conteúdo da segunda página]

E assim por diante para todas as ${analysis.page_count} páginas.
` : 'Entregue o conteúdo completo adaptado.'}`;

      const generationResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              role: "user",
              parts: [{ text: generationPrompt }]
            }],
            systemInstruction: {
              parts: [{ text: "Você é um criador de conteúdo especializado que adapta referências ao estilo único de cada cliente." }]
            },
            generationConfig: {
              temperature: 1.0,
              maxOutputTokens: 8192,
            }
          }),
        }
      );

      if (!generationResponse.ok) {
        const errorText = await generationResponse.text();
        console.error("[REVERSE] Generation error:", errorText);
        throw new Error(`Google API error: ${generationResponse.status}`);
      }

      const generationData = await generationResponse.json();
      const content = generationData.candidates[0]?.content?.parts[0]?.text;
      
      if (!content) throw new Error("Nenhum conteúdo foi gerado");
      
      console.log("[REVERSE] Generation completed");

      // Log de uso
      if (userId && generationData.usageMetadata) {
        await logAIUsage(
          supabase,
          userId,
          "gemini-2.5-flash",
          "reverse-engineer-generate",
          generationData.usageMetadata.promptTokenCount || 0,
          generationData.usageMetadata.candidatesTokenCount || 0,
          { client_id: clientId, phase: "generate" }
        );
      }

      return new Response(JSON.stringify({ content }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Fase inválida");
  } catch (error: any) {
    console.error("[REVERSE] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
