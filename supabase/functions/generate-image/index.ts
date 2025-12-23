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
  // New expanded structure
  logos?: {
    primary?: string;
    negative?: string;
    alternative?: string;
    favicon?: string;
  };
  colors?: {
    primary?: { color?: string; textColor?: string };
    secondary?: { color?: string; textColor?: string };
    accent?: { color?: string; textColor?: string };
    surfaces?: { background?: string; card?: string; border?: string };
    text?: { primary?: string; muted?: string };
    buttons?: { primary?: string; secondary?: string };
  };
  typography?: {
    sans?: string;
    serif?: string;
    mono?: string;
  };
  photographyStyle?: {
    description?: string;
    referenceImages?: string[];
  };
  // Legacy fields for backward compatibility
  logo_url?: string;
  logo_variations?: string[];
  color_palette?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    text?: string;
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

// Convert storage paths to full public URLs
function getPublicImageUrl(imagePath: string, supabaseUrl: string): string {
  if (!imagePath) return "";
  
  // Already a full URL
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }
  
  // Already a data URL
  if (imagePath.startsWith("data:")) {
    return imagePath;
  }
  
  // Storage path - convert to public URL
  return `${supabaseUrl}/storage/v1/object/public/client-files/${imagePath}`;
}

function formatBrandAssetsForPrompt(brandAssets: BrandAssets): string {
  const parts: string[] = [];
  
  // New structure - colors
  if (brandAssets.colors?.primary?.color) {
    parts.push(`Cor primária: ${brandAssets.colors.primary.color}`);
  }
  if (brandAssets.colors?.secondary?.color) {
    parts.push(`Cor secundária: ${brandAssets.colors.secondary.color}`);
  }
  if (brandAssets.colors?.accent?.color) {
    parts.push(`Cor de destaque: ${brandAssets.colors.accent.color}`);
  }
  if (brandAssets.colors?.surfaces?.background) {
    parts.push(`Fundo: ${brandAssets.colors.surfaces.background}`);
  }
  
  // New structure - typography
  if (brandAssets.typography?.sans) {
    parts.push(`Fonte sans-serif: ${brandAssets.typography.sans}`);
  }
  if (brandAssets.typography?.serif) {
    parts.push(`Fonte serifada: ${brandAssets.typography.serif}`);
  }
  
  // New structure - photography style
  if (brandAssets.photographyStyle?.description) {
    parts.push(`Estilo fotográfico: ${brandAssets.photographyStyle.description}`);
  }
  
  // Legacy fallback - color_palette
  if (parts.length === 0 && brandAssets.color_palette) {
    const colors = Object.entries(brandAssets.color_palette)
      .filter(([_, value]) => value)
      .map(([key, value]) => `${key}: ${value}`)
      .join(", ");
    if (colors) parts.push(`Paleta de cores: ${colors}`);
  }
  
  // Legacy fallback - visual_style
  if (brandAssets.visual_style) {
    if (brandAssets.visual_style.photography_style && !brandAssets.photographyStyle?.description) {
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

// Get logo URL with intelligent selection
function getLogoUrl(brandAssets: BrandAssets, prompt: string): string | undefined {
  // Check if prompt mentions dark background
  const isDarkContext = /escuro|dark|noite|preto|black/i.test(prompt);
  
  // Prefer negative logo for dark contexts
  if (isDarkContext && brandAssets.logos?.negative) {
    return brandAssets.logos.negative;
  }
  
  // Use new structure first
  if (brandAssets.logos?.primary) {
    return brandAssets.logos.primary;
  }
  
  // Legacy fallback
  return brandAssets.logo_url;
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
      clientVisualReferences,
      imageFormat,
      formatInstructions,
      aspectRatio,
      templateName
    } = await req.json();
    
    console.log(`[generate-image] Request - format: ${imageFormat}, template: ${templateName}, aspectRatio: ${aspectRatio}`);

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
      const { data: visualRefs, error: visualRefsError } = await supabaseService
        .from("client_visual_references")
        .select("*")
        .eq("client_id", clientId)
        .order("is_primary", { ascending: false })  // Primary first, but include all
        .limit(10);
      
      if (visualRefsError) {
        console.error(`[generate-image] Error fetching visual refs:`, visualRefsError);
      }
      
      if (visualRefs && visualRefs.length > 0) {
        effectiveVisualRefs = visualRefs.map((ref: any) => ({
          url: getPublicImageUrl(ref.image_url, supabaseUrl),  // Convert to public URL
          description: ref.description || ref.title || `Referência ${ref.reference_type}`,
          isPrimary: ref.is_primary,
        }));
        console.log(`[generate-image] Found ${effectiveVisualRefs.length} visual references (URLs converted)`);
        console.log(`[generate-image] Reference URLs:`, effectiveVisualRefs.map((r: any) => r.url.substring(0, 80)));
      }
    }

    const allRefs: ReferenceImage[] = [
      ...effectiveVisualRefs,
      ...(referenceImages || []), 
      ...(imageReferences || [])
    ];
    const parts: any[] = [];
    let processedImageCount = 0;
    
    // Add logo as first reference if available (using intelligent selection)
    let rawLogoUrl = effectiveBrandAssets ? getLogoUrl(effectiveBrandAssets, prompt) : undefined;
    const logoUrl = rawLogoUrl ? getPublicImageUrl(rawLogoUrl, supabaseUrl) : undefined;
    
    if (logoUrl) {
      console.log('[generate-image] Adding brand logo as primary reference:', logoUrl.substring(0, 100));
      try {
        const logoResponse = await fetch(logoUrl);
        if (logoResponse.ok) {
          const arrayBuffer = await logoResponse.arrayBuffer();
          const base64 = arrayBufferToBase64(arrayBuffer);
          const contentType = logoResponse.headers.get('content-type') || 'image/png';
          parts.push({
            inlineData: { mimeType: contentType, data: base64 }
          });
          processedImageCount++;
          console.log('[generate-image] Logo added successfully');
        } else {
          console.warn(`[generate-image] Failed to fetch logo: ${logoResponse.status}`);
        }
      } catch (e) {
        console.warn(`[generate-image] Failed to process logo: ${e}`);
      }
    }
    
    // Add reference images (increased limit to 8 for better style matching)
    if (allRefs.length > 0) {
      console.log(`[generate-image] Processing ${allRefs.length} reference images (max 8 after logo)`);
      
      for (const ref of allRefs.slice(0, 8 - processedImageCount)) {
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
                console.log(`[generate-image] Added data URL reference`);
              }
            } else if (imageData.startsWith('http')) {
              console.log(`[generate-image] Fetching: ${imageData.substring(0, 80)}...`);
              const imgResponse = await fetch(imageData);
              if (imgResponse.ok) {
                const arrayBuffer = await imgResponse.arrayBuffer();
                const base64 = arrayBufferToBase64(arrayBuffer);
                const contentType = imgResponse.headers.get('content-type') || 'image/jpeg';
                parts.push({
                  inlineData: { mimeType: contentType, data: base64 }
                });
                processedImageCount++;
                console.log(`[generate-image] Added HTTP reference (${contentType})`);
              } else {
                console.warn(`[generate-image] Failed to fetch image: ${imgResponse.status} - ${imageData.substring(0, 80)}`);
              }
            } else {
              console.warn(`[generate-image] Unknown image format: ${imageData.substring(0, 50)}`);
            }
          } catch (e) {
            console.warn(`[generate-image] Failed to process reference image: ${e}`);
          }
        }
      }
    }
    
    console.log(`[generate-image] Total images added to request: ${processedImageCount}`);
    
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
    
    // Build format-specific instructions
    let formatContext = "";
    if (formatInstructions) {
      formatContext = `=== INSTRUÇÕES DO FORMATO (${imageFormat || templateName || 'imagem'}) ===\n${formatInstructions}\n`;
      console.log('[generate-image] Using format instructions for:', imageFormat || templateName);
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
      
      // Combine format + brand context + style analysis
      const fullContext = [formatContext, brandContext, styleContext].filter(Boolean).join("\n\n");
      
      enhancedPrompt = `${fullContext}\n\n=== PEDIDO ESPECÍFICO ===\n${prompt}\n\nGere uma imagem que siga as instruções do formato, respeite a identidade visual da marca e atenda ao pedido específico.`;
      console.log('[generate-image] Using style analysis + brand context + format instructions');
    } else if (processedImageCount > 0) {
      // CRITICAL: When we have reference images, use style transfer prompt format
      // Per Gemini docs: "Transform the provided photograph into the artistic style of [reference]"
      const refDescriptions = allRefs.filter(r => r.description).map(r => r.description).join(", ");
      
      enhancedPrompt = `${formatContext}
=== TRANSFERÊNCIA DE ESTILO - INSTRUÇÃO CRÍTICA ===

Você recebeu ${processedImageCount} imagens de referência visual. Sua tarefa é criar uma NOVA imagem sobre o tema "${prompt}" que pareça ter sido feita pelo MESMO DESIGNER/ARTISTA das referências.

ANALISE AS REFERÊNCIAS E REPLIQUE EXATAMENTE:
1. PALETA DE CORES: Use exatamente as mesmas cores dominantes (observe tons, saturação, contraste)
2. ESTILO GRÁFICO: Copie o estilo de ilustração/fotografia (halftone, flat design, neon, etc.)
3. TEXTURAS E EFEITOS: Reproduza efeitos visuais (gradientes, sombras, brilhos, ruído)
4. TIPOGRAFIA: Se houver texto nas refs, use estilo similar (bold, serifada, etc.)
5. COMPOSIÇÃO: Mantenha padrões de layout e hierarquia visual
6. ATMOSFERA: Preserve o mood e a energia visual das referências

${brandContext ? `=== IDENTIDADE DA MARCA ===\n${brandContext}\n` : ''}
${refDescriptions ? `CONTEXTO DAS REFERÊNCIAS: ${refDescriptions}\n` : ''}

=== CONTEÚDO A CRIAR ===
${prompt}

RESULTADO: Uma imagem NOVA sobre "${prompt}" que seja VISUALMENTE CONSISTENTE com o estilo das referências. Quem vir a imagem deve acreditar que foi feita pelo mesmo designer.`;

      console.log('[generate-image] Using style transfer prompt with', processedImageCount, 'references + format instructions');
    } else if (formatContext || brandContext) {
      // Format and/or brand assets, no reference images
      const context = [formatContext, brandContext].filter(Boolean).join("\n\n");
      enhancedPrompt = `${context}\n\n=== CONTEÚDO A CRIAR ===\n${prompt}\n\nGere uma imagem profissional seguindo as instruções acima.`;
    }
    
    console.log('[generate-image] Final prompt (first 500 chars):', enhancedPrompt.substring(0, 500));
    
    parts.push({ text: enhancedPrompt });

    // Use the correct Nano Banana model (gemini-2.5-flash is the image generation model)
    const GEMINI_MODEL = "gemini-2.5-flash-preview-image-generation";
    console.log(`[generate-image] Generating with ${GEMINI_MODEL}, ${processedImageCount} reference images, brand assets: ${!!effectiveBrandAssets}, logo: ${!!logoUrl}`);

    // Build the request with images FIRST, then text prompt (per Gemini documentation)
    // For image editing/style transfer, images should come before the text instruction
    const orderedParts = [
      ...parts.filter((p: any) => p.inlineData), // Images first
      ...parts.filter((p: any) => p.text)        // Text prompt last
    ];
    
    console.log(`[generate-image] Request parts order: ${orderedParts.length} parts (${orderedParts.filter((p: any) => p.inlineData).length} images + ${orderedParts.filter((p: any) => p.text).length} text)`);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: orderedParts }],
          generationConfig: { 
            responseModalities: ["TEXT", "IMAGE"],
            ...(aspectRatio && {
              imageConfig: { 
                aspectRatio: aspectRatio // "1:1", "16:9", "9:16", etc.
              }
            })
          }
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
