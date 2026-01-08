import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NewsletterResult {
  success: boolean;
  data?: {
    title: string;
    url: string;
    content: string;
    markdown?: string;
    images: Array<{ url: string; alt?: string }>;
    headings: Array<{ tag: string; text: string }>;
    highlights: string[];
    paragraphs: string[];
    carouselSlides: Array<{
      slideNumber: number;
      type: 'hook' | 'bridge' | 'content' | 'cta';
      text: string;
      imageUrl?: string;
      heading?: string;
    }>;
    stats: {
      imageCount: number;
      paragraphCount: number;
      headingCount: number;
      contentLength: number;
    };
  };
  error?: string;
}

async function scrapeWithFirecrawl(url: string): Promise<NewsletterResult | null> {
  const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
  if (!apiKey) {
    console.log('[scrape-newsletter] Firecrawl not configured, using fallback');
    return null;
  }

  try {
    console.log('[scrape-newsletter] Using Firecrawl for:', url);
    
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown', 'html', 'links'],
        onlyMainContent: false, // Get full newsletter content
        waitFor: 2000, // Wait for dynamic content
      }),
    });

    if (!response.ok) {
      console.error('[scrape-newsletter] Firecrawl API error:', response.status);
      return null;
    }

    const result = await response.json();
    const data = result.data || result;
    
    const markdown = data.markdown || '';
    const html = data.html || '';
    const metadata = data.metadata || {};
    
    // Extract all images from HTML
    const images: Array<{ url: string; alt?: string }> = [];
    const imgPatterns = [
      /<img[^>]+src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?[^>]*>/gi,
      /<img[^>]+alt=["']([^"']*)["'][^>]*src=["']([^"']+)["'][^>]*>/gi,
      /background-image:\s*url\(["']?([^"')]+)["']?\)/gi,
      /<source[^>]+srcset=["']([^"'\s]+)/gi,
    ];

    for (const pattern of imgPatterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        let imgUrl = match[1];
        const alt = match[2] || undefined;
        
        // Skip tracking pixels
        if (imgUrl.includes('tracking') || 
            imgUrl.includes('pixel') || 
            imgUrl.includes('1x1') ||
            imgUrl.includes('spacer') ||
            imgUrl.includes('beacon') ||
            imgUrl.length < 15) {
          continue;
        }
        
        // Convert relative URLs
        if (imgUrl.startsWith('//')) {
          imgUrl = 'https:' + imgUrl;
        } else if (imgUrl.startsWith('/')) {
          try {
            const urlObj = new URL(url);
            imgUrl = urlObj.origin + imgUrl;
          } catch { continue; }
        }
        
        if (!imgUrl.startsWith('data:') && imgUrl.length > 20) {
          const exists = images.some(img => img.url === imgUrl);
          if (!exists) {
            images.push({ url: imgUrl, alt });
          }
        }
      }
    }

    // Extract headings from markdown
    const headings: Array<{ tag: string; text: string }> = [];
    const headingMatches = markdown.matchAll(/^(#{1,3})\s+(.+)$/gm);
    for (const match of headingMatches) {
      const level = match[1].length;
      headings.push({
        tag: `h${level}`,
        text: match[2].trim(),
      });
    }

    // Split markdown into paragraphs
    const paragraphs = markdown
      .split(/\n\n+/)
      .map((p: string) => p.replace(/^#+\s+/, '').trim())
      .filter((p: string) => p.length > 30 && !p.startsWith('![') && !p.startsWith('http'));

    // Extract highlights (bold/italic text)
    const highlights: string[] = [];
    const boldMatches = markdown.matchAll(/\*\*([^*]+)\*\*/g);
    for (const match of boldMatches) {
      if (match[1].length > 20 && match[1].length < 300) {
        highlights.push(match[1]);
      }
    }

    // Build carousel slides
    const carouselSlides = buildCarouselSlides(
      metadata.title || 'Newsletter',
      headings,
      paragraphs,
      highlights,
      images
    );

    console.log('[scrape-newsletter] Firecrawl success:', {
      contentLength: markdown.length,
      images: images.length,
      paragraphs: paragraphs.length,
    });

    return {
      success: true,
      data: {
        title: metadata.title || 'Newsletter',
        url,
        content: markdown,
        markdown,
        images,
        headings,
        highlights,
        paragraphs,
        carouselSlides,
        stats: {
          imageCount: images.length,
          paragraphCount: paragraphs.length,
          headingCount: headings.length,
          contentLength: markdown.length,
        },
      },
    };
  } catch (error) {
    console.error('[scrape-newsletter] Firecrawl error:', error);
    return null;
  }
}

function buildCarouselSlides(
  title: string,
  headings: Array<{ tag: string; text: string }>,
  paragraphs: string[],
  highlights: string[],
  images: Array<{ url: string; alt?: string }>
) {
  const carouselSlides: Array<{
    slideNumber: number;
    type: 'hook' | 'bridge' | 'content' | 'cta';
    text: string;
    imageUrl?: string;
    heading?: string;
  }> = [];

  // Slide 1: Hook
  const hookText = headings[0]?.text || highlights[0] || paragraphs[0]?.substring(0, 150) || title;
  carouselSlides.push({
    slideNumber: 1,
    type: 'hook',
    text: hookText,
    imageUrl: images[0]?.url,
    heading: "GANCHO"
  });

  // Slide 2: Bridge
  const bridgeText = paragraphs[0] || headings[1]?.text || "Contexto da newsletter";
  carouselSlides.push({
    slideNumber: 2,
    type: 'bridge',
    text: bridgeText.substring(0, 300),
    imageUrl: images[1]?.url,
    heading: "PONTE"
  });

  // Slides 3-6: Content
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

  // Fill up to 6 content slides
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

  return carouselSlides;
}

async function scrapeWithRegex(url: string): Promise<NewsletterResult> {
  console.log('[scrape-newsletter] Using regex fallback for:', url);
  
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch newsletter: ${response.statusText}`);
  }

  const html = await response.text();
  
  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  const title = ogTitleMatch?.[1] || titleMatch?.[1]?.trim() || "Newsletter";

  // Extract all images
  const images: Array<{ url: string; alt?: string }> = [];
  const imgPatterns = [
    /<img[^>]+src=["']([^"']+)["'][^>]*>/gi,
    /<img[^>]+data-src=["']([^"']+)["'][^>]*>/gi,
    /background-image:\s*url\(["']?([^"')]+)["']?\)/gi,
  ];
  
  for (const pattern of imgPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      let imgUrl = match[1];
      
      if (imgUrl.includes('tracking') || imgUrl.includes('pixel') || imgUrl.includes('1x1')) {
        continue;
      }
      
      if (imgUrl.startsWith('//')) {
        imgUrl = 'https:' + imgUrl;
      } else if (imgUrl.startsWith('/')) {
        const urlObj = new URL(url);
        imgUrl = urlObj.origin + imgUrl;
      }
      
      if (!imgUrl.startsWith('data:') && imgUrl.length > 20) {
        const exists = images.some(img => img.url === imgUrl);
        if (!exists) {
          images.push({ url: imgUrl });
        }
      }
    }
  }

  // Clean HTML
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
      headings.push({ tag: headingMatch[1], text: headingText });
    }
  }

  // Extract paragraphs (no limit)
  const paragraphs: string[] = [];
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let pMatch;
  
  while ((pMatch = pRegex.exec(cleanHtml)) !== null) {
    const pText = pMatch[1]
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
    if (pText.length > 30) {
      paragraphs.push(pText);
    }
  }

  // Extract highlights
  const highlights: string[] = [];
  const quoteRegex = /<(?:blockquote|strong|b)[^>]*>([\s\S]*?)<\/(?:blockquote|strong|b)>/gi;
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

  // Build full content from paragraphs
  const content = paragraphs.join('\n\n');

  // Build carousel slides
  const carouselSlides = buildCarouselSlides(title, headings, paragraphs, highlights, images);

  return {
    success: true,
    data: {
      title,
      url,
      content,
      images,
      headings,
      highlights,
      paragraphs,
      carouselSlides,
      stats: {
        imageCount: images.length,
        paragraphCount: paragraphs.length,
        headingCount: headings.length,
        contentLength: content.length,
      },
    },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    
    if (!url) {
      throw new Error("URL is required");
    }

    console.log("[scrape-newsletter] Processing:", url);

    // Try Firecrawl first, fallback to regex
    let result = await scrapeWithFirecrawl(url);
    
    if (!result) {
      result = await scrapeWithRegex(url);
    }

    console.log(`[scrape-newsletter] Complete: ${result.data?.stats.imageCount} images, ${result.data?.stats.paragraphCount} paragraphs, ${result.data?.stats.contentLength} chars`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[scrape-newsletter] Error:", error);
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
