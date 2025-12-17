import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logAIUsage, estimateTokens } from "../_shared/ai-usage.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReferenceImage {
  url?: string;
  base64?: string;
  description?: string;
  styleAnalysis?: any;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  
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
    const { prompt, imageReferences, referenceImages, styleAnalysis, userId, clientId } = await req.json();

    if (!prompt || typeof prompt !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Prompt is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_AI_STUDIO_API_KEY');
    if (!GOOGLE_API_KEY) {
      console.error('[generate-image] GOOGLE_AI_STUDIO_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Setup Supabase for logging
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const allRefs: ReferenceImage[] = [...(referenceImages || []), ...(imageReferences || [])];
    const parts: any[] = [];
    let processedImageCount = 0;
    
    // Add reference images
    if (allRefs.length > 0) {
      console.log(`[generate-image] Processing ${allRefs.length} reference images`);
      
      for (const ref of allRefs.slice(0, 4)) {
        const imageData = ref.base64 || ref.url;
        if (imageData) {
          try {
            if (imageData.startsWith('data:')) {
              const matches = imageData.match(/^data:([^;]+);base64,(.+)$/);
              if (matches) {
                parts.push({
                  inlineData: { mimeType: matches[1], data: matches[2] }
                });
                processedImageCount++;
              }
            } else if (imageData.startsWith('http')) {
              const imgResponse = await fetch(imageData);
              if (imgResponse.ok) {
                const arrayBuffer = await imgResponse.arrayBuffer();
                const base64 = arrayBufferToBase64(arrayBuffer);
                const contentType = imgResponse.headers.get('content-type') || 'image/jpeg';
                parts.push({
                  inlineData: { mimeType: contentType, data: base64 }
                });
                processedImageCount++;
              }
            }
          } catch (e) {
            console.warn(`[generate-image] Failed to process reference image: ${e}`);
          }
        }
      }
    }
    
    // Build enhanced prompt with style analysis
    let enhancedPrompt = prompt;
    
    if (styleAnalysis) {
      const styleSummary = styleAnalysis.style_summary || '';
      const promptTemplate = styleAnalysis.generation_prompt_template || '';
      const visualElements = styleAnalysis.visual_elements || {};
      const recurringElements = styleAnalysis.recurring_elements || [];
      const brandElements = styleAnalysis.brand_elements || {};
      
      let styleContext = promptTemplate || styleSummary;
      
      if (visualElements.photography_style) {
        styleContext += ` Estilo fotográfico: ${visualElements.photography_style}.`;
      }
      if (visualElements.color_palette && visualElements.color_palette.length > 0) {
        styleContext += ` Paleta de cores: ${visualElements.color_palette.join(', ')}.`;
      }
      if (visualElements.lighting) {
        styleContext += ` Iluminação: ${visualElements.lighting}.`;
      }
      if (visualElements.dominant_mood) {
        styleContext += ` Mood: ${visualElements.dominant_mood}.`;
      }
      if (recurringElements.length > 0) {
        styleContext += ` Elementos recorrentes: ${recurringElements.join(', ')}.`;
      }
      if (brandElements.product_presentation) {
        styleContext += ` Apresentação de produtos: ${brandElements.product_presentation}.`;
      }
      
      enhancedPrompt = `ESTILO VISUAL A SEGUIR:\n${styleContext}\n\nPEDIDO ESPECÍFICO:\n${prompt}\n\nGere uma imagem que combine o estilo visual descrito com o pedido específico.`;
      console.log('[generate-image] Using style analysis for generation');
    } else if (processedImageCount > 0) {
      const refDescriptions = allRefs.filter(r => r.description).map(r => r.description).join(", ");
      
      if (refDescriptions) {
        enhancedPrompt = `Analise as imagens de referência fornecidas e capture seu estilo visual. Use esse estilo como base para gerar: ${prompt}.`;
      } else {
        enhancedPrompt = `Observe as imagens de referência fornecidas. Capture o estilo visual e gere uma nova imagem nesse mesmo estilo: ${prompt}`;
      }
    }
    
    parts.push({ text: enhancedPrompt });

    const GEMINI_MODEL = "gemini-2.0-flash-exp";
    console.log(`[generate-image] Generating with ${GEMINI_MODEL}, ${processedImageCount} reference images`);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] }
        }),
      }
    );

    // Estimate tokens for logging
    const inputTokens = estimateTokens(enhancedPrompt) + (processedImageCount * 258);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[generate-image] Gemini API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições atingido. Tente novamente.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Try OpenAI fallback
      console.log('[generate-image] Trying OpenAI fallback...');
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
            // Log OpenAI usage
            if (userId) {
              await logAIUsage(
                supabase,
                userId,
                "gpt-image-1",
                "generate-image",
                inputTokens,
                0,
                { clientId, provider: "openai", fallback: true, referenceCount: processedImageCount }
              );
            }
            
            console.log('[generate-image] Success via OpenAI fallback');
            return new Response(
              JSON.stringify({ imageUrl: `data:image/png;base64,${imageB64}` }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      }

      return new Response(
        JSON.stringify({ error: 'Erro ao gerar imagem. Tente novamente.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    
    // Extract image from response
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
      console.error('[generate-image] No image in response:', JSON.stringify(data).substring(0, 500));
      
      // Try OpenAI fallback
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
            if (userId) {
              await logAIUsage(
                supabase,
                userId,
                "gpt-image-1",
                "generate-image",
                inputTokens,
                0,
                { clientId, provider: "openai", fallback: true, referenceCount: processedImageCount }
              );
            }
            
            console.log('[generate-image] Success via OpenAI fallback');
            return new Response(
              JSON.stringify({ imageUrl: `data:image/png;base64,${imageB64}` }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      }
      
      return new Response(
        JSON.stringify({ error: 'Nenhuma imagem foi gerada. Tente um prompt diferente.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log successful Gemini usage
    const outputTokens = data.usageMetadata?.candidatesTokenCount || 500; // Image generation has fixed token cost
    if (userId) {
      await logAIUsage(
        supabase,
        userId,
        GEMINI_MODEL,
        "generate-image",
        inputTokens,
        outputTokens,
        { clientId, referenceCount: processedImageCount, hasStyleAnalysis: !!styleAnalysis }
      );
    }

    console.log(`[generate-image] Success - ${inputTokens + outputTokens} tokens`);

    return new Response(
      JSON.stringify({ imageUrl }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[generate-image] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido ao gerar imagem'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
