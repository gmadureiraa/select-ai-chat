import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Converte URL de imagem para base64
async function urlToBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to fetch image from URL: ${url}, status: ${response.status}`);
      return null;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    console.error(`Error converting URL to base64: ${url}`, error);
    return null;
  }
}

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

    // Processar referências de imagem (novo formato com base64 real)
    const processedReferences: string[] = [];
    
    // Novo formato: referenceImages com base64 já convertido
    if (referenceImages && Array.isArray(referenceImages) && referenceImages.length > 0) {
      console.log(`Processing ${referenceImages.length} reference images (new format)`);
      
      for (const ref of referenceImages.slice(0, 3)) { // Max 3 images
        if (ref.base64) {
          processedReferences.push(ref.base64);
          console.log(`Added base64 reference image${ref.description ? `: ${ref.description}` : ''}`);
        } else if (ref.url) {
          const base64 = await urlToBase64(ref.url);
          if (base64) {
            processedReferences.push(base64);
            console.log(`Converted URL to base64: ${ref.url.substring(0, 50)}...`);
          }
        }
      }
    }
    
    // Fallback: formato antigo (imageReferences com URLs e descrições)
    if (processedReferences.length === 0 && imageReferences && Array.isArray(imageReferences) && imageReferences.length > 0) {
      console.log(`Processing ${imageReferences.length} image references (legacy format)`);
      
      for (const ref of imageReferences.slice(0, 3)) {
        if (ref.url) {
          const base64 = await urlToBase64(ref.url);
          if (base64) {
            processedReferences.push(base64);
            console.log(`Converted legacy URL to base64: ${ref.url.substring(0, 50)}...`);
          }
        }
      }
    }

    console.log(`Generating image with Google AI Studio (Gemini Image) - ${processedReferences.length} references`);

    // Construir conteúdo para Google AI Studio
    const parts: any[] = [];
    
    if (processedReferences.length > 0) {
      // Adicionar texto com instruções
      parts.push({ 
        text: `${prompt}\n\nIMPORTANTE: Use as ${processedReferences.length} imagem(ns) anexada(s) como REFERÊNCIA VISUAL. Inspire-se no estilo, composição, cores e elementos dessas referências para criar uma nova imagem original.` 
      });
      
      // Adicionar cada imagem de referência
      for (const base64 of processedReferences) {
        // Extrair mime type e dados do base64
        const matches = base64.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          parts.push({
            inlineData: {
              mimeType: matches[1],
              data: matches[2]
            }
          });
        }
      }
      
      console.log(`Built multimodal request with ${processedReferences.length} reference images`);
    } else {
      // Formato simples sem referências
      parts.push({ text: prompt });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"]
          }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google AI Studio error:', response.status, errorText);
      
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
    
    // Google AI Studio returns images in candidates[0].content.parts[].inlineData format
    const parts_response = data.candidates?.[0]?.content?.parts || [];
    let imageUrl = null;
    
    for (const part of parts_response) {
      if (part.inlineData) {
        const { mimeType, data: imageData } = part.inlineData;
        imageUrl = `data:${mimeType};base64,${imageData}`;
        break;
      }
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

    console.log(`Image generated successfully with Google AI Studio (${processedReferences.length} references used)`);

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
