import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  return url.includes('youtube.com') || url.includes('youtu.be');
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
    // Call the existing extract-youtube function
    const { data, error } = await supabase.functions.invoke('extract-youtube', {
      body: { url },
    });

    if (error) {
      console.error('[fetch-reference-content] YouTube extraction error:', error);
      return {
        success: false,
        error: 'Failed to extract YouTube content',
      };
    }

    return {
      success: true,
      title: data.title || 'YouTube Video',
      content: data.content || data.transcript || '',
      type: 'youtube',
      thumbnail: data.thumbnailUrl,
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

    return {
      success: true,
      title: title.trim(),
      content,
      type: 'article',
    };
  } catch (error) {
    console.error('[fetch-reference-content] Article fetch error:', error);
    return {
      success: false,
      error: 'Failed to fetch article content',
    };
  }
}
