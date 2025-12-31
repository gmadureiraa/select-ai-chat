import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logAIUsage, estimateTokens } from "../_shared/ai-usage.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StyleAnalysis {
  style_summary?: string;
  visual_elements?: {
    photography_style?: string;
    lighting?: string;
    color_palette?: string[];
    dominant_mood?: string;
    composition?: string;
  };
  generation_prompt_template?: string;
  technical_specs?: {
    aspect_ratio?: string;
    resolution_feel?: string;
    post_processing?: string;
  };
}

interface ImageSpec {
  scene_description: string;
  style: string;
  colors: string[];
  composition: string;
  mood: string;
  elements: string[];
  technical_details: string;
  final_prompt: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { 
      userPrompt, 
      clientId, 
      styleAnalyses,
      brandAssets,
      imageFormat,
      aspectRatio 
    } = await req.json();

    if (!userPrompt) {
      return new Response(
        JSON.stringify({ error: 'userPrompt is required' }),
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

    // Build style context from analyses
    let styleContext = "";
    if (styleAnalyses && styleAnalyses.length > 0) {
      styleContext = `
## REFERÊNCIAS VISUAIS DO CLIENTE (SIGA ESTES ESTILOS):
${styleAnalyses.map((s: { type: string; analysis: StyleAnalysis }, i: number) => `
### Referência ${i + 1} (${s.type}):
- Estilo: ${s.analysis?.style_summary || 'N/A'}
- Fotografia: ${s.analysis?.visual_elements?.photography_style || 'N/A'}
- Iluminação: ${s.analysis?.visual_elements?.lighting || 'N/A'}
- Cores: ${s.analysis?.visual_elements?.color_palette?.join(', ') || 'N/A'}
- Mood: ${s.analysis?.visual_elements?.dominant_mood || 'N/A'}
- Composição: ${s.analysis?.visual_elements?.composition || 'N/A'}
- Template de prompt: ${s.analysis?.generation_prompt_template || 'N/A'}
`).join('\n')}`;
    }

    // Build brand context
    let brandContext = "";
    if (brandAssets) {
      if (brandAssets.colors?.primary) {
        brandContext += `\nCores da marca: Primária: ${brandAssets.colors.primary}`;
        if (brandAssets.colors.secondary) brandContext += `, Secundária: ${brandAssets.colors.secondary}`;
        if (brandAssets.colors.accent) brandContext += `, Destaque: ${brandAssets.colors.accent}`;
      }
      if (brandAssets.typography?.headingFont) {
        brandContext += `\nTipografia: ${brandAssets.typography.headingFont}`;
      }
      if (brandAssets.photography?.style) {
        brandContext += `\nEstilo fotográfico: ${brandAssets.photography.style}`;
      }
    }

    // Step 1: Analyze the request and create structured spec
    const analyzerPrompt = `Você é um diretor de arte especializado em criar especificações técnicas para geração de imagens.

SOLICITAÇÃO DO USUÁRIO:
"${userPrompt}"
${styleContext}
${brandContext}

FORMATO DA IMAGEM: ${imageFormat || 'quadrada'} (${aspectRatio || '1:1'})

Analise a solicitação e crie uma especificação técnica estruturada para gerar a imagem.

RETORNE APENAS O JSON (sem markdown, sem explicações):
{
  "scene_description": "Descrição detalhada da cena a ser criada",
  "style": "Estilo visual específico (ex: fotografia lifestyle, ilustração flat, etc)",
  "colors": ["cor1", "cor2", "cor3"],
  "composition": "Descrição da composição (rule of thirds, centralizado, etc)",
  "mood": "Atmosfera/mood da imagem",
  "elements": ["elemento1", "elemento2"],
  "technical_details": "Detalhes técnicos (iluminação, profundidade de campo, etc)",
  "final_prompt": "Prompt final otimizado para geração de imagem em inglês, detalhado e técnico"
}`;

    const MODEL = "gemini-2.5-flash";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: analyzerPrompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
          }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[prepare-image] Gemini error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to prepare image spec' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Log AI usage
    const inputTokens = data.usageMetadata?.promptTokenCount || estimateTokens(analyzerPrompt);
    const outputTokens = data.usageMetadata?.candidatesTokenCount || estimateTokens(textContent);

    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    await logAIUsage(
      supabase,
      user.id,
      MODEL,
      "prepare-image-generation",
      inputTokens,
      outputTokens,
      { clientId, userPrompt: userPrompt.substring(0, 100) }
    );

    // Parse the JSON spec
    let imageSpec: ImageSpec;
    try {
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        imageSpec = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found');
      }
    } catch (e) {
      console.warn('[prepare-image] Failed to parse JSON, using fallback');
      imageSpec = {
        scene_description: userPrompt,
        style: "professional photography",
        colors: [],
        composition: "centered",
        mood: "professional",
        elements: [],
        technical_details: "high quality, detailed",
        final_prompt: `High quality professional image: ${userPrompt}. Ultra detailed, 8k resolution.`
      };
    }

    // Build enhanced prompt with style references
    let enhancedPrompt = imageSpec.final_prompt;
    
    // Add format-specific instructions
    if (aspectRatio) {
      enhancedPrompt += ` Aspect ratio: ${aspectRatio}.`;
    }

    console.log('[prepare-image] Generated spec:', JSON.stringify(imageSpec, null, 2));

    return new Response(
      JSON.stringify({ 
        imageSpec,
        enhancedPrompt,
        tokensUsed: inputTokens + outputTokens
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[prepare-image] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
