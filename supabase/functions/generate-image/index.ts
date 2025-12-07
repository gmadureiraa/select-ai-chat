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

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
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

    console.log(`Generating image with Nano Banana (Gemini 2.5 Flash Image) - ${processedReferences.length} references`);

    // Construir conteúdo multimodal
    let content: any;
    
    if (processedReferences.length > 0) {
      // Formato multimodal com imagens reais como referência
      const contentArray: any[] = [
        { 
          type: "text", 
          text: `${prompt}\n\nIMPORTANTE: Use as ${processedReferences.length} imagem(ns) anexada(s) como REFERÊNCIA VISUAL. Inspire-se no estilo, composição, cores e elementos dessas referências para criar uma nova imagem original.` 
        }
      ];
      
      // Adicionar cada imagem de referência
      for (const base64 of processedReferences) {
        contentArray.push({
          type: "image_url",
          image_url: { url: base64 }
        });
      }
      
      content = contentArray;
      console.log(`Built multimodal request with ${processedReferences.length} reference images`);
    } else {
      // Formato simples sem referências
      content = prompt;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [
          {
            role: "user",
            content: content
          }
        ],
        modalities: ["image", "text"]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições atingido. Tente novamente em alguns instantes.' }),
          { 
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes. Adicione créditos na sua workspace Lovable.' }),
          { 
            status: 402,
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
    
    // Nano Banana returns images in choices[0].message.images[0].image_url.url format
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

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

    console.log(`Image generated successfully with Nano Banana (${processedReferences.length} references used)`);

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
