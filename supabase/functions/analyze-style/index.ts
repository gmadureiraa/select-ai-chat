import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to convert array buffer to base64 without stack overflow
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192; // Process in chunks to avoid stack overflow
  
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.slice(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  
  return btoa(binary);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrls } = await req.json();

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return new Response(
        JSON.stringify({ error: 'imageUrls array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_AI_STUDIO_API_KEY');
    if (!GOOGLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Analyzing ${imageUrls.length} reference images for style extraction`);

    // Build parts array with all images
    const parts: any[] = [];
    const imageDescriptions: string[] = [];

    for (let i = 0; i < Math.min(imageUrls.length, 6); i++) {
      const url = imageUrls[i];
      
      try {
        if (url.startsWith('data:')) {
          // Handle base64 data URL
          const matches = url.match(/^data:([^;]+);base64,(.+)$/);
          if (matches) {
            parts.push({
              inlineData: {
                mimeType: matches[1],
                data: matches[2]
              }
            });
            console.log(`Added base64 image ${i + 1}`);
          }
        } else if (url.startsWith('http')) {
          // Fetch external image
          const response = await fetch(url);
          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            const base64 = arrayBufferToBase64(arrayBuffer);
            const contentType = response.headers.get('content-type') || 'image/jpeg';
            parts.push({
              inlineData: {
                mimeType: contentType,
                data: base64
              }
            });
            console.log(`Added URL image ${i + 1}`);
          }
        }
      } catch (e) {
        console.warn(`Failed to process image ${i + 1}:`, e);
      }
    }

    if (parts.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No valid images could be processed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Add analysis prompt
    parts.push({
      text: `Analise estas ${parts.length} imagens de referência para geração de imagens e extraia um JSON estruturado com as características visuais.

RETORNE APENAS O JSON, sem markdown ou explicações:

{
  "style_summary": "Resumo geral do estilo visual em 2-3 frases",
  "visual_elements": {
    "photography_style": "tipo de fotografia (ex: lifestyle, product shot, editorial)",
    "lighting": "descrição da iluminação",
    "color_palette": ["cor1", "cor2", "cor3"],
    "dominant_mood": "atmosfera/mood geral",
    "composition": "tipo de composição comum"
  },
  "recurring_elements": [
    "elemento visual que aparece frequentemente"
  ],
  "brand_elements": {
    "logo_style": "descrição se houver logo visível",
    "typography": "estilo tipográfico se visível",
    "product_presentation": "como produtos são apresentados"
  },
  "technical_specs": {
    "aspect_ratio": "proporção comum",
    "resolution_feel": "alta qualidade, lifestyle, etc",
    "post_processing": "estilo de edição/filtros"
  },
  "generation_prompt_template": "Um template de prompt detalhado para recriar este estilo: [descrição completa incluindo estilo fotográfico, cores, elementos, mood, composição e qualidade técnica]"
}`
    });

    // Call Gemini Vision API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2048,
          }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to analyze images' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Extract JSON from response
    let styleAnalysis;
    try {
      // Try to find JSON in the response
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        styleAnalysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse style analysis:', parseError);
      // Return a basic analysis if parsing fails
      styleAnalysis = {
        style_summary: textContent.substring(0, 500),
        generation_prompt_template: `Imagem no estilo das referências fornecidas: ${textContent.substring(0, 300)}`
      };
    }

    console.log('Style analysis complete');

    return new Response(
      JSON.stringify({ styleAnalysis }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-style function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
