import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AttachmentInput {
  type: "image" | "video" | "audio" | "text" | "url" | "instagram" | "youtube";
  content: string;
  imageBase64?: string;
  analysis?: Record<string, unknown>;
  transcription?: string;
  // Instagram-specific
  extractedImages?: string[];
  caption?: string;
  imageCount?: number;
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
  clientId?: string;
}

interface BrandContext {
  name?: string;
  brandVoice?: string;
  values?: string;
  keywords?: string[];
  colorPalette?: {
    primary?: string;
    secondary?: string;
    accent?: string;
  };
  photographyStyle?: string;
}

// Fetch client brand context for enriched prompts
async function fetchClientBrandContext(
  supabaseClient: any,
  clientId: string | null
): Promise<BrandContext | null> {
  try {
    if (!clientId) {
      console.log("[generate-content-v2] No clientId provided");
      return null;
    }

    // Get the specific client by ID
    const { data: clientData, error } = await supabaseClient
      .from('clients')
      .select('name, identity_guide, context_notes, brand_assets')
      .eq('id', clientId)
      .single();

    if (error || !clientData) {
      console.log("[generate-content-v2] No client data found for ID:", clientId);
      return null;
    }

    const brandAssets = clientData.brand_assets || {};
    
    return {
      name: clientData.name,
      brandVoice: extractFromGuide(clientData.identity_guide, 'tom de voz') || 
                  extractFromGuide(clientData.identity_guide, 'voice') || undefined,
      values: extractFromGuide(clientData.identity_guide, 'valores') ||
              extractFromGuide(clientData.identity_guide, 'values') || undefined,
      keywords: extractKeywords(clientData.context_notes),
      colorPalette: {
        primary: brandAssets.color_palette?.primary || brandAssets.colors?.primary,
        secondary: brandAssets.color_palette?.secondary || brandAssets.colors?.secondary,
        accent: brandAssets.color_palette?.accent || brandAssets.colors?.accent,
      },
      photographyStyle: brandAssets.visual_style?.photography_style || brandAssets.photographyStyle,
    };
  } catch (err) {
    console.error("[generate-content-v2] Error fetching brand context:", err);
    return null;
  }
}

function extractFromGuide(guide: string | null, keyword: string): string | null {
  if (!guide) return null;
  const lines = guide.split('\n');
  for (const line of lines) {
    if (line.toLowerCase().includes(keyword.toLowerCase())) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > -1) {
        return line.substring(colonIndex + 1).trim();
      }
    }
  }
  return null;
}

function extractKeywords(notes: string | null): string[] {
  if (!notes) return [];
  // Extract words that might be keywords (capitalized or repeated)
  const words = notes.split(/\s+/).filter(w => w.length > 3);
  const wordCounts: Record<string, number> = {};
  words.forEach(w => {
    const clean = w.replace(/[^a-zA-ZÀ-ÿ]/g, '').toLowerCase();
    if (clean) wordCounts[clean] = (wordCounts[clean] || 0) + 1;
  });
  return Object.entries(wordCounts)
    .filter(([_, count]) => count >= 2)
    .map(([word]) => word)
    .slice(0, 10);
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
    const { type, inputs, config, clientId } = body;

    console.log("[generate-content-v2] Request:", { type, inputsCount: inputs.length, config, clientId });

    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_AI_STUDIO_API_KEY");
    if (!GOOGLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch brand context for the specific client
    const brandContext = await fetchClientBrandContext(supabaseClient, clientId || null);
    console.log("[generate-content-v2] Brand context:", brandContext?.name || "none", "for client:", clientId);

    if (type === "text") {
      // Build context from all inputs - PRIORITIZE REAL EXTRACTED DATA
      let context = "";
      let hasInstagramReference = false;
      
      for (const input of inputs) {
        if (input.type === "instagram") {
          hasInstagramReference = true;
          context += `\n\n### REFERÊNCIA INSTAGRAM (USE COMO BASE PRINCIPAL):`;
          if (input.caption) {
            context += `\n**Legenda original do post:**\n${input.caption}`;
          }
          if (input.imageCount) {
            context += `\n**Número de slides/imagens:** ${input.imageCount}`;
          }
          if (input.transcription) {
            context += `\n**Transcrição do vídeo/áudio:**\n${input.transcription}`;
          }
          context += `\n---`;
        } else if (input.type === "youtube") {
          context += `\n\n### REFERÊNCIA YOUTUBE:`;
          context += `\n**Transcrição:**\n${input.transcription || input.content}`;
          context += `\n---`;
        } else if (input.type === "text") {
          context += `\n\n### Texto/Briefing do usuário:\n${input.content}`;
        } else if (input.type === "url") {
          context += `\n\n### Conteúdo de URL:\n${input.transcription || input.content}`;
        } else if (input.type === "image" && input.analysis) {
          context += `\n\n### Análise de Imagem:\n${JSON.stringify(input.analysis, null, 2)}`;
        } else if ((input.type === "video" || input.type === "audio") && input.transcription) {
          context += `\n\n### Transcrição de ${input.type === "video" ? "Vídeo" : "Áudio"}:\n${input.transcription}`;
        }
      }

      const formatPrompts: Record<string, string> = {
        // Instagram
        carousel: "Crie um carrossel educativo com slides bem estruturados. Formato:\n\nSLIDE 1 (CAPA):\n[título impactante]\n\nSLIDE 2-N:\n[conteúdo do slide]\n\nSLIDE FINAL (CTA):\n[chamada para ação]",
        static_post: "Crie um post estático para Instagram com legenda engajante.",
        reels: "Crie um roteiro para Reels com ganchos visuais e timing.",
        
        // Twitter/X
        tweet: "Crie um tweet impactante e conciso (máximo 280 caracteres).",
        thread: `Crie uma thread viral para Twitter. FORMATO OBRIGATÓRIO:
Retorne APENAS um JSON válido no seguinte formato:
{
  "thread_tweets": [
    { "text": "1/ [hook inicial - máx 270 chars]" },
    { "text": "2/ [desenvolvimento - máx 270 chars]" },
    { "text": "3/ [continuação - máx 270 chars]" },
    { "text": "[último tweet com CTA - máx 270 chars]" }
  ]
}

REGRAS:
- Cada tweet deve ter no MÁXIMO 270 caracteres (deixando espaço para emojis)
- Mínimo 3 tweets, máximo 10 tweets
- Primeiro tweet deve ser um hook poderoso
- Último tweet deve ter CTA ou conclusão
- Use numeração 1/, 2/, 3/ no início de cada tweet
- NÃO inclua explicações, apenas o JSON`,
        x_article: "Crie um artigo para X (Twitter) com formato longo e estruturado.",
        
        // LinkedIn
        linkedin_post: "Crie um post profissional para LinkedIn com storytelling e insights.",
        
        // Newsletter
        newsletter: "Crie uma newsletter envolvente com introdução, corpo e conclusão.",
        
        // YouTube
        youtube_script: "Crie um roteiro completo para YouTube com hook, desenvolvimento e CTA.",
        
        // Legacy support
        post: "Crie um post engajante para redes sociais.",
        carrossel: "Crie um carrossel educativo com slides bem estruturados. Formato:\n\nSLIDE 1 (CAPA):\n[título impactante]\n\nSLIDE 2-N:\n[conteúdo do slide]\n\nSLIDE FINAL (CTA):\n[chamada para ação]",
      };

      const platformTone: Record<string, string> = {
        instagram: "Tom visual, emojis moderados, hashtags relevantes",
        linkedin: "Tom profissional, insights de negócios, sem emojis excessivos",
        twitter: "Tom conciso, provocativo, máximo impacto em poucas palavras",
        tiktok: "Tom jovem, trends, linguagem casual",
      };

      // Build enriched prompt with brand context and STRICT rules for references
      let brandSection = "";
      if (brandContext) {
        brandSection = `
IDENTIDADE DA MARCA:
- Nome: ${brandContext.name || "Não especificado"}
${brandContext.brandVoice ? `- Tom de voz: ${brandContext.brandVoice}` : ""}
${brandContext.values ? `- Valores: ${brandContext.values}` : ""}
${brandContext.keywords?.length ? `- Palavras-chave: ${brandContext.keywords.join(", ")}` : ""}

`;
      }

      // STRICT rules when using references
      const strictReferenceRules = hasInstagramReference ? `
REGRAS ABSOLUTAS PARA REFERÊNCIA INSTAGRAM:
1. Use EXCLUSIVAMENTE o conteúdo da referência Instagram fornecida
2. NÃO invente dados, estatísticas, exemplos ou informações que não estejam nas referências
3. Mantenha o TEMA e ASSUNTO exato da referência original
4. Se for carrossel, use número similar de slides
5. Adapte a linguagem para a plataforma, mas mantenha o conteúdo fiel
6. Se a referência fala de um tema específico, NÃO mude para outro tema
` : "";

      const prompt = `Você é um copywriter especialista em conteúdo para redes sociais.

${formatPrompts[config.format || "post"]}

Plataforma: ${config.platform || "instagram"}
Tom: ${platformTone[config.platform || "instagram"]}

${brandSection}${strictReferenceRules}

CONTEXTO E REFERÊNCIAS:
${context}

REGRAS GERAIS:
- Seja direto e impactante
- Use a linguagem adequada para a plataforma
- Mantenha autenticidade
- NUNCA invente informações que não estejam no contexto
${brandContext?.brandVoice ? `- Mantenha o tom de voz: ${brandContext.brandVoice}` : ""}

Gere o conteúdo agora:`;

      console.log("[generate-content-v2] Generating text with brand context...");

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

      const aiData = await response.json();
      const generatedText = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

      // Special handling for thread format - parse structured response
      if (config.format === 'thread') {
        try {
          // Try to extract JSON from the response
          const jsonMatch = generatedText.match(/\{[\s\S]*"thread_tweets"[\s\S]*\}/);
          if (jsonMatch) {
            const threadData = JSON.parse(jsonMatch[0]);
            if (threadData.thread_tweets && Array.isArray(threadData.thread_tweets)) {
              // Return structured thread with individual tweets
              return new Response(
                JSON.stringify({ 
                  content: generatedText, // Keep raw for backward compatibility
                  thread_tweets: threadData.thread_tweets.map((t: any, i: number) => ({
                    id: `tweet-${i + 1}`,
                    text: t.text || t.content || '',
                    media_urls: t.media_urls || []
                  }))
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          }
          
          // Fallback: parse numbered tweets from text
          const tweetMatches = generatedText.match(/(\d+)[\/\.\)]\s*([^]*?)(?=\n\n\d+[\/\.\)]|\n*$)/g);
          if (tweetMatches && tweetMatches.length > 1) {
            const parsedTweets = tweetMatches.map((match: string, i: number) => {
              const text = match.replace(/^\d+[\/\.\)]\s*/, '').trim();
              return {
                id: `tweet-${i + 1}`,
                text: text.substring(0, 280),
                media_urls: []
              };
            });
            
            return new Response(
              JSON.stringify({ 
                content: generatedText,
                thread_tweets: parsedTweets
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } catch (parseErr) {
          console.log("[generate-content-v2] Thread parsing failed, returning raw text:", parseErr);
        }
      }

      return new Response(
        JSON.stringify({ content: generatedText }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else {
      // Image generation with style matching - using English for better results
      let imagePrompt = `Create a professional, high-quality social media image.

QUALITY REQUIREMENTS:
- Ultra high resolution, 8K quality
- Professional photography or illustration style
- Clean, polished composition
- Vibrant, eye-catching colors
- Modern aesthetic

`;
      let referenceImage: string | null = null;
      let styleDescription = "";
      let briefingText = "";

      // Build prompt from inputs
      for (const input of inputs) {
        if (input.type === "image" && input.imageBase64) {
          referenceImage = input.imageBase64;
          if (input.analysis) {
            // Extract style details from analysis
            const analysis = input.analysis as Record<string, any>;
            if (analysis.generation_prompt) {
              styleDescription += `\nREFERENCE STYLE: ${analysis.generation_prompt}`;
            }
            if (analysis.color_palette) {
              const colors = analysis.color_palette.dominant_colors || [];
              if (colors.length > 0) {
                styleDescription += `\nCOLOR PALETTE: ${colors.join(", ")}`;
              }
            }
            if (analysis.mood_atmosphere) {
              styleDescription += `\nMOOD: ${analysis.mood_atmosphere.overall_mood || ""}`;
            }
          }
        } else if (input.type === "text") {
          briefingText += input.content + " ";
        } else if (input.transcription) {
          briefingText += input.transcription + " ";
        }
      }

      if (briefingText.trim()) {
        imagePrompt += `CONCEPT/BRIEFING:\n${briefingText.trim()}\n\n`;
      }

      // Add brand visual identity
      if (brandContext) {
        imagePrompt += `BRAND VISUAL IDENTITY:\n`;
        if (brandContext.colorPalette?.primary) {
          imagePrompt += `- Primary color: ${brandContext.colorPalette.primary}\n`;
        }
        if (brandContext.colorPalette?.secondary) {
          imagePrompt += `- Secondary color: ${brandContext.colorPalette.secondary}\n`;
        }
        if (brandContext.photographyStyle) {
          imagePrompt += `- Photography style: ${brandContext.photographyStyle}\n`;
        }
        imagePrompt += "\n";
      }

      // Add style description from reference
      if (styleDescription) {
        imagePrompt += `STYLE MATCHING (replicate this exactly):\n${styleDescription}\n\n`;
      }

      // Add config instructions
      if (config.aspectRatio) {
        const aspectRatioMap: Record<string, string> = {
          "1:1": "Square format (1:1 ratio, 1024x1024px)",
          "4:5": "Portrait format (4:5 ratio, 1024x1280px)",
          "9:16": "Vertical/Stories format (9:16 ratio, 1080x1920px)",
          "16:9": "Landscape format (16:9 ratio, 1920x1080px)",
        };
        imagePrompt += `ASPECT RATIO: ${aspectRatioMap[config.aspectRatio] || config.aspectRatio}\n\n`;
      }
      
      // Add negative prompt
      imagePrompt += `AVOID (negative prompt):
- Blurry or low resolution
- Watermarks or logos
- Artificial-looking elements
- Overly saturated colors
- Distorted proportions
`;
      
      if (config.noText) {
        imagePrompt += `- ANY text, letters, numbers, words, typography, or written content
`;
      }
      if (config.preserveFace && referenceImage) {
        imagePrompt += `\nIMPORTANT: Preserve the exact facial features and characteristics of the person in the reference image.\n`;
      }

      // Add strong consistency instructions
      imagePrompt += `
GENERATION RULES:
1. Maintain total fidelity to the described visual style
2. Use ONLY the colors mentioned when specified
3. Preserve the composition and framing of the reference if provided
4. High quality, professional result
5. Clean, modern aesthetic`;

      console.log("[generate-content-v2] Generating image with enhanced prompt:");
      console.log("[generate-content-v2] Prompt length:", imagePrompt.length, "chars");
      console.log("[generate-content-v2] Has reference image:", !!referenceImage);
      console.log("[generate-content-v2] Aspect ratio:", config.aspectRatio || "default");
      console.log("[generate-content-v2] No text:", config.noText);

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
