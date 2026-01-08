import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReferenceResult {
  success: boolean;
  title?: string;
  content?: string;
  markdown?: string;
  type?: 'youtube' | 'article' | 'html' | 'newsletter';
  thumbnail?: string;
  images?: string[];
  error?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { url, html } = body;

    console.log('[fetch-reference-content] Processing request:', { url, hasHtml: !!html });

    let result: ReferenceResult;

    // If raw HTML is provided, process it directly
    if (html) {
      result = processHtml(html);
    } else if (url) {
      // Detect URL type and process accordingly
      if (isYoutubeUrl(url)) {
        result = await fetchYoutubeContent(url, supabase, authHeader);
      } else {
        // Try Firecrawl first, then fallback
        result = await fetchWithFirecrawl(url) || await fetchArticleContent(url);
      }
    } else {
      return new Response(JSON.stringify({ error: 'URL or HTML required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[fetch-reference-content] Result:', { 
      success: result.success, 
      type: result.type,
      contentLength: result.content?.length || 0,
      imagesCount: result.images?.length || 0,
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[fetch-reference-content] Error:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function isYoutubeUrl(url: string): boolean {
  return url.includes('youtube.com') || url.includes('youtu.be') || url.includes('ytimg.com');
}

function extractYoutubeVideoId(url: string): string | null {
  const thumbnailMatch = url.match(/ytimg\.com\/(?:an_webp|vi|vi_webp)\/([^\/]+)/);
  if (thumbnailMatch) return thumbnailMatch[1];
  
  const watchMatch = url.match(/youtube\.com\/watch\?v=([^&]+)/);
  if (watchMatch) return watchMatch[1];
  
  const shortMatch = url.match(/youtu\.be\/([^?]+)/);
  if (shortMatch) return shortMatch[1];
  
  const embedMatch = url.match(/youtube\.com\/embed\/([^?]+)/);
  if (embedMatch) return embedMatch[1];
  
  return null;
}

function processHtml(html: string): ReferenceResult {
  try {
    let content = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<\/?(p|div|br|h[1-6]|li|tr)[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    const title = titleMatch?.[1] || h1Match?.[1] || 'Newsletter Content';

    // Extract images from HTML
    const images: string[] = [];
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let match;
    while ((match = imgRegex.exec(html)) !== null) {
      const imgUrl = match[1];
      if (!imgUrl.includes('pixel') && !imgUrl.includes('1x1') && !imgUrl.startsWith('data:')) {
        images.push(imgUrl);
      }
    }

    return {
      success: true,
      title: title.trim(),
      content,
      type: 'newsletter',
      images,
    };
  } catch (error) {
    return {
      success: false,
      error: 'Failed to process HTML',
    };
  }
}

async function fetchWithFirecrawl(url: string): Promise<ReferenceResult | null> {
  const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
  if (!apiKey) {
    console.log('[fetch-reference-content] Firecrawl not configured');
    return null;
  }

  try {
    console.log('[fetch-reference-content] Using Firecrawl for:', url);
    
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown', 'html'],
        onlyMainContent: true,
      }),
    });

    if (!response.ok) {
      console.error('[fetch-reference-content] Firecrawl error:', response.status);
      return null;
    }

    const result = await response.json();
    const data = result.data || result;
    const metadata = data.metadata || {};
    
    // Extract images from HTML
    const images: string[] = [];
    const html = data.html || '';
    
    // Add OG image first
    if (metadata.ogImage) {
      images.push(metadata.ogImage);
    }

    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let match;
    while ((match = imgRegex.exec(html)) !== null) {
      let imgUrl = match[1];
      
      if (imgUrl.includes('pixel') || imgUrl.includes('1x1') || imgUrl.startsWith('data:')) {
        continue;
      }
      
      // Convert relative URLs
      if (imgUrl.startsWith('//')) {
        imgUrl = 'https:' + imgUrl;
      } else if (imgUrl.startsWith('/')) {
        try {
          const baseUrl = new URL(url);
          imgUrl = baseUrl.origin + imgUrl;
        } catch { continue; }
      }
      
      if (imgUrl.startsWith('http') && !images.includes(imgUrl)) {
        images.push(imgUrl);
      }
    }

    console.log('[fetch-reference-content] Firecrawl success:', {
      contentLength: (data.markdown || '').length,
      imagesCount: images.length,
    });

    return {
      success: true,
      title: metadata.title || 'Article',
      content: data.markdown || '',
      markdown: data.markdown || '',
      type: 'article',
      thumbnail: metadata.ogImage || images[0],
      images,
    };
  } catch (error) {
    console.error('[fetch-reference-content] Firecrawl error:', error);
    return null;
  }
}

async function fetchYoutubeContent(
  url: string, 
  supabase: any,
  authHeader: string
): Promise<ReferenceResult> {
  try {
    const videoId = extractYoutubeVideoId(url);
    if (!videoId) {
      console.error('[fetch-reference-content] Could not extract video ID from:', url);
      return {
        success: false,
        error: 'Could not extract YouTube video ID from URL',
      };
    }

    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    console.log('[fetch-reference-content] Extracted video ID:', videoId);

    const { data, error } = await supabase.functions.invoke('extract-youtube', {
      body: { url: videoUrl },
    });

    if (error) {
      console.error('[fetch-reference-content] YouTube extraction error:', error);
      return {
        success: false,
        error: 'Failed to extract YouTube content',
      };
    }

    const thumbnail = data.thumbnailUrl || `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;

    return {
      success: true,
      title: data.title || 'YouTube Video',
      content: data.content || data.transcript || '',
      type: 'youtube',
      thumbnail,
      images: thumbnail ? [thumbnail] : [],
    };
  } catch (error) {
    console.error('[fetch-reference-content] YouTube fetch error:', error);
    return {
      success: false,
      error: 'Failed to fetch YouTube content',
    };
  }
}

async function fetchArticleContent(url: string): Promise<ReferenceResult> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Kaleidos/1.0; +https://kaleidos.ai)',
      },
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to fetch URL: ${response.status}`,
      };
    }

    const html = await response.text();
    
    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
    const title = ogTitleMatch?.[1] || titleMatch?.[1] || 'Article';

    // Extract thumbnail
    const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    const thumbnail = ogImageMatch?.[1] || null;

    // Extract all images (no limit)
    const images: string[] = [];
    if (thumbnail) {
      images.push(thumbnail);
    }

    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let imgMatch;
    while ((imgMatch = imgRegex.exec(html)) !== null) {
      let imgUrl = imgMatch[1];
      
      if (imgUrl.startsWith('//')) {
        imgUrl = 'https:' + imgUrl;
      } else if (imgUrl.startsWith('/')) {
        try {
          const baseUrl = new URL(url);
          imgUrl = baseUrl.origin + imgUrl;
        } catch { continue; }
      }
      
      if (
        !imgUrl.includes('1x1') &&
        !imgUrl.includes('pixel') &&
        !imgUrl.includes('.svg') &&
        !imgUrl.includes('data:image') &&
        imgUrl.startsWith('http') &&
        !images.includes(imgUrl)
      ) {
        images.push(imgUrl);
      }
    }

    // Extract content
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    
    const rawContent = articleMatch?.[1] || mainMatch?.[1] || html;
    
    let content = rawContent
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<\/?(p|div|br|h[1-6]|li|tr)[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();

    // Increased limit: 100k characters
    if (content.length > 100000) {
      content = content.substring(0, 100000) + '...';
    }

    console.log('[fetch-reference-content] Article extracted:', { 
      title: title.trim(), 
      contentLength: content.length,
      imagesCount: images.length,
    });

    return {
      success: true,
      title: title.trim(),
      content,
      type: 'article',
      thumbnail: thumbnail || undefined,
      images,
    };
  } catch (error) {
    console.error('[fetch-reference-content] Article fetch error:', error);
    return {
      success: false,
      error: 'Failed to fetch article content',
    };
  }
}
