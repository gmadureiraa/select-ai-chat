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

    // Combine all reference images
    const allRefs: ReferenceImage[] = [...(referenceImages || []), ...(imageReferences || [])];

    // Build parts for Gemini API
    const parts: any[] = [];
    
    // Add reference images first if available
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
                inlineData: {
                  mimeType: matches[1],
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
                  inlineData: {
                    mimeType: contentType,
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
    
    // Build the prompt with context about reference images
    let enhancedPrompt = prompt;
    if (parts.length > 0) {
      const refDescriptions = allRefs
        .filter(r => r.description)
        .map(r => r.description)
        .join(", ");
      
      if (refDescriptions) {
        enhancedPrompt = `Use as imagens de referência fornecidas como inspiração de estilo (${refDescriptions}). ${prompt}`;
      } else {
        enhancedPrompt = `Use as imagens de referência fornecidas como inspiração de estilo visual. ${prompt}`;
      }
    }
    
    // Add text prompt
    parts.push({ text: enhancedPrompt });

    console.log(`Generating image with Gemini 2.0 Flash (gemini-2.0-flash-exp)`);

    // Use Gemini 2.0 Flash with image generation modality
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GOOGLE_API_KEY}`,
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
      console.error('Gemini API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições atingido. Tente novamente em alguns instantes.' }),
          { 
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      // Try fallback to OpenAI if Gemini fails
      console.log('Trying fallback to OpenAI gpt-image-1...');
      const openaiKey = Deno.env.get('OPENAI_API_KEY');
      if (openaiKey) {
        const openaiResponse = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-image-1',
            prompt: enhancedPrompt,
            n: 1,
            size: '1024x1024',
          }),
        });

        if (openaiResponse.ok) {
          const openaiData = await openaiResponse.json();
          const imageB64 = openaiData.data?.[0]?.b64_json;
          if (imageB64) {
            console.log('Image generated successfully via OpenAI fallback');
            return new Response(
              JSON.stringify({ imageUrl: `data:image/png;base64,${imageB64}` }),
              { 
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              }
            );
          }
        } else {
          const openaiError = await openaiResponse.text();
          console.error('OpenAI fallback error:', openaiError);
        }
      }

      return new Response(
        JSON.stringify({ error: 'Erro ao gerar imagem. Tente novamente.' }),
        { 
          status: 500,
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
      
      // Try OpenAI fallback if no image in Gemini response
      console.log('No image from Gemini, trying OpenAI fallback...');
      const openaiKey = Deno.env.get('OPENAI_API_KEY');
      if (openaiKey) {
        const openaiResponse = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-image-1',
            prompt: enhancedPrompt,
            n: 1,
            size: '1024x1024',
          }),
        });

        if (openaiResponse.ok) {
          const openaiData = await openaiResponse.json();
          const imageB64 = openaiData.data?.[0]?.b64_json;
          if (imageB64) {
            console.log('Image generated successfully via OpenAI fallback');
            return new Response(
              JSON.stringify({ imageUrl: `data:image/png;base64,${imageB64}` }),
              { 
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              }
            );
          }
        }
      }
      
      return new Response(
        JSON.stringify({ error: 'Nenhuma imagem foi gerada. Tente um prompt diferente.' }),
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
