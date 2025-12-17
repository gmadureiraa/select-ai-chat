import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logAIUsage, estimateImageTokens } from "../_shared/ai-usage.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 5;
const MODEL = "gemini-2.5-flash";

async function transcribeBatch(
  imageUrls: string[],
  startIndex: number,
  apiKey: string
): Promise<{ transcription: string; inputTokens: number; outputTokens: number }> {
  const parts: any[] = [];
  
  const systemPrompt = `Você é um transcritor de texto preciso. Sua ÚNICA tarefa é extrair TODO o texto visível nas imagens.

REGRAS IMPORTANTES:
- NÃO descreva a imagem, NÃO mencione cores, layout, design, ou elementos visuais
- APENAS transcreva o texto que está escrito
- Transcreva CADA imagem separadamente
- Use o formato "---PÁGINA N---" antes do texto de cada imagem
- Se uma imagem não tiver texto, escreva "(sem texto)"
- NÃO pule nenhuma imagem

Você receberá ${imageUrls.length} imagens (páginas ${startIndex + 1} a ${startIndex + imageUrls.length}).`;

  parts.push({ text: systemPrompt });

  let validImageCount = 0;
  for (let i = 0; i < imageUrls.length; i++) {
    const url = imageUrls[i];
    let base64Data: string;
    let mimeType: string;

    if (url.startsWith("data:")) {
      const matches = url.match(/^data:([^;]+);base64,(.+)$/);
      if (matches) {
        mimeType = matches[1];
        base64Data = matches[2];
        validImageCount++;
      } else {
        console.warn(`[transcribe-images] Invalid data URL format for image ${startIndex + i + 1}`);
        continue;
      }
    } else {
      try {
        const imageResponse = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        if (imageResponse.ok) {
          const arrayBuffer = await imageResponse.arrayBuffer();
          base64Data = encodeBase64(arrayBuffer);
          mimeType = imageResponse.headers.get("content-type") || "image/jpeg";
          validImageCount++;
        } else {
          console.warn(`[transcribe-images] Failed to fetch image ${startIndex + i + 1}: ${imageResponse.status}`);
          continue;
        }
      } catch (fetchError) {
        console.warn(`[transcribe-images] Error fetching image ${startIndex + i + 1}:`, fetchError);
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

  if (validImageCount === 0) {
    return { transcription: "", inputTokens: 0, outputTokens: 0 };
  }

  console.log(`[transcribe-images] Processing batch: ${validImageCount} images (pages ${startIndex + 1}-${startIndex + imageUrls.length})`);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 16384,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("[transcribe-images] Gemini API error:", error);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const transcription = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const inputTokens = data.usageMetadata?.promptTokenCount || estimateImageTokens(validImageCount);
  const outputTokens = data.usageMetadata?.candidatesTokenCount || Math.ceil(transcription.length / 4);
  
  return { transcription, inputTokens, outputTokens };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrls, userId, clientId } = await req.json();

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      throw new Error("imageUrls array is required");
    }

    if (imageUrls.length > 25) {
      throw new Error("Maximum 25 images allowed");
    }

    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_AI_STUDIO_API_KEY");
    if (!GOOGLE_API_KEY) {
      throw new Error("GOOGLE_AI_STUDIO_API_KEY not configured");
    }

    console.log(`[transcribe-images] Transcribing ${imageUrls.length} images with batch size ${BATCH_SIZE}`);

    // Process images in batches
    const batches: string[][] = [];
    for (let i = 0; i < imageUrls.length; i += BATCH_SIZE) {
      batches.push(imageUrls.slice(i, i + BATCH_SIZE));
    }

    console.log(`[transcribe-images] Split into ${batches.length} batches`);

    const transcriptions: string[] = [];
    let globalPageIndex = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      const result = await transcribeBatch(batch, globalPageIndex, GOOGLE_API_KEY);
      
      totalInputTokens += result.inputTokens;
      totalOutputTokens += result.outputTokens;
      
      if (result.transcription) {
        let adjustedTranscription = result.transcription;
        
        // Adjust page numbers for batches after the first
        if (batchIndex > 0) {
          for (let i = batch.length; i >= 1; i--) {
            const oldPage = `---PÁGINA ${i}---`;
            const newPage = `---PÁGINA ${globalPageIndex + i}---`;
            adjustedTranscription = adjustedTranscription.replace(new RegExp(oldPage, 'g'), newPage);
          }
        }
        
        transcriptions.push(adjustedTranscription);
      }
      
      globalPageIndex += batch.length;
      
      // Small delay between batches
      if (batchIndex < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Log AI usage
    if (userId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      await logAIUsage(
        supabase,
        userId,
        MODEL,
        "transcribe-images",
        totalInputTokens,
        totalOutputTokens,
        { imageCount: imageUrls.length, batchCount: batches.length, clientId }
      );
    }

    const fullTranscription = transcriptions.join('\n\n');
    
    console.log(`[transcribe-images] Complete: ${batches.length} batches, ${totalInputTokens + totalOutputTokens} tokens`);

    return new Response(
      JSON.stringify({ transcription: fullTranscription }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[transcribe-images] Error:", error);
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
