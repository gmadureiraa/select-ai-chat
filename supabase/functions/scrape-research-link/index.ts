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
    const { url } = await req.json();
    
    if (!url) {
      throw new Error("URL is required");
    }

    console.log("Scraping research link:", url);

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

    // Extract all images from the page
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    const imageUrls: string[] = [];
    let match;
    while ((match = imgRegex.exec(html)) !== null) {
      let imgUrl = match[1];
      // Convert relative URLs to absolute
      if (imgUrl.startsWith("//")) {
        imgUrl = "https:" + imgUrl;
      } else if (imgUrl.startsWith("/")) {
        const urlObj = new URL(url);
        imgUrl = urlObj.origin + imgUrl;
      } else if (!imgUrl.startsWith("http")) {
        const urlObj = new URL(url);
        imgUrl = urlObj.origin + "/" + imgUrl;
      }
      // Filter out tiny images, icons, and tracking pixels
      if (!imgUrl.includes("1x1") && 
          !imgUrl.includes("pixel") && 
          !imgUrl.includes("tracking") &&
          !imgUrl.includes(".svg") &&
          !imgUrl.includes("data:image")) {
        imageUrls.push(imgUrl);
      }
    }

    // Limit to first 10 meaningful images
    const filteredImages = imageUrls.slice(0, 10);

    // Extract text content from HTML
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

    // Limit text to 15000 chars
    textContent = textContent.substring(0, 15000);

    // Transcribe images using GPT-4o Vision if we have images
    let imageTranscriptions = "";
    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_AI_STUDIO_API_KEY");
    
    if (filteredImages.length > 0 && GOOGLE_API_KEY) {
      console.log(`Transcribing ${filteredImages.length} images...`);
      
      // Transcribe up to 5 most relevant images
      const imagesToTranscribe = filteredImages.slice(0, 5);
      
      for (let i = 0; i < imagesToTranscribe.length; i++) {
        const imgUrl = imagesToTranscribe[i];
        try {
          console.log(`Transcribing image ${i + 1}: ${imgUrl}`);
          
          const visionResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_API_KEY}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{
                  parts: [
                    {
                      text: "Descreva esta imagem em detalhes em português. Inclua: 1) Texto visível na imagem, 2) Elementos visuais principais, 3) Cores e estilo, 4) Contexto ou propósito aparente da imagem. Seja conciso mas completo."
                    },
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
            if (transcription) {
              imageTranscriptions += `\n\n[IMAGEM ${i + 1}]: ${transcription}`;
            }
          }
        } catch (imgError) {
          console.error(`Error transcribing image ${imgUrl}:`, imgError);
        }
      }
    }

    // Create comprehensive content
    const fullContent = `# ${title}

**URL:** ${url}
${description ? `\n**Descrição:** ${description}` : ""}

---

## Conteúdo Extraído

${textContent}
${imageTranscriptions ? `\n\n---\n\n## Descrição das Imagens${imageTranscriptions}` : ""}`;

    console.log("Website scraped successfully:", title);

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
    console.error("Error scraping website:", error);
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

// Helper function to fetch image and convert to base64
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
    console.error("Error fetching image:", error);
    throw error;
  }
}
