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
    const { clientId, referenceUrl, referenceText, phase, analysis } = await req.json();
    
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
      // FASE 1: ANALISAR O CONTEÚDO DE REFERÊNCIA
      let referenceContent = "";
      
      if (referenceUrl) {
        // Se for URL, fazer scraping/análise
        const urlAnalysisPrompt = `Analise esta URL e extraia o conteúdo: ${referenceUrl}
        
Se for um vídeo do YouTube, identifique o tipo de vídeo.
Se for um post do Instagram, identifique se é Reels, carrossel ou post único.
Se for um blog post, identifique a estrutura.

Retorne uma descrição detalhada do conteúdo encontrado.`;

        const urlResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: "gpt-5-mini-2025-08-07",
            messages: [
              {
                role: "system",
                content: "Você é um analista de conteúdo especializado em engenharia reversa.",
              },
              {
                role: "user",
                content: urlAnalysisPrompt,
              },
            ],
            temperature: 0.3,
          }),
        });

        const urlData = await urlResponse.json();
        referenceContent = urlData.choices[0].message.content;
      } else {
        referenceContent = referenceText;
      }

      // Analisar estrutura, tom, estratégia
      const analysisPrompt = `Analise este conteúdo em detalhes:

${referenceContent}

Forneça uma análise estruturada:
1. Tipo de conteúdo (Reels, carrossel, blog post, vídeo longo, etc)
2. Estrutura narrativa
3. Tom e linguagem utilizada
4. Elementos-chave (gancho, desenvolvimento, CTA, etc)
5. Estratégia de engajamento

Seja extremamente detalhado na análise para permitir recriação fiel adaptada a outro estilo.`;

      const analysisResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-5-mini-2025-08-07",
          messages: [
            {
              role: "system",
              content: "Você é um especialista em engenharia reversa de conteúdo digital.",
            },
            {
              role: "user",
              content: analysisPrompt,
            },
          ],
          temperature: 0.3,
        }),
      });

      const analysisData = await analysisResponse.json();
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
          temperature: 0.7,
        }),
      });

      const generationData = await generationResponse.json();
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
