import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logAIUsage, estimateImageTokens } from "../_shared/ai-usage.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Mantemos o limite bem baixo para evitar WORKER_LIMIT / CPU Time exceeded.
// O frontend deve fazer o chunking (1 imagem por chamada) e recompor o texto.
const MAX_IMAGES_PER_REQUEST = 1;
const MODEL = "gemini-2.5-flash";

type InlineDataPart = {
  inline_data: {
    mime_type: string;
    data: string;
  };
};

type TextPart = { text: string };

type GeminiPart = InlineDataPart | TextPart;

async function urlToInlineData(url: string): Promise<InlineDataPart | null> {
  // data URL
  if (url.startsWith("data:")) {
    const matches = url.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) return null;
    const mimeType = matches[1];
    const base64Data = matches[2];
    return {
      inline_data: {
        mime_type: mimeType,
        data: base64Data,
      },
    };
  }

  // remote URL
  try {
    const imageResponse = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!imageResponse.ok) {
      console.warn(`[transcribe-images] Failed to fetch image: ${imageResponse.status}`);
      return null;
    }

    const arrayBuffer = await imageResponse.arrayBuffer();
    const base64Data = encodeBase64(arrayBuffer);
    const mimeType = imageResponse.headers.get("content-type") || "image/jpeg";

    return {
      inline_data: {
        mime_type: mimeType,
        data: base64Data,
      },
    };
  } catch (err) {
    console.warn("[transcribe-images] Error fetching image:", err);
    return null;
  }
}

async function transcribeBatch(
  imageUrls: string[],
  startIndex: number,
  apiKey: string
): Promise<{ transcription: string; inputTokens: number; outputTokens: number }> {
  const parts: GeminiPart[] = [];

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
  for (const url of imageUrls) {
    const inlineData = await urlToInlineData(url);
    if (inlineData) {
      parts.push(inlineData);
      validImageCount++;
    }
  }

  if (validImageCount === 0) {
    return { transcription: "", inputTokens: 0, outputTokens: 0 };
  }

  console.log(
    `[transcribe-images] Processing ${validImageCount} image(s) (pages ${startIndex + 1}-${startIndex + imageUrls.length})`
  );

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 8192,
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
  let transcription = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  // Normaliza a numeração de páginas para o índice global (mesmo se o modelo retornar 1..N)
  for (let i = imageUrls.length; i >= 1; i--) {
    const oldPage = `---PÁGINA ${i}---`;
    const newPage = `---PÁGINA ${startIndex + i}---`;
    transcription = transcription.replace(new RegExp(oldPage, "g"), newPage);
  }

  const inputTokens =
    data.usageMetadata?.promptTokenCount || estimateImageTokens(validImageCount);
  const outputTokens =
    data.usageMetadata?.candidatesTokenCount || Math.ceil(transcription.length / 4);

  return { transcription, inputTokens, outputTokens };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { imageUrls, userId, clientId } = body;
    const startIndex = Number(body?.startIndex ?? 0);

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      throw new Error("imageUrls array is required");
    }

    if (!Number.isFinite(startIndex) || startIndex < 0) {
      throw new Error("startIndex must be a non-negative number");
    }

    if (imageUrls.length > MAX_IMAGES_PER_REQUEST) {
      throw new Error(
        `Maximum ${MAX_IMAGES_PER_REQUEST} images allowed per request`
      );
    }

    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_AI_STUDIO_API_KEY");
    if (!GOOGLE_API_KEY) {
      throw new Error("GOOGLE_AI_STUDIO_API_KEY not configured");
    }

    console.log(
      `[transcribe-images] Request: ${imageUrls.length} image(s), startIndex=${startIndex}`
    );

    const startedAt = Date.now();
    const result = await transcribeBatch(imageUrls, startIndex, GOOGLE_API_KEY);
    const durationMs = Date.now() - startedAt;

    console.log(
      `[transcribe-images] Done: ${imageUrls.length} image(s), ${durationMs}ms, tokens=${result.inputTokens + result.outputTokens}`
    );

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
        result.inputTokens,
        result.outputTokens,
        { imageCount: imageUrls.length, startIndex, clientId }
      );
    }

    // Mantém compatibilidade com usos antigos que esperam um array
    return new Response(
      JSON.stringify({
        transcription: result.transcription,
        transcriptions: [result.transcription],
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[transcribe-images] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
