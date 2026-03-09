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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    // Admin client for storage uploads
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { url, clientId, uploadToStorage } = await req.json();
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
    
    console.log('Post keys:', Object.keys(post));
    
    // Extract images from all known Apify field variations
    const imageFields = ['displayUrl', 'display_url', 'imageUrl', 'image_url', 'image', 'thumbnailSrc', 'thumbnail_src', 'previewUrl'];
    for (const field of imageFields) {
      if (post[field] && typeof post[field] === 'string') {
        images.push(post[field]);
      }
    }
    
    // Array fields
    const arrayFields = ['images', 'mediaUrls', 'media_urls'];
    for (const field of arrayFields) {
      if (post[field] && Array.isArray(post[field])) {
        images.push(...post[field].filter((u: unknown) => typeof u === 'string'));
      }
    }

    // Handle carousel/sidecar posts 
    const childFields = ['childPosts', 'sidecarChildren', 'carousel_media', 'carouselMedia'];
    for (const field of childFields) {
      if (post[field] && Array.isArray(post[field])) {
        for (const child of post[field]) {
          for (const imgField of imageFields) {
            if (child[imgField]) images.push(child[imgField]);
          }
        }
      }
    }

    // For video/reel posts, use video thumbnail as fallback
    if (images.length === 0) {
      const videoThumbFields = ['videoUrl', 'video_url'];
      for (const field of videoThumbFields) {
        if (post[field] && typeof post[field] === 'string') {
          // Video posts still have a display image usually
          console.log('Post is a video, no separate image found');
        }
      }
    }

    // Remove duplicates
    const uniqueImages = [...new Set(images)];

    if (uniqueImages.length === 0) {
      console.error('No images found. Full post data:', JSON.stringify(post, null, 2));
      return new Response(
        JSON.stringify({ 
          error: 'Nenhuma imagem encontrada neste post. Pode ser um reel/vídeo sem thumbnail acessível.',
          postKeys: Object.keys(post),
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If uploadToStorage is requested, download and re-upload images to Supabase Storage
    let uploadedPaths: string[] = [];
    
    if (uploadToStorage && clientId) {
      console.log(`Uploading ${uniqueImages.length} images to storage for client ${clientId}`);
      
      for (let i = 0; i < uniqueImages.length; i++) {
        const imageUrl = uniqueImages[i];
        
        try {
          // Download image from Instagram CDN (no CORS on server)
          const imgResponse = await fetch(imageUrl);
          if (!imgResponse.ok) {
            console.warn(`Failed to fetch image ${i}: ${imgResponse.status}`);
            continue;
          }
          
          const arrayBuffer = await imgResponse.arrayBuffer();
          const contentType = imgResponse.headers.get('content-type') || 'image/jpeg';
          const extension = contentType.split('/')[1]?.split(';')[0] || 'jpg';
          const fileName = `instagram-sync/${clientId}/${Date.now()}-${i}.${extension}`;
          
          // Upload to Supabase Storage using service role
          const { error: uploadError } = await supabaseAdmin.storage
            .from('client-files')
            .upload(fileName, arrayBuffer, { 
              contentType,
              upsert: false 
            });
          
          if (uploadError) {
            console.warn(`Upload error for image ${i}:`, uploadError);
            continue;
          }
          
          uploadedPaths.push(fileName);
          console.log(`Uploaded image ${i + 1}/${uniqueImages.length}: ${fileName}`);
        } catch (imgError) {
          console.warn(`Error processing image ${i}:`, imgError);
        }
      }
      
      console.log(`Successfully uploaded ${uploadedPaths.length} of ${uniqueImages.length} images`);
    }

    return new Response(
      JSON.stringify({
        images: uniqueImages,
        uploadedPaths,
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
