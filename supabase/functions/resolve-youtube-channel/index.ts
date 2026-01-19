import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { handle } = await req.json();
    
    if (!handle) {
      return new Response(
        JSON.stringify({ error: 'Handle is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean handle - remove @ if present
    const cleanHandle = handle.replace(/^@/, '').trim();
    console.log(`Resolving YouTube handle: @${cleanHandle}`);
    
    // Fetch the channel page and extract the channel ID from meta tags
    const channelUrl = `https://www.youtube.com/@${cleanHandle}`;
    const response = await fetch(channelUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch channel page: ${response.status}`);
      throw new Error(`Channel not found: ${response.status}`);
    }
    
    const html = await response.text();
    
    // Extract channel ID from various sources in the HTML
    // Method 1: From JSON data in the page
    const channelIdMatch = html.match(/"channelId":"(UC[\w-]{22})"/);
    if (channelIdMatch) {
      console.log(`Found channel ID via JSON: ${channelIdMatch[1]}`);
      return new Response(
        JSON.stringify({ channelId: channelIdMatch[1], handle: cleanHandle }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Method 2: From canonical URL or og:url
    const canonicalMatch = html.match(/youtube\.com\/channel\/(UC[\w-]{22})/);
    if (canonicalMatch) {
      console.log(`Found channel ID via canonical: ${canonicalMatch[1]}`);
      return new Response(
        JSON.stringify({ channelId: canonicalMatch[1], handle: cleanHandle }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Method 3: From itemprop="channelId"
    const itemPropMatch = html.match(/itemprop="channelId"\s+content="(UC[\w-]{22})"/);
    if (itemPropMatch) {
      console.log(`Found channel ID via itemprop: ${itemPropMatch[1]}`);
      return new Response(
        JSON.stringify({ channelId: itemPropMatch[1], handle: cleanHandle }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Method 4: From externalId in page data
    const externalIdMatch = html.match(/"externalId":"(UC[\w-]{22})"/);
    if (externalIdMatch) {
      console.log(`Found channel ID via externalId: ${externalIdMatch[1]}`);
      return new Response(
        JSON.stringify({ channelId: externalIdMatch[1], handle: cleanHandle }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.error("Could not extract channel ID from page");
    throw new Error("Could not extract channel ID from page");
    
  } catch (error) {
    console.error('Error resolving handle:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
