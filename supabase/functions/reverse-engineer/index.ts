import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Tool para extração estruturada de análise
const contentAnalysisTool = {
  type: "function",
  function: {
    name: "extract_content_analysis",
    description: "Extrai análise estruturada do conteúdo de referência",
    parameters: {
      type: "object",
      properties: {
        content_type: {
          type: "string",
          enum: ["carrossel", "reels", "post_unico", "video_longo", "blog", "newsletter", "outro"],
          description: "Tipo do conteúdo analisado"
        },
        page_count: {
          type: "number",
          description: "Número de páginas/slides/frames"
        },
        hook: {
          type: "string",
          description: "Gancho inicial que prende atenção"
        },
        structure: {
          type: "array",
          items: {
            type: "object",
            properties: {
              page: { type: "number" },
              purpose: { type: "string" },
              content_summary: { type: "string" }
            }
          },
          description: "Estrutura página por página"
        },
        tone: {
          type: "string",
          description: "Tom de voz identificado"
        },
        cta: {
          type: "string",
          description: "Call-to-action final"
        },
        engagement_tactics: {
          type: "array",
          items: { type: "string" },
          description: "Táticas de engajamento identificadas"
        },
        visual_elements: {
          type: "array",
          items: { type: "string" },
          description: "Elementos visuais importantes (cores, fontes, layout)"
        }
      },
      required: ["content_type", "page_count", "hook", "structure", "tone", "cta", "engagement_tactics"]
    }
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clientId, referenceImages, referenceText, instagramCaption, phase, analysis } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

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
      // FASE 1: ANÁLISE COM GEMINI 3 PRO PREVIEW (melhor para multimodal)
      console.log("[REVERSE] Phase 1: Analysis with Gemini 3 Pro Preview");
      
      const userContent: any[] = [];
      
      if (referenceImages && referenceImages.length > 0) {
        let textPrompt = `Analise este conteúdo visual em detalhes. Cada imagem representa uma página/slide do conteúdo.

Use o tool extract_content_analysis para fornecer uma análise ESTRUTURADA.`;

        if (instagramCaption) {
          textPrompt += `\n\nLEGENDA ORIGINAL DO POST:\n${instagramCaption}\n\nAnalise esta legenda em conjunto com as imagens.`;
        }

        userContent.push({
          type: "text",
          text: textPrompt
        });
        
        for (const imageUrl of referenceImages) {
          userContent.push({
            type: "image_url",
            image_url: { url: imageUrl }
          });
        }
      } else if (referenceText) {
        userContent.push({
          type: "text",
          text: `Analise este conteúdo em detalhes:\n\n${referenceText}\n\nUse o tool extract_content_analysis para fornecer uma análise ESTRUTURADA.`
        });
      } else {
        throw new Error("Nenhum conteúdo de referência fornecido");
      }

      const analysisResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-pro-preview",
          messages: [
            {
              role: "system",
              content: "Você é um especialista em engenharia reversa de conteúdo digital."
            },
            {
              role: "user",
              content: userContent,
            },
          ],
          tools: [contentAnalysisTool],
          tool_choice: { type: "function", function: { name: "extract_content_analysis" } },
        }),
      });

      if (!analysisResponse.ok) {
        const errorText = await analysisResponse.text();
        console.error("[REVERSE] Analysis error:", errorText);
        throw new Error(`AI Gateway error: ${analysisResponse.status}`);
      }

      const analysisData = await analysisResponse.json();
      const toolCall = analysisData.choices[0]?.message?.tool_calls?.[0];
      
      if (!toolCall) throw new Error("Nenhuma análise estruturada foi retornada");
      
      const structuredAnalysis = JSON.parse(toolCall.function.arguments);
      console.log("[REVERSE] Analysis completed");

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

      const generationResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: "Você é um criador de conteúdo especializado que adapta referências ao estilo único de cada cliente."
            },
            {
              role: "user",
              content: generationPrompt,
            },
          ],
        }),
      });

      if (!generationResponse.ok) {
        const errorText = await generationResponse.text();
        console.error("[REVERSE] Generation error:", errorText);
        throw new Error(`AI Gateway error: ${generationResponse.status}`);
      }

      const generationData = await generationResponse.json();
      const content = generationData.choices[0]?.message?.content;
      
      if (!content) throw new Error("Nenhum conteúdo foi gerado");
      
      console.log("[REVERSE] Generation completed");

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
