import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clientId, referenceImages, referenceText, phase, analysis } = await req.json();
    
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY não configurada");
    }

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

    // Buscar documentos do cliente
    const { data: documents } = await supabase
      .from("client_documents")
      .select("*")
      .eq("client_id", clientId);

    // Buscar websites do cliente
    const { data: websites } = await supabase
      .from("client_websites")
      .select("*")
      .eq("client_id", clientId);

    // Buscar templates do cliente
    const { data: templates } = await supabase
      .from("client_templates")
      .select("*")
      .eq("client_id", clientId);

    // Construir contexto do cliente
    const clientContext = `
CLIENTE: ${client.name}
DESCRIÇÃO: ${client.description || ""}
TAGS: ${client.tags ? JSON.stringify(client.tags) : ""}
CONTEXTO: ${client.context_notes || ""}

WEBSITES:
${websites?.map((w) => `- ${w.url}: ${w.scraped_markdown?.slice(0, 2000) || ""}`).join("\n") || "Nenhum"}

TEMPLATES E REGRAS:
${templates?.map((t) => `${t.name}: ${t.rules ? JSON.stringify(t.rules).slice(0, 1000) : ""}`).join("\n") || "Nenhum"}
`.trim();

    if (phase === "analyze") {
      // FASE 1: ANALISAR O CONTEÚDO DE REFERÊNCIA (COM SUPORTE A MÚLTIPLAS IMAGENS)
      
      // Construir mensagem com imagens ou texto
      const userContent: any[] = [];
      
      if (referenceImages && referenceImages.length > 0) {
        // Adicionar prompt inicial
        userContent.push({
          type: "text",
          text: `Analise este conteúdo visual em detalhes. Pode ser um Reels, carrossel, blog post ou outro tipo de conteúdo.

Forneça uma análise estruturada:
1. Tipo de conteúdo (Reels, carrossel, blog post, vídeo longo, etc)
2. Estrutura narrativa e sequência
3. Tom e linguagem utilizada (analise textos visíveis)
4. Elementos visuais e design
5. Elementos-chave (gancho, desenvolvimento, CTA, etc)
6. Estratégia de engajamento

Seja extremamente detalhado na análise para permitir recriação fiel adaptada a outro estilo.`
        });
        
        // Adicionar todas as imagens
        for (const imageUrl of referenceImages) {
          userContent.push({
            type: "image_url",
            image_url: { url: imageUrl }
          });
        }
      } else if (referenceText) {
        // Apenas texto
        userContent.push({
          type: "text",
          text: `Analise este conteúdo em detalhes:

${referenceText}

Forneça uma análise estruturada:
1. Tipo de conteúdo (Reels, carrossel, blog post, vídeo longo, etc)
2. Estrutura narrativa
3. Tom e linguagem utilizada
4. Elementos-chave (gancho, desenvolvimento, CTA, etc)
5. Estratégia de engajamento

Seja extremamente detalhado na análise para permitir recriação fiel adaptada a outro estilo.`
        });
      } else {
        throw new Error("Nenhum conteúdo de referência fornecido");
      }

      const analysisResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: "Você é um especialista em engenharia reversa de conteúdo digital.",
            },
            {
              role: "user",
              content: userContent,
            },
          ],
          max_tokens: 2000,
        }),
      });

      if (!analysisResponse.ok) {
        const errorText = await analysisResponse.text();
        console.error("OpenAI API error:", errorText);
        throw new Error(`OpenAI API error: ${analysisResponse.status} - ${errorText}`);
      }

      const analysisData = await analysisResponse.json();
      
      if (!analysisData.choices?.[0]?.message?.content) {
        console.error("Invalid OpenAI response:", analysisData);
        throw new Error("Resposta inválida da API OpenAI");
      }
      
      const analysisText = analysisData.choices[0].message.content;

      // Extrair informações estruturadas da análise
      return new Response(
        JSON.stringify({
          contentType: analysisText.match(/Tipo de conteúdo:?\s*(.+?)[\n\r]/i)?.[1] || "Indefinido",
          structure: analysisText.match(/Estrutura narrativa:?\s*(.+?)[\n\r]/i)?.[1] || "",
          tone: analysisText.match(/Tom e linguagem:?\s*(.+?)[\n\r]/i)?.[1] || "",
          keyElements: analysisText.match(/Elementos-chave:?\s*(.+?)(?=\d\.|$)/is)?.[1]?.split(/[\n\r]+/).filter(Boolean) || [],
          strategy: analysisText.match(/Estratégia:?\s*(.+?)(?=\n\n|$)/is)?.[1] || "",
          fullAnalysis: analysisText,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } else if (phase === "generate") {
      // FASE 2: GERAR CONTEÚDO ADAPTADO AO CLIENTE
      const generationPrompt = `Com base nesta análise de conteúdo:

${analysis.fullAnalysis}

E considerando o perfil deste cliente:

${clientContext}

RECRIE o conteúdo completamente adaptado ao estilo, tom e padrões do cliente.

IMPORTANTE:
- Use o MESMO tipo de estrutura do conteúdo original
- Adapte ao TOM e LINGUAGEM específicos do cliente
- Siga os TEMPLATES e REGRAS estabelecidos pelo cliente
- Mantenha a ESTRATÉGIA de engajamento, mas no estilo do cliente
- Não copie literalmente - adapte e recrie

Gere o conteúdo final pronto para uso.`;

      const generationResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-5-2025-08-07",
          messages: [
            {
              role: "system",
              content: `Você é um criador de conteúdo especializado que adapta referências ao estilo único de cada cliente.`,
            },
            {
              role: "user",
              content: generationPrompt,
            },
          ],
          max_completion_tokens: 4000,
        }),
      });

      if (!generationResponse.ok) {
        const errorText = await generationResponse.text();
        console.error("OpenAI API error:", errorText);
        throw new Error(`OpenAI API error: ${generationResponse.status} - ${errorText}`);
      }

      const generationData = await generationResponse.json();
      
      if (!generationData.choices?.[0]?.message?.content) {
        console.error("Invalid OpenAI response:", generationData);
        throw new Error("Resposta inválida da API OpenAI");
      }
      
      const content = generationData.choices[0].message.content;

      return new Response(
        JSON.stringify({ content }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    throw new Error("Fase inválida");
  } catch (error: any) {
    console.error("Erro em reverse-engineer:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
