import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { url } = await req.json();
    const apifyApiKey = Deno.env.get('APIFY_API_KEY');

    if (!apifyApiKey) {
      throw new Error('APIFY_API_KEY not configured');
    }

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL do Instagram é obrigatória' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate Instagram URL
    const instagramRegex = /^https?:\/\/(www\.)?instagram\.com\/(p|reel)\/[a-zA-Z0-9_-]+\/?/;
    if (!instagramRegex.test(url)) {
      return new Response(
        JSON.stringify({ error: 'URL inválida. Use um link de post ou reel do Instagram.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Extracting Instagram post:', url);

    // Call Apify API with the Instagram scraper
    const apifyResponse = await fetch(
      `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${apifyApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          directUrls: [url],
          resultsType: 'posts',
          resultsLimit: 1,
        }),
      }
    );

    if (!apifyResponse.ok) {
      const errorText = await apifyResponse.text();
      console.error('Apify API error:', apifyResponse.status, errorText);
      return new Response(
        JSON.stringify({ 
          error: 'Erro ao extrair imagens do Instagram. Tente novamente.' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await apifyResponse.json();
    console.log('Apify response:', JSON.stringify(data, null, 2));

    if (!data || data.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'Não foi possível extrair as imagens. O post pode estar privado ou indisponível.' 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const post = data[0];
    const images: string[] = [];
    
    // Extract images from different possible fields
    if (post.displayUrl) {
      images.push(post.displayUrl);
    }
    
    if (post.images && Array.isArray(post.images)) {
      images.push(...post.images);
    }
    
    if (post.imageUrl) {
      images.push(post.imageUrl);
    }

    // Handle carousel posts with multiple images
    if (post.childPosts && Array.isArray(post.childPosts)) {
      for (const child of post.childPosts) {
        if (child.displayUrl) images.push(child.displayUrl);
        if (child.imageUrl) images.push(child.imageUrl);
      }
    }

    // Remove duplicates
    const uniqueImages = [...new Set(images)];

    if (uniqueImages.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'Nenhuma imagem encontrada neste post.' 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Extracted ${uniqueImages.length} images from Instagram post`);

    return new Response(
      JSON.stringify({
        images: uniqueImages,
        caption: post.caption || '',
        imageCount: uniqueImages.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in extract-instagram function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
