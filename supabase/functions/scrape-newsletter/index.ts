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

    console.log("Scraping newsletter:", url);

    // Fetch newsletter content
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch newsletter: ${response.statusText}`);
    }

    const html = await response.text();
    
    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    let title = titleMatch ? titleMatch[1].trim() : "Newsletter";
    
    // Also try og:title
    const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
    if (ogTitleMatch) {
      title = ogTitleMatch[1].trim();
    }

    // Extract all images with their URLs - improved regex
    const images: Array<{ url: string; alt?: string }> = [];
    
    // Multiple patterns to catch different image formats
    const imgPatterns = [
      /<img[^>]+src=["']([^"']+)["'][^>]*>/gi,
      /<img[^>]+data-src=["']([^"']+)["'][^>]*>/gi,
      /background-image:\s*url\(["']?([^"')]+)["']?\)/gi,
      /<source[^>]+srcset=["']([^"'\s]+)/gi,
    ];
    
    for (const pattern of imgPatterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        let imgUrl = match[1];
        
        // Skip tracking pixels, tiny images, and common non-content images
        if (imgUrl.includes("tracking") || 
            imgUrl.includes("pixel") || 
            imgUrl.includes("1x1") ||
            imgUrl.includes("spacer") ||
            imgUrl.includes("blank.gif") ||
            imgUrl.includes("beacon") ||
            imgUrl.includes("open.gif") ||
            imgUrl.includes("logo") ||
            imgUrl.includes("icon") ||
            imgUrl.length < 15) {
          continue;
        }
        
        // Convert relative URLs to absolute
        if (imgUrl.startsWith("//")) {
          imgUrl = "https:" + imgUrl;
        } else if (imgUrl.startsWith("/")) {
          const urlObj = new URL(url);
          imgUrl = urlObj.origin + imgUrl;
        } else if (!imgUrl.startsWith("http")) {
          const urlObj = new URL(url);
          const pathParts = urlObj.pathname.split("/");
          pathParts.pop();
          imgUrl = urlObj.origin + pathParts.join("/") + "/" + imgUrl;
        }
        
        // Skip data URIs and duplicates
        if (!imgUrl.startsWith("data:") && imgUrl.length > 20) {
          const exists = images.some(img => img.url === imgUrl);
          if (!exists) {
            // Try to extract alt text
            const altMatch = html.match(new RegExp(`<img[^>]*src=["']${imgUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*alt=["']([^"']*)["']`, 'i'));
            images.push({ 
              url: imgUrl, 
              alt: altMatch ? altMatch[1] : undefined 
            });
          }
        }
      }
    }

    console.log(`Found ${images.length} images`);

    // Remove script, style, and comments
    let cleanHtml = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '');

    // Extract headings
    const headings: Array<{ tag: string; text: string }> = [];
    const headingRegex = /<(h[1-3])[^>]*>([\s\S]*?)<\/\1>/gi;
    let headingMatch;
    
    while ((headingMatch = headingRegex.exec(cleanHtml)) !== null) {
      const headingText = headingMatch[2]
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (headingText.length > 3 && headingText.length < 200) {
        headings.push({
          tag: headingMatch[1],
          text: headingText
        });
      }
    }

    // Extract paragraphs
    const paragraphs: string[] = [];
    const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    let pMatch;
    
    while ((pMatch = pRegex.exec(cleanHtml)) !== null) {
      const pText = pMatch[1]
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
      if (pText.length > 30) {
        paragraphs.push(pText);
      }
    }

    // If few paragraphs, also extract from divs and tds
    if (paragraphs.length < 5) {
      const divRegex = /<(?:div|td)[^>]*class=["'][^"']*(?:content|body|text|article|post)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|td)>/gi;
      let divMatch;
      
      while ((divMatch = divRegex.exec(cleanHtml)) !== null) {
        const divText = divMatch[1]
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (divText.length > 50 && !paragraphs.includes(divText)) {
          paragraphs.push(divText);
        }
      }
    }

    // Extract blockquotes and highlights
    const highlights: string[] = [];
    const quoteRegex = /<(?:blockquote|strong|b|em)[^>]*>([\s\S]*?)<\/(?:blockquote|strong|b|em)>/gi;
    let quoteMatch;
    
    while ((quoteMatch = quoteRegex.exec(cleanHtml)) !== null) {
      const quoteText = quoteMatch[1]
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (quoteText.length > 20 && quoteText.length < 300) {
        highlights.push(quoteText);
      }
    }

    // Build carousel content - structured approach
    const carouselSlides: Array<{
      slideNumber: number;
      type: 'hook' | 'bridge' | 'content' | 'cta';
      text: string;
      imageUrl?: string;
      heading?: string;
    }> = [];

    // Slide 1: Hook - use first heading or strong paragraph
    const hookText = headings[0]?.text || highlights[0] || paragraphs[0]?.substring(0, 150) || title;
    carouselSlides.push({
      slideNumber: 1,
      type: 'hook',
      text: hookText,
      imageUrl: images[0]?.url,
      heading: "GANCHO"
    });

    // Slide 2: Bridge - context/problem
    const bridgeText = paragraphs[0] || headings[1]?.text || "Contexto da newsletter";
    carouselSlides.push({
      slideNumber: 2,
      type: 'bridge',
      text: bridgeText.substring(0, 300),
      imageUrl: images[1]?.url,
      heading: "PONTE"
    });

    // Slides 3-6: Content - main points
    const contentParagraphs = paragraphs.slice(1, 5);
    contentParagraphs.forEach((para, idx) => {
      carouselSlides.push({
        slideNumber: idx + 3,
        type: 'content',
        text: para.substring(0, 350),
        imageUrl: images[idx + 2]?.url,
        heading: headings[idx + 1]?.text
      });
    });

    // Fill up to 6 content slides if needed
    while (carouselSlides.length < 6 && paragraphs.length > carouselSlides.length - 2) {
      const idx = carouselSlides.length - 2;
      carouselSlides.push({
        slideNumber: carouselSlides.length + 1,
        type: 'content',
        text: paragraphs[idx]?.substring(0, 350) || "",
        imageUrl: images[carouselSlides.length]?.url
      });
    }

    // Slide 7: CTA
    const ctaText = paragraphs[paragraphs.length - 1] || "Acesse o conteúdo completo no link original.";
    carouselSlides.push({
      slideNumber: carouselSlides.length + 1,
      type: 'cta',
      text: ctaText.substring(0, 200),
      heading: "CTA"
    });

    console.log(`Newsletter scraped: ${title}, ${images.length} images, ${paragraphs.length} paragraphs, ${carouselSlides.length} slides`);

    return new Response(JSON.stringify({
      success: true,
      data: {
        title,
        url,
        images: images.slice(0, 25),
        headings: headings.slice(0, 15),
        highlights: highlights.slice(0, 10),
        paragraphs: paragraphs.slice(0, 30),
        carouselSlides,
        stats: {
          imageCount: images.length,
          paragraphCount: paragraphs.length,
          headingCount: headings.length
        }
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error scraping newsletter:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
