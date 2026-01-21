import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AttachmentInput {
  type: "image" | "video" | "audio" | "text" | "url";
  content: string;
  imageBase64?: string;
  analysis?: Record<string, unknown>;
  transcription?: string;
}

interface GenerateRequest {
  type: "text" | "image";
  inputs: AttachmentInput[];
  config: {
    format?: string;
    platform?: string;
    aspectRatio?: string;
    noText?: boolean;
    preserveFace?: boolean;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: GenerateRequest = await req.json();
    const { type, inputs, config } = body;

    console.log("[generate-content-v2] Request:", { type, inputsCount: inputs.length, config });

    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_AI_STUDIO_API_KEY");
    if (!GOOGLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (type === "text") {
      // Build context from all inputs
      let context = "";
      
      for (const input of inputs) {
        if (input.type === "text") {
          context += `\n\n### Texto/Briefing:\n${input.content}`;
        } else if (input.type === "url") {
          context += `\n\n### Conteúdo de URL:\n${input.transcription || input.content}`;
        } else if (input.type === "image" && input.analysis) {
          context += `\n\n### Análise de Imagem:\n${JSON.stringify(input.analysis, null, 2)}`;
        } else if ((input.type === "video" || input.type === "audio") && input.transcription) {
          context += `\n\n### Transcrição de ${input.type === "video" ? "Vídeo" : "Áudio"}:\n${input.transcription}`;
        }
      }

      const formatPrompts: Record<string, string> = {
        post: "Crie um post engajante para redes sociais.",
        carrossel: "Crie um carrossel educativo com slides bem estruturados. Formato:\n\nSLIDE 1 (CAPA):\n[título impactante]\n\nSLIDE 2-N:\n[conteúdo do slide]\n\nSLIDE FINAL (CTA):\n[chamada para ação]",
        thread: "Crie uma thread viral com tweets numerados. Formato:\n\n1/ [primeiro tweet - hook]\n\n2/ [desenvolvimento]\n\n[continuar até o final]",
        newsletter: "Crie uma newsletter envolvente com introdução, corpo e conclusão.",
        reels: "Crie um roteiro para Reels/TikTok com ganchos visuais e timing.",
      };

      const platformTone: Record<string, string> = {
        instagram: "Tom visual, emojis moderados, hashtags relevantes",
        linkedin: "Tom profissional, insights de negócios, sem emojis excessivos",
        twitter: "Tom conciso, provocativo, máximo impacto em poucas palavras",
        tiktok: "Tom jovem, trends, linguagem casual",
      };

      const prompt = `Você é um copywriter especialista em conteúdo para redes sociais.

${formatPrompts[config.format || "post"]}

Plataforma: ${config.platform || "instagram"}
Tom: ${platformTone[config.platform || "instagram"]}

CONTEXTO E REFERÊNCIAS:
${context}

REGRAS:
- Seja direto e impactante
- Use a linguagem adequada para a plataforma
- Mantenha autenticidade
- Não invente informações, use apenas o contexto fornecido

Gere o conteúdo agora:`;

      console.log("[generate-content-v2] Generating text...");

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.8,
              maxOutputTokens: 4096,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[generate-content-v2] API error:", errorText);
        throw new Error("Failed to generate text");
      }

      const data = await response.json();
      const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

      return new Response(
        JSON.stringify({ content: generatedText }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else {
      // Image generation
      let imagePrompt = "Crie uma imagem profissional para redes sociais. ";
      let referenceImage: string | null = null;

      // Build prompt from inputs
      for (const input of inputs) {
        if (input.type === "image" && input.imageBase64) {
          referenceImage = input.imageBase64;
          if (input.analysis) {
            imagePrompt += `\n\nReferência visual: ${JSON.stringify(input.analysis)}`;
          }
        } else if (input.type === "text") {
          imagePrompt += `\n\nBriefing: ${input.content}`;
        } else if (input.transcription) {
          imagePrompt += `\n\nContexto: ${input.transcription}`;
        }
      }

      // Add config instructions
      if (config.aspectRatio) {
        imagePrompt += `\n\nProporção: ${config.aspectRatio}`;
      }
      if (config.noText) {
        imagePrompt += "\n\nIMPORTANTE: NÃO inclua nenhum texto, letras ou números na imagem.";
      }
      if (config.preserveFace && referenceImage) {
        imagePrompt += "\n\nPreserve as características faciais da pessoa na imagem de referência.";
      }

      console.log("[generate-content-v2] Generating image...");

      // Build request parts
      const parts: any[] = [];

      if (referenceImage) {
        const match = referenceImage.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          parts.push({
            inlineData: {
              mimeType: match[1],
              data: match[2],
            },
          });
        }
      }

      parts.push({ text: imagePrompt });

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${GOOGLE_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
              responseModalities: ["Text", "Image"],
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[generate-content-v2] Image API error:", errorText);
        
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: "Rate limit exceeded. Please wait a moment." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        throw new Error("Failed to generate image");
      }

      const data = await response.json();
      
      // Extract image from response
      let imageBase64: string | null = null;
      let mimeType = "image/png";

      const candidates = data.candidates;
      if (candidates && candidates.length > 0) {
        const content = candidates[0].content;
        if (content && content.parts) {
          for (const part of content.parts) {
            if (part.inlineData) {
              imageBase64 = part.inlineData.data;
              mimeType = part.inlineData.mimeType || "image/png";
              break;
            }
          }
        }
      }

      if (!imageBase64) {
        return new Response(
          JSON.stringify({ error: "No image generated" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Upload to storage
      const fileName = `generated/${user.id}/${Date.now()}.${mimeType.split("/")[1] || "png"}`;
      const imageBuffer = Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0));

      const { error: uploadError } = await supabaseClient.storage
        .from("client-files")
        .upload(fileName, imageBuffer, {
          contentType: mimeType,
          upsert: true,
        });

      if (uploadError) {
        console.error("[generate-content-v2] Upload error:", uploadError);
        // Return base64 as fallback
        return new Response(
          JSON.stringify({ imageUrl: `data:${mimeType};base64,${imageBase64}` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: { publicUrl } } = supabaseClient.storage
        .from("client-files")
        .getPublicUrl(fileName);

      return new Response(
        JSON.stringify({ imageUrl: publicUrl }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error) {
    console.error("[generate-content-v2] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
