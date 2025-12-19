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

interface BrandAssets {
  logo_url?: string;
  logo_variations?: string[];
  color_palette?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    text?: string;
  };
  typography?: {
    primary_font?: string;
    secondary_font?: string;
    style?: string;
  };
  visual_style?: {
    photography_style?: string;
    mood?: string;
    recurring_elements?: string[];
  };
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

function formatBrandAssetsForPrompt(brandAssets: BrandAssets): string {
  const parts: string[] = [];
  
  if (brandAssets.color_palette) {
    const colors = Object.entries(brandAssets.color_palette)
      .filter(([_, value]) => value)
      .map(([key, value]) => `${key}: ${value}`)
      .join(", ");
    if (colors) parts.push(`Paleta de cores: ${colors}`);
  }
  
  if (brandAssets.typography) {
    const typo = [];
    if (brandAssets.typography.primary_font) typo.push(`Fonte: ${brandAssets.typography.primary_font}`);
    if (brandAssets.typography.style) typo.push(`Estilo: ${brandAssets.typography.style}`);
    if (typo.length > 0) parts.push(`Tipografia: ${typo.join(", ")}`);
  }
  
  if (brandAssets.visual_style) {
    if (brandAssets.visual_style.photography_style) {
      parts.push(`Estilo fotográfico: ${brandAssets.visual_style.photography_style}`);
    }
    if (brandAssets.visual_style.mood) {
      parts.push(`Mood: ${brandAssets.visual_style.mood}`);
    }
    if (brandAssets.visual_style.recurring_elements?.length) {
      parts.push(`Elementos visuais: ${brandAssets.visual_style.recurring_elements.join(", ")}`);
    }
  }
  
  return parts.join(". ");
}

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
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { 
      prompt, 
      imageReferences, 
      referenceImages, 
      styleAnalysis, 
      userId, 
      clientId,
      brandAssets,
      clientVisualReferences 
    } = await req.json();

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

    // Setup Supabase for logging and fetching brand assets
    const supabaseServiceUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseService = createClient(supabaseServiceUrl, supabaseServiceKey);

    // Fetch brand assets from database if not provided and clientId exists
    let effectiveBrandAssets = brandAssets;
    let clientName = "";
    
    if (!effectiveBrandAssets && clientId) {
      console.log(`[generate-image] Fetching brand assets for client ${clientId}`);
      const { data: clientData } = await supabaseService
        .from("clients")
        .select("name, brand_assets")
        .eq("id", clientId)
        .single();
      
      if (clientData) {
        effectiveBrandAssets = clientData.brand_assets;
        clientName = clientData.name || "";
        console.log(`[generate-image] Found brand assets for client: ${clientName}`);
      }
    }

    // Fetch visual references from database if not provided
    let effectiveVisualRefs = clientVisualReferences || [];
    
    if (effectiveVisualRefs.length === 0 && clientId) {
      console.log(`[generate-image] Fetching visual references for client ${clientId}`);
      const { data: visualRefs } = await supabaseService
        .from("client_visual_references")
        .select("*")
        .eq("client_id", clientId)
        .eq("is_primary", true)
        .limit(4);
      
      if (visualRefs && visualRefs.length > 0) {
        effectiveVisualRefs = visualRefs.map((ref: any) => ({
          url: ref.image_url,
          description: ref.description || ref.title || `Referência ${ref.reference_type}`,
        }));
        console.log(`[generate-image] Found ${effectiveVisualRefs.length} primary visual references`);
      }
    }

    const allRefs: ReferenceImage[] = [
      ...effectiveVisualRefs,
      ...(referenceImages || []), 
      ...(imageReferences || [])
    ];
    const parts: any[] = [];
    let processedImageCount = 0;
    
    // Add logo as first reference if available
    if (effectiveBrandAssets?.logo_url) {
      console.log('[generate-image] Adding brand logo as primary reference');
      try {
        const logoResponse = await fetch(effectiveBrandAssets.logo_url);
        if (logoResponse.ok) {
          const arrayBuffer = await logoResponse.arrayBuffer();
          const base64 = arrayBufferToBase64(arrayBuffer);
          const contentType = logoResponse.headers.get('content-type') || 'image/png';
          parts.push({
            inlineData: { mimeType: contentType, data: base64 }
          });
          processedImageCount++;
        }
      } catch (e) {
        console.warn(`[generate-image] Failed to process logo: ${e}`);
      }
    }
    
    // Add reference images
    if (allRefs.length > 0) {
      console.log(`[generate-image] Processing ${allRefs.length} reference images`);
      
      for (const ref of allRefs.slice(0, 4 - processedImageCount)) {
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
    
    // Build enhanced prompt with brand assets and style analysis
    let enhancedPrompt = prompt;
    let brandContext = "";
    
    // Add brand assets context
    if (effectiveBrandAssets) {
      brandContext = formatBrandAssetsForPrompt(effectiveBrandAssets);
      if (brandContext) {
        console.log('[generate-image] Using brand assets in prompt');
      }
    }
    
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
      
      // Combine brand context with style analysis
      const fullContext = [brandContext, styleContext].filter(Boolean).join("\n");
      
      enhancedPrompt = `IDENTIDADE VISUAL E ESTILO:\n${fullContext}\n\nPEDIDO ESPECÍFICO:\n${prompt}\n\nGere uma imagem que respeite a identidade visual da marca e atenda ao pedido específico.`;
      console.log('[generate-image] Using style analysis + brand context for generation');
    } else if (brandContext) {
      // Only brand assets, no style analysis
      enhancedPrompt = `IDENTIDADE VISUAL DA MARCA:\n${brandContext}\n\nPEDIDO:\n${prompt}\n\nGere uma imagem que respeite a identidade visual descrita.`;
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
    console.log(`[generate-image] Generating with ${GEMINI_MODEL}, ${processedImageCount} reference images, brand assets: ${!!effectiveBrandAssets}`);

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
                supabaseService,
                userId,
                "gpt-image-1",
                "generate-image",
                inputTokens,
                0,
                { clientId, provider: "openai", fallback: true, referenceCount: processedImageCount, hasBrandAssets: !!effectiveBrandAssets }
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
                supabaseService,
                userId,
                "gpt-image-1",
                "generate-image",
                inputTokens,
                0,
                { clientId, provider: "openai", fallback: true, referenceCount: processedImageCount, hasBrandAssets: !!effectiveBrandAssets }
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
        supabaseService,
        userId,
        GEMINI_MODEL,
        "generate-image",
        inputTokens,
        outputTokens,
        { clientId, referenceCount: processedImageCount, hasStyleAnalysis: !!styleAnalysis, hasBrandAssets: !!effectiveBrandAssets }
      );
    }

    console.log(`[generate-image] Success - ${inputTokens + outputTokens} tokens, brand assets: ${!!effectiveBrandAssets}`);

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
