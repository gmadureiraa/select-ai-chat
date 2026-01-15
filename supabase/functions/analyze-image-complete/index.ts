import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { logAIUsage, estimateImageTokens, estimateTokens } from "../_shared/ai-usage.ts";
import { 
  checkWorkspaceTokens, 
  debitWorkspaceTokens, 
  getWorkspaceIdFromUser,
  createInsufficientTokensResponse,
  TOKEN_COSTS 
} from "../_shared/tokens.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const { imageUrl, userId, clientId, workspaceId: providedWorkspaceId } = await req.json();

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: 'imageUrl is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get workspace ID and check tokens
    const workspaceId = providedWorkspaceId || await getWorkspaceIdFromUser(user.id);
    if (!workspaceId) {
      console.error("[analyze-image-complete] Could not determine workspace");
      return new Response(
        JSON.stringify({ error: 'Workspace not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenCost = TOKEN_COSTS.style_analysis;
    const tokenCheck = await checkWorkspaceTokens(workspaceId, tokenCost);
    
    if (!tokenCheck.hasTokens) {
      console.warn(`[analyze-image-complete] Insufficient tokens for workspace ${workspaceId}`);
      return createInsufficientTokensResponse(corsHeaders);
    }

    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_AI_STUDIO_API_KEY');
    if (!GOOGLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[analyze-image-complete] Analyzing image: ${imageUrl.substring(0, 80)}...`);

    const parts: any[] = [];

    // Process the image
    try {
      if (imageUrl.startsWith('data:')) {
        const matches = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          parts.push({
            inlineData: { mimeType: matches[1], data: matches[2] }
          });
        }
      } else if (imageUrl.startsWith('http')) {
        const response = await fetch(imageUrl);
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const base64 = arrayBufferToBase64(arrayBuffer);
          const contentType = response.headers.get('content-type') || 'image/jpeg';
          parts.push({
            inlineData: { mimeType: contentType, data: base64 }
          });
        } else {
          throw new Error(`Failed to fetch image: ${response.status}`);
        }
      } else {
        throw new Error('Invalid image URL format');
      }
    } catch (e) {
      console.error(`[analyze-image-complete] Failed to process image:`, e);
      return new Response(
        JSON.stringify({ error: 'Failed to process image' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Super detailed analysis prompt
    const analysisPrompt = `Analise esta imagem em detalhes extremos e retorne um JSON estruturado completo.

RETORNE APENAS O JSON, sem markdown, sem explicações, sem texto antes ou depois:

{
  "image_description": "Descrição detalhada de TODOS os elementos visuais presentes na imagem, incluindo objetos, pessoas, cenário, ações, texturas e detalhes específicos",
  
  "style": {
    "photography_type": "portrait | landscape | product | lifestyle | editorial | macro | street | studio | aerial | food | fashion | other",
    "art_style": "fotográfico realista | ilustração vetorial | 3D render | flat design | aquarela | óleo | colagem | minimalista | maximalista | abstrato | surrealista | pop art | art nouveau | cyberpunk | vintage | retrô | moderno | clean",
    "visual_treatment": "descrição detalhada de filtros, efeitos, texturas, grãos, vinhetas, saturação, contraste e outros tratamentos aplicados"
  },
  
  "colors": {
    "dominant": ["#hexcode1", "#hexcode2", "#hexcode3"],
    "accent": ["#hexcode4"],
    "palette_type": "monocromático | análogo | complementar | triádico | split-complementar | tetrádico | neutro",
    "mood_from_colors": "warm | cold | vibrant | muted | pastel | neon | earth | metallic | neutral",
    "saturation_level": "alta | média | baixa | dessaturado",
    "contrast_level": "alto | médio | baixo | suave"
  },
  
  "composition": {
    "layout": "centered | rule_of_thirds | golden_ratio | diagonal | symmetrical | asymmetrical | frame_within_frame | leading_lines | radial",
    "focus_point": "descrição exata de onde o olho é direcionado primeiro e elementos secundários",
    "negative_space": "abundante | moderado | mínimo | sem espaço negativo",
    "depth": "flat | shallow | medium | deep",
    "perspective": "frontal | angular | bird_eye | worm_eye | isometric"
  },
  
  "lighting": {
    "type": "natural | studio | neon | ambient | dramatic | soft | hard | backlit | side_lit | rim_light | golden_hour | blue_hour | artificial | mixed",
    "direction": "frontal | lateral_esquerda | lateral_direita | superior | inferior | backlight | difusa | múltiplas fontes",
    "quality": "hard (sombras definidas) | soft (sombras suaves) | dramatic | even | high_key | low_key",
    "color_temperature": "warm | neutral | cold | mixed"
  },
  
  "subjects": [
    {
      "type": "person | object | animal | text | logo | product | landscape_element | abstract_shape",
      "description": "descrição detalhada do elemento incluindo aparência, posição, expressão, vestimenta, textura",
      "position": "foreground | midground | background | left | right | center | corners",
      "prominence": "principal | secundário | terciário | decorativo"
    }
  ],
  
  "text_elements": {
    "has_text": true | false,
    "text_content": "transcrição exata de todo texto visível",
    "typography_style": "serif | sans-serif | display | handwritten | monospace | decorative | bold | light | condensed",
    "text_placement": "overlay | integrated | header | footer | floating | badge",
    "text_effects": "outline | shadow | 3D | gradient | neon | none"
  },
  
  "mood_atmosphere": {
    "primary_mood": "alegre | melancólico | energético | calmo | misterioso | elegante | casual | profissional | dramático | romântico | nostálgico | futurista | rústico | luxuoso | minimalista",
    "emotional_impact": "descrição do sentimento que a imagem evoca",
    "energy_level": "high | medium | low | contemplativo"
  },
  
  "technical_details": {
    "estimated_resolution": "low | medium | high | very_high",
    "aspect_ratio": "1:1 | 16:9 | 9:16 | 4:3 | 3:4 | 4:5 | 2.35:1 | custom",
    "image_quality": "professional | amateur | AI_generated | stock | editorial",
    "post_processing": "minimal | moderate | heavy | artistic"
  },
  
  "generation_prompt": "Um prompt COMPLETO e DETALHADO em português para recriar esta imagem exatamente usando IA generativa. Deve incluir: estilo, composição, cores, iluminação, sujeitos, atmosfera e todos os detalhes técnicos necessários para uma reprodução fiel. Mínimo 100 palavras."
}`;

    parts.push({ text: analysisPrompt });

    const MODEL = "gemini-2.5-flash";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 4096,
          }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[analyze-image-complete] Gemini API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to analyze image' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Get token usage
    const inputTokens = data.usageMetadata?.promptTokenCount || (estimateImageTokens(1) + estimateTokens(analysisPrompt));
    const outputTokens = data.usageMetadata?.candidatesTokenCount || estimateTokens(textContent);

    // Log AI usage
    if (userId) {
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      await logAIUsage(
        supabase,
        userId,
        MODEL,
        "analyze-image-complete",
        inputTokens,
        outputTokens,
        { clientId }
      );
    }
    
    // Extract JSON from response
    let imageAnalysis;
    try {
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        imageAnalysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('[analyze-image-complete] Failed to parse:', parseError);
      console.error('[analyze-image-complete] Raw response:', textContent.substring(0, 1000));
      
      // Create a fallback response
      imageAnalysis = {
        image_description: textContent.substring(0, 500),
        style: { photography_type: "unknown", art_style: "unknown" },
        colors: { dominant: [], accent: [] },
        composition: { layout: "unknown" },
        lighting: { type: "unknown" },
        subjects: [],
        text_elements: { has_text: false },
        mood_atmosphere: { primary_mood: "unknown" },
        generation_prompt: `Recrie esta imagem: ${textContent.substring(0, 300)}`
      };
    }

    // Debit tokens after successful analysis
    const debitResult = await debitWorkspaceTokens(
      workspaceId,
      user.id,
      tokenCost,
      "Análise completa de imagem",
      { clientId }
    );
    
    if (!debitResult.success) {
      console.warn(`[analyze-image-complete] Token debit failed: ${debitResult.error}`);
    }

    console.log(`[analyze-image-complete] Complete - ${inputTokens + outputTokens} tokens, ${tokenCost} debited`);

    return new Response(
      JSON.stringify({ 
        imageAnalysis,
        generationPrompt: imageAnalysis.generation_prompt 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[analyze-image-complete] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
