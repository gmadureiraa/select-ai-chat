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
        result = await fetchArticleContent(url);
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
      contentLength: result.content?.length || 0 
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
  // Thumbnail URL: https://i.ytimg.com/an_webp/VIDEO_ID/... or https://i.ytimg.com/vi/VIDEO_ID/...
  const thumbnailMatch = url.match(/ytimg\.com\/(?:an_webp|vi|vi_webp)\/([^\/]+)/);
  if (thumbnailMatch) return thumbnailMatch[1];
  
  // Standard URL: https://www.youtube.com/watch?v=VIDEO_ID
  const watchMatch = url.match(/youtube\.com\/watch\?v=([^&]+)/);
  if (watchMatch) return watchMatch[1];
  
  // Short URL: https://youtu.be/VIDEO_ID
  const shortMatch = url.match(/youtu\.be\/([^?]+)/);
  if (shortMatch) return shortMatch[1];
  
  // Embed URL: https://www.youtube.com/embed/VIDEO_ID
  const embedMatch = url.match(/youtube\.com\/embed\/([^?]+)/);
  if (embedMatch) return embedMatch[1];
  
  return null;
}

function processHtml(html: string): ReferenceResult {
  try {
    // Extract text content from HTML, removing tags
    let content = html
      // Remove script and style tags with content
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      // Remove HTML comments
      .replace(/<!--[\s\S]*?-->/g, '')
      // Replace block elements with newlines
      .replace(/<\/?(p|div|br|h[1-6]|li|tr)[^>]*>/gi, '\n')
      // Remove remaining tags
      .replace(/<[^>]+>/g, ' ')
      // Decode HTML entities
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      // Clean up whitespace
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();

    // Try to extract title from HTML
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    const title = titleMatch?.[1] || h1Match?.[1] || 'Newsletter Content';

    return {
      success: true,
      title: title.trim(),
      content,
      type: 'newsletter',
    };
  } catch (error) {
    return {
      success: false,
      error: 'Failed to process HTML',
    };
  }
}

async function fetchYoutubeContent(
  url: string, 
  supabase: any,
  authHeader: string
): Promise<ReferenceResult> {
  try {
    // Extract video ID from various URL formats (including thumbnails)
    const videoId = extractYoutubeVideoId(url);
    if (!videoId) {
      console.error('[fetch-reference-content] Could not extract video ID from:', url);
      return {
        success: false,
        error: 'Could not extract YouTube video ID from URL',
      };
    }

    // Use standard YouTube URL for extraction
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    console.log('[fetch-reference-content] Extracted video ID:', videoId, 'Using URL:', videoUrl);

    // Call the existing extract-youtube function
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

    // Build thumbnail URL if not provided
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

    // Extract og:image as main thumbnail
    const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    const thumbnail = ogImageMatch?.[1] || null;

    // Extract other images from the article
    const images: string[] = [];
    if (thumbnail) {
      images.push(thumbnail);
    }

    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let imgMatch;
    while ((imgMatch = imgRegex.exec(html)) !== null && images.length < 5) {
      let imgUrl = imgMatch[1];
      
      // Normalize relative URLs
      if (imgUrl.startsWith('//')) {
        imgUrl = 'https:' + imgUrl;
      } else if (imgUrl.startsWith('/')) {
        try {
          const baseUrl = new URL(url);
          imgUrl = baseUrl.origin + imgUrl;
        } catch { continue; }
      }
      
      // Filter out tracking pixels, icons, and data URIs
      if (
        !imgUrl.includes('1x1') &&
        !imgUrl.includes('pixel') &&
        !imgUrl.includes('.svg') &&
        !imgUrl.includes('data:image') &&
        !imgUrl.includes('icon') &&
        !imgUrl.includes('logo') &&
        imgUrl.startsWith('http') &&
        !images.includes(imgUrl)
      ) {
        images.push(imgUrl);
      }
    }

    // Try to extract main article content using common patterns
    let content = '';
    
    // Look for article, main, or content divs
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    
    const rawContent = articleMatch?.[1] || mainMatch?.[1] || html;
    
    // Clean HTML to text
    content = rawContent
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

    // Limit content length
    if (content.length > 15000) {
      content = content.substring(0, 15000) + '...';
    }

    console.log('[fetch-reference-content] Article extracted:', { 
      title: title.trim(), 
      thumbnail,
      imagesCount: images.length 
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
