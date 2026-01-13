import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RSSItem {
  guid: string;
  title: string;
  link: string;
  description: string;
  pubDate: string;
  content: string;
  imageUrl?: string;
  allImages?: string[];
}

function parseRSSFeed(xml: string): { title: string; items: RSSItem[] } {
  // Extract channel title
  const channelTitle = xml.match(/<channel>[\s\S]*?<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1]?.trim() || 'RSS Feed';
  
  const items: RSSItem[] = [];
  const itemMatches = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
  
  for (const itemXml of itemMatches) {
    const title = itemXml.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1]?.trim() || '';
    const link = itemXml.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1]?.trim() || '';
    const description = itemXml.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)?.[1]?.trim() || '';
    const pubDate = itemXml.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim() || '';
    const guid = itemXml.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i)?.[1]?.trim() || link;
    
    // Try to get full content from content:encoded
    const contentEncoded = itemXml.match(/<content:encoded[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/content:encoded>/i)?.[1]?.trim() || '';
    
    // Try to find image
    let imageUrl = '';
    const mediaContent = itemXml.match(/<media:content[^>]*url="([^"]+)"[^>]*>/i)?.[1];
    const enclosure = itemXml.match(/<enclosure[^>]*url="([^"]+)"[^>]*type="image[^"]*"/i)?.[1];
    const imgTag = (contentEncoded || description).match(/<img[^>]*src="([^"]+)"[^>]*>/i)?.[1];
    imageUrl = mediaContent || enclosure || imgTag || '';
    
    // Extract ALL images from content before converting
    const allImages: string[] = [];
    const rawContent = contentEncoded || description;
    const imgMatches = rawContent.matchAll(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi);
    for (const match of imgMatches) {
      if (match[1] && !allImages.includes(match[1])) {
        allImages.push(match[1]);
      }
    }
    
    // Also check for data-src (lazy loading)
    const lazySrcMatches = rawContent.matchAll(/data-src=["']([^"']+)["']/gi);
    for (const match of lazySrcMatches) {
      if (match[1] && !allImages.includes(match[1])) {
        allImages.push(match[1]);
      }
    }
    
    // Clean HTML from description for preview
    const cleanDescription = description
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .substring(0, 300);
    
    // Convert content to markdown-like format with IMAGES preserved
    const content = (contentEncoded || description)
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      // Convert images to markdown BEFORE removing other tags
      .replace(/<figure[^>]*>[\s\S]*?<img[^>]*src=["']([^"']+)["'][^>]*>[\s\S]*?<figcaption[^>]*>([\s\S]*?)<\/figcaption>[\s\S]*?<\/figure>/gi, '\n\n![$2]($1)\n\n')
      .replace(/<img[^>]*src=["']([^"']+)["'][^>]*alt=["']([^"']*)["'][^>]*>/gi, '\n\n![$2]($1)\n\n')
      .replace(/<img[^>]*alt=["']([^"']*)["'][^>]*src=["']([^"']+)["'][^>]*>/gi, '\n\n![$1]($2)\n\n')
      .replace(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi, '\n\n![]($1)\n\n')
      // Headings
      .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n\n# $1\n\n')
      .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n\n## $1\n\n')
      .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n\n### $1\n\n')
      .replace(/<h[4-6][^>]*>([\s\S]*?)<\/h[4-6]>/gi, '\n\n#### $1\n\n')
      // Blockquotes
      .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, '\n\n> $1\n\n')
      // Horizontal rules
      .replace(/<hr[^>]*>/gi, '\n\n---\n\n')
      // Line breaks - double br = paragraph, single = line break with 2 spaces
      .replace(/<br\s*\/?>\s*<br\s*\/?>/gi, '\n\n')
      .replace(/<br\s*\/?>/gi, '  \n')
      // Paragraphs
      .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<p[^>]*>/gi, '')
      // Divs as paragraph separators
      .replace(/<\/div>\s*<div[^>]*>/gi, '\n\n')
      .replace(/<div[^>]*>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      // Lists
      .replace(/<li[^>]*>/gi, '• ')
      .replace(/<\/li>/gi, '\n')
      .replace(/<\/?[ou]l[^>]*>/gi, '\n')
      // Links
      .replace(/<a[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
      // Bold and italic
      .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
      .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**')
      .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*')
      .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*')
      // Code
      .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
      .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '\n\n```\n$1\n```\n\n')
      // Remove remaining tags
      .replace(/<[^>]+>/g, '')
      // Decode HTML entities
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&rsquo;/g, "'")
      .replace(/&lsquo;/g, "'")
      .replace(/&rdquo;/g, '"')
      .replace(/&ldquo;/g, '"')
      .replace(/&mdash;/g, '—')
      .replace(/&ndash;/g, '–')
      .replace(/&hellip;/g, '...')
      // Clean up extra whitespace but preserve paragraph breaks
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .trim();
    
    // Use first extracted image or fall back to media/enclosure
    const finalImageUrl = imageUrl || allImages[0] || '';
    
    items.push({
      guid,
      title,
      link,
      description: cleanDescription,
      pubDate,
      content,
      imageUrl: finalImageUrl,
      allImages
    });
  }
  
  return { title: channelTitle, items };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { rssUrl, limit = 20 } = await req.json();
    
    if (!rssUrl) {
      return new Response(
        JSON.stringify({ error: 'RSS URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching RSS feed: ${rssUrl}`);
    
    const response = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Kaleidos/1.0; +https://kaleidos.app)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch RSS: ${response.status} ${response.statusText}`);
    }
    
    const xml = await response.text();
    const { title: feedTitle, items } = parseRSSFeed(xml);
    
    console.log(`Parsed ${items.length} items from feed "${feedTitle}"`);
    
    return new Response(
      JSON.stringify({
        success: true,
        feedTitle,
        items: items.slice(0, limit),
        totalItems: items.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error fetching RSS feed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
