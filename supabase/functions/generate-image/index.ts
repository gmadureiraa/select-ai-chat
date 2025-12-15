import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReferenceImage {
  url?: string;
  base64?: string;
  description?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, imageReferences, referenceImages } = await req.json();

    if (!prompt || typeof prompt !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Prompt is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_AI_STUDIO_API_KEY');
    if (!GOOGLE_API_KEY) {
      console.error('GOOGLE_AI_STUDIO_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Build parts for Gemini API
    const parts: any[] = [{ text: prompt }];
    
    // Process reference images
    const allRefs = [...(referenceImages || []), ...(imageReferences || [])];
    
    if (allRefs.length > 0) {
      console.log(`Processing ${allRefs.length} reference images`);
      
      for (const ref of allRefs.slice(0, 3)) {
        const imageData = ref.base64 || ref.url;
        if (imageData) {
          // Handle base64 data
          if (imageData.startsWith('data:')) {
            const matches = imageData.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
              parts.push({
                inline_data: {
                  mime_type: matches[1],
                  data: matches[2]
                }
              });
              console.log(`Added base64 reference image${ref.description ? `: ${ref.description}` : ''}`);
            }
          } else if (imageData.startsWith('http')) {
            // Fetch external image and convert to base64
            try {
              const imgResponse = await fetch(imageData);
              if (imgResponse.ok) {
                const arrayBuffer = await imgResponse.arrayBuffer();
                const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
                const contentType = imgResponse.headers.get('content-type') || 'image/jpeg';
                parts.push({
                  inline_data: {
                    mime_type: contentType,
                    data: base64
                  }
                });
                console.log(`Added URL reference image${ref.description ? `: ${ref.description}` : ''}`);
              }
            } catch (e) {
              console.warn(`Failed to fetch reference image: ${e}`);
            }
          }
        }
      }
    }

    console.log(`Generating image with Google Gemini (gemini-2.0-flash-preview-image-generation)`);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: parts
            }
          ],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"]
          }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Gemini API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições atingido. Tente novamente em alguns instantes.' }),
          { 
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Erro ao gerar imagem' }),
        { 
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const data = await response.json();
    
    // Extract image from Gemini response format
    const candidates = data.candidates || [];
    let imageUrl = null;
    
    for (const candidate of candidates) {
      const content = candidate.content || {};
      const responseParts = content.parts || [];
      
      for (const part of responseParts) {
        if (part.inlineData) {
          const mimeType = part.inlineData.mimeType || 'image/png';
          const base64Data = part.inlineData.data;
          imageUrl = `data:${mimeType};base64,${base64Data}`;
          break;
        }
      }
      if (imageUrl) break;
    }

    if (!imageUrl) {
      console.error('No image in response:', JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: 'Nenhuma imagem foi gerada' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`Image generated successfully`);

    return new Response(
      JSON.stringify({ imageUrl }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in generate-image function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido ao gerar imagem'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
