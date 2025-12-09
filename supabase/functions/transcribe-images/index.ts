import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    console.log(`Transcribing ${imageUrls.length} images with Lovable AI`);

    const systemPrompt = "Você é um especialista em análise e transcrição de conteúdo visual. Sua tarefa é DESCREVER COMPLETAMENTE a imagem E extrair todo o texto presente. Inclua: 1) DESCRIÇÃO VISUAL: layout, composição, cores dominantes, estilo gráfico, elementos visuais (ícones, ilustrações, fotos), hierarquia visual, e atmosfera geral. 2) TRANSCRIÇÃO: todo o conteúdo textual visível (títulos, subtítulos, corpo de texto, CTAs, legendas). 3) CONTEXTO: tipo de conteúdo (post, carousel, anúncio, etc.) e objetivo aparente. Se for um carrossel do Instagram, separe cada página com '---PÁGINA N---'. Seja extremamente detalhado e preciso - a descrição deve permitir que alguém visualize mentalmente a imagem sem vê-la.";

    const userPrompt = imageUrls.length === 1 
      ? "Analise esta imagem completamente: DESCREVA todos os elementos visuais (layout, cores, estilo, composição, elementos gráficos) E TRANSCREVA todo o texto presente. Seja extremamente detalhado na descrição visual para que possa servir como referência de estilo e estrutura:"
      : `Analise estas ${imageUrls.length} imagens completamente: para cada uma, DESCREVA todos os elementos visuais (layout, cores, estilo, composição, elementos gráficos) E TRANSCREVA todo o texto presente. Se for um carrossel, separe cada página com '---PÁGINA N---'. Seja extremamente detalhado nas descrições visuais:`;

    // Build multimodal content for Lovable AI
    const content: any[] = [
      { type: "text", text: `${systemPrompt}\n\n${userPrompt}` }
    ];

    // Add images
    for (const url of imageUrls) {
      if (url.startsWith("data:")) {
        // Already base64
        content.push({
          type: "image_url",
          image_url: { url }
        });
      } else {
        // URL-based image - fetch and convert to base64
        try {
          const imageResponse = await fetch(url);
          if (imageResponse.ok) {
            const arrayBuffer = await imageResponse.arrayBuffer();
            // Use proper base64 encoding that handles large files
            const base64 = encodeBase64(arrayBuffer);
            const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
            content.push({
              type: "image_url",
              image_url: { url: `data:${contentType};base64,${base64}` }
            });
          } else {
            console.warn(`Failed to fetch image: ${url}`);
          }
        } catch (fetchError) {
          console.warn(`Error fetching image ${url}:`, fetchError);
        }
      }
    }

    // Call Lovable AI Gateway with Gemini for vision
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: content
          }
        ],
        temperature: 0.3,
        max_tokens: 8192,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Lovable AI error:", error);
      throw new Error(`Lovable AI error: ${response.status}`);
    }

    const data = await response.json();
    const transcription = data.choices?.[0]?.message?.content || "";

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
