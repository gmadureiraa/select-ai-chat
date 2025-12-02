import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrls } = await req.json();

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      throw new Error("imageUrls array is required");
    }

    if (imageUrls.length > 10) {
      throw new Error("Maximum 10 images allowed");
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    console.log(`Transcribing ${imageUrls.length} images`);

    const messages = [
      {
        role: "system",
        content: "Você é um especialista em análise e transcrição de conteúdo visual. Sua tarefa é DESCREVER COMPLETAMENTE a imagem E extrair todo o texto presente. Inclua: 1) DESCRIÇÃO VISUAL: layout, composição, cores dominantes, estilo gráfico, elementos visuais (ícones, ilustrações, fotos), hierarquia visual, e atmosfera geral. 2) TRANSCRIÇÃO: todo o conteúdo textual visível (títulos, subtítulos, corpo de texto, CTAs, legendas). 3) CONTEXTO: tipo de conteúdo (post, carousel, anúncio, etc.) e objetivo aparente. Se for um carrossel do Instagram, separe cada página com '---PÁGINA N---'. Seja extremamente detalhado e preciso - a descrição deve permitir que alguém visualize mentalmente a imagem sem vê-la."
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: imageUrls.length === 1 
              ? "Analise esta imagem completamente: DESCREVA todos os elementos visuais (layout, cores, estilo, composição, elementos gráficos) E TRANSCREVA todo o texto presente. Seja extremamente detalhado na descrição visual para que possa servir como referência de estilo e estrutura:"
              : `Analise estas ${imageUrls.length} imagens completamente: para cada uma, DESCREVA todos os elementos visuais (layout, cores, estilo, composição, elementos gráficos) E TRANSCREVA todo o texto presente. Se for um carrossel, separe cada página com '---PÁGINA N---'. Seja extremamente detalhado nas descrições visuais:`
          },
          ...imageUrls.map((url: string) => ({
            type: "image_url",
            image_url: { url }
          }))
        ]
      }
    ];

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("OpenAI API error:", error);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const transcription = data.choices[0].message.content;

    console.log("Transcription completed successfully");

    return new Response(
      JSON.stringify({ transcription }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in transcribe-images:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
