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
    const title = titleMatch ? titleMatch[1].trim() : "Newsletter";

    // Extract all images with their URLs
    const images: Array<{ url: string; alt?: string }> = [];
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?[^>]*>/gi;
    let imgMatch;
    
    while ((imgMatch = imgRegex.exec(html)) !== null) {
      let imgUrl = imgMatch[1];
      const imgAlt = imgMatch[2] || "";
      
      // Skip tracking pixels and tiny images
      if (imgUrl.includes("tracking") || 
          imgUrl.includes("pixel") || 
          imgUrl.includes("1x1") ||
          imgUrl.includes("spacer") ||
          imgUrl.includes("blank.gif") ||
          imgUrl.length < 10) {
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
        imgUrl = urlObj.origin + "/" + imgUrl;
      }
      
      // Skip data URIs and very short URLs
      if (!imgUrl.startsWith("data:") && imgUrl.length > 20) {
        images.push({ url: imgUrl, alt: imgAlt });
      }
    }

    // Extract text content by sections
    // First, remove script and style tags
    let cleanHtml = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '');

    // Try to extract main content sections
    const sections: Array<{ heading?: string; content: string; images: string[] }> = [];
    
    // Extract headings and their following content
    const headingRegex = /<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi;
    const headings: Array<{ tag: string; text: string; index: number }> = [];
    let headingMatch;
    
    while ((headingMatch = headingRegex.exec(cleanHtml)) !== null) {
      const headingText = headingMatch[2]
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (headingText.length > 0) {
        headings.push({
          tag: headingMatch[1],
          text: headingText,
          index: headingMatch.index
        });
      }
    }

    // Extract paragraphs
    const paragraphs: string[] = [];
    const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    let pMatch;
    
    while ((pMatch = pRegex.exec(cleanHtml)) !== null) {
      const pText = pMatch[1]
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (pText.length > 20) { // Skip very short paragraphs
        paragraphs.push(pText);
      }
    }

    // If no paragraphs found, try to extract from divs and tds (common in email newsletters)
    if (paragraphs.length === 0) {
      const divRegex = /<(?:div|td)[^>]*>([\s\S]*?)<\/(?:div|td)>/gi;
      let divMatch;
      
      while ((divMatch = divRegex.exec(cleanHtml)) !== null) {
        const divText = divMatch[1]
          .replace(/<[^>]+>/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        if (divText.length > 50) {
          paragraphs.push(divText);
        }
      }
    }

    // Build structured content
    const content = paragraphs.join('\n\n');

    // Format for carousel with images
    const carouselContent: Array<{
      slideNumber: number;
      text: string;
      imageUrl?: string;
    }> = [];

    // Distribute images across content sections
    const chunkSize = Math.ceil(paragraphs.length / Math.max(images.length, 1));
    
    images.forEach((img, idx) => {
      const startIdx = idx * chunkSize;
      const endIdx = Math.min(startIdx + chunkSize, paragraphs.length);
      const slideText = paragraphs.slice(startIdx, endIdx).join('\n\n');
      
      carouselContent.push({
        slideNumber: idx + 1,
        text: slideText || `Slide ${idx + 1}`,
        imageUrl: img.url
      });
    });

    // If no images, create slides from content only
    if (carouselContent.length === 0 && paragraphs.length > 0) {
      const slidesCount = Math.min(10, Math.ceil(paragraphs.length / 3));
      const paraPerSlide = Math.ceil(paragraphs.length / slidesCount);
      
      for (let i = 0; i < slidesCount; i++) {
        const startIdx = i * paraPerSlide;
        const endIdx = Math.min(startIdx + paraPerSlide, paragraphs.length);
        const slideText = paragraphs.slice(startIdx, endIdx).join('\n\n');
        
        carouselContent.push({
          slideNumber: i + 1,
          text: slideText
        });
      }
    }

    console.log(`Newsletter scraped: ${title}, ${images.length} images, ${paragraphs.length} paragraphs`);

    return new Response(JSON.stringify({
      success: true,
      data: {
        title,
        url,
        images: images.slice(0, 20), // Limit to 20 images
        headings: headings.slice(0, 20),
        content: content.substring(0, 15000), // Limit content size
        paragraphs: paragraphs.slice(0, 50),
        carouselContent: carouselContent.slice(0, 15),
        rawTextLength: content.length,
        imageCount: images.length
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
