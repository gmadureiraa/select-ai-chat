import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logAIUsage, estimateTokens } from "../_shared/ai-usage.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function fetchImageAsBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    return btoa(binary);
  } catch (error) {
    console.error("[scrape-research-link] Error fetching image:", error);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, userId } = await req.json();
    
    if (!url) {
      throw new Error("URL is required");
    }

    console.log("[scrape-research-link] Scraping:", url);

    // Fetch website content
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch website: ${response.statusText}`);
    }

    const html = await response.text();
    
    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : url;

    // Extract meta description
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
                      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
    const description = descMatch ? descMatch[1] : "";

    // Extract OG image
    const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    const ogImage = ogImageMatch ? ogImageMatch[1] : null;

    // Extract all images
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    const imageUrls: string[] = [];
    let match;
    while ((match = imgRegex.exec(html)) !== null) {
      let imgUrl = match[1];
      if (imgUrl.startsWith("//")) {
        imgUrl = "https:" + imgUrl;
      } else if (imgUrl.startsWith("/")) {
        const urlObj = new URL(url);
        imgUrl = urlObj.origin + imgUrl;
      } else if (!imgUrl.startsWith("http")) {
        const urlObj = new URL(url);
        imgUrl = urlObj.origin + "/" + imgUrl;
      }
      if (!imgUrl.includes("1x1") && 
          !imgUrl.includes("pixel") && 
          !imgUrl.includes("tracking") &&
          !imgUrl.includes(".svg") &&
          !imgUrl.includes("data:image")) {
        imageUrls.push(imgUrl);
      }
    }

    const filteredImages = imageUrls.slice(0, 10);

    // Extract text content
    let textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();

    textContent = textContent.substring(0, 15000);

    // Transcribe images using Gemini
    let imageTranscriptions = "";
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_AI_STUDIO_API_KEY");
    const MODEL = "gemini-2.5-flash";
    
    if (filteredImages.length > 0 && GOOGLE_API_KEY) {
      console.log(`[scrape-research-link] Transcribing ${filteredImages.length} images...`);
      
      const imagesToTranscribe = filteredImages.slice(0, 5);
      
      for (let i = 0; i < imagesToTranscribe.length; i++) {
        const imgUrl = imagesToTranscribe[i];
        try {
          console.log(`[scrape-research-link] Transcribing image ${i + 1}: ${imgUrl}`);
          
          const imagePrompt = "Descreva esta imagem em detalhes em português. Inclua: 1) Texto visível na imagem, 2) Elementos visuais principais, 3) Cores e estilo, 4) Contexto ou propósito aparente da imagem. Seja conciso mas completo.";
          
          const visionResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GOOGLE_API_KEY}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{
                  parts: [
                    { text: imagePrompt },
                    {
                      inlineData: {
                        mimeType: "image/jpeg",
                        data: await fetchImageAsBase64(imgUrl)
                      }
                    }
                  ]
                }],
                generationConfig: {
                  temperature: 0.2,
                  maxOutputTokens: 500,
                }
              })
            }
          );

          if (visionResponse.ok) {
            const visionData = await visionResponse.json();
            const transcription = visionData.candidates?.[0]?.content?.parts?.[0]?.text || "";
            
            // Accumulate tokens
            totalInputTokens += visionData.usageMetadata?.promptTokenCount || (estimateTokens(imagePrompt) + 258);
            totalOutputTokens += visionData.usageMetadata?.candidatesTokenCount || estimateTokens(transcription);
            
            if (transcription) {
              imageTranscriptions += `\n\n[IMAGEM ${i + 1}]: ${transcription}`;
            }
          }
        } catch (imgError) {
          console.error(`[scrape-research-link] Error transcribing image ${imgUrl}:`, imgError);
        }
      }
    }

    // Log AI usage if images were transcribed
    if (userId && (totalInputTokens > 0 || totalOutputTokens > 0)) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      await logAIUsage(
        supabase,
        userId,
        MODEL,
        "scrape-research-link",
        totalInputTokens,
        totalOutputTokens,
        { url, imagesTranscribed: filteredImages.slice(0, 5).length }
      );
    }

    // Create comprehensive content
    const fullContent = `# ${title}

**URL:** ${url}
${description ? `\n**Descrição:** ${description}` : ""}

---

## Conteúdo Extraído

${textContent}
${imageTranscriptions ? `\n\n---\n\n## Descrição das Imagens${imageTranscriptions}` : ""}`;

    console.log(`[scrape-research-link] Success - ${totalInputTokens + totalOutputTokens} tokens used for images`);

    return new Response(JSON.stringify({ 
      success: true, 
      data: {
        title,
        content: fullContent,
        description,
        thumbnail: ogImage || filteredImages[0] || null,
        images: filteredImages,
        textLength: textContent.length,
        imagesTranscribed: imageTranscriptions ? true : false
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[scrape-research-link] Error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
