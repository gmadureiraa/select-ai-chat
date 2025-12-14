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

    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_AI_STUDIO_API_KEY");
    if (!GOOGLE_API_KEY) {
      throw new Error("GOOGLE_AI_STUDIO_API_KEY not configured");
    }

    console.log(`Transcribing ${imageUrls.length} images with Gemini`);

    const systemPrompt = "Você é um transcritor de texto. Sua ÚNICA tarefa é extrair o texto visível nas imagens. NÃO descreva a imagem, NÃO mencione cores, layout, design, ou elementos visuais. APENAS transcreva o texto que está escrito. Se for um carrossel do Instagram, separe cada página com '---PÁGINA N---' e transcreva apenas o texto dessa página. Retorne SOMENTE o texto extraído, nada mais.";

    const userPrompt = imageUrls.length === 1 
      ? "Transcreva APENAS o texto visível nesta imagem. Não descreva a imagem, apenas extraia o texto:"
      : `Transcreva APENAS o texto visível nestas ${imageUrls.length} imagens. NÃO descreva as imagens. Separe cada página com '---PÁGINA N---' e transcreva apenas o texto de cada uma:`;

    // Build parts for Gemini API
    const parts: any[] = [
      { text: `${systemPrompt}\n\n${userPrompt}` }
    ];

    // Add images as inline data
    for (const url of imageUrls) {
      let base64Data: string;
      let mimeType: string;

      if (url.startsWith("data:")) {
        // Parse data URL
        const matches = url.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          mimeType = matches[1];
          base64Data = matches[2];
        } else {
          console.warn(`Invalid data URL format: ${url.substring(0, 50)}...`);
          continue;
        }
      } else {
        // URL-based image - fetch and convert to base64
        try {
          const imageResponse = await fetch(url);
          if (imageResponse.ok) {
            const arrayBuffer = await imageResponse.arrayBuffer();
            base64Data = encodeBase64(arrayBuffer);
            mimeType = imageResponse.headers.get("content-type") || "image/jpeg";
          } else {
            console.warn(`Failed to fetch image: ${url}`);
            continue;
          }
        } catch (fetchError) {
          console.warn(`Error fetching image ${url}:`, fetchError);
          continue;
        }
      }

      parts.push({
        inline_data: {
          mime_type: mimeType,
          data: base64Data
        }
      });
    }

    // Call Gemini API directly
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: parts
            }
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 8192,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("Gemini API error:", error);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const transcription = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

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
