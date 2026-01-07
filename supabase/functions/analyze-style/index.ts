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

    const { imageUrls, userId, clientId, workspaceId: providedWorkspaceId } = await req.json();

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return new Response(
        JSON.stringify({ error: 'imageUrls array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get workspace ID and check tokens
    const workspaceId = providedWorkspaceId || await getWorkspaceIdFromUser(user.id);
    if (!workspaceId) {
      console.error("[analyze-style] Could not determine workspace");
      return new Response(
        JSON.stringify({ error: 'Workspace not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenCost = TOKEN_COSTS.style_analysis;
    const tokenCheck = await checkWorkspaceTokens(workspaceId, tokenCost);
    
    if (!tokenCheck.hasTokens) {
      console.warn(`[analyze-style] Insufficient tokens for workspace ${workspaceId}`);
      return createInsufficientTokensResponse(corsHeaders);
    }

    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_AI_STUDIO_API_KEY');
    if (!GOOGLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[analyze-style] Analyzing ${imageUrls.length} images`);

    const parts: any[] = [];
    let validImageCount = 0;

    for (let i = 0; i < Math.min(imageUrls.length, 6); i++) {
      const url = imageUrls[i];
      
      try {
        if (url.startsWith('data:')) {
          const matches = url.match(/^data:([^;]+);base64,(.+)$/);
          if (matches) {
            parts.push({
              inlineData: { mimeType: matches[1], data: matches[2] }
            });
            validImageCount++;
          }
        } else if (url.startsWith('http')) {
          const response = await fetch(url);
          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            const base64 = arrayBufferToBase64(arrayBuffer);
            const contentType = response.headers.get('content-type') || 'image/jpeg';
            parts.push({
              inlineData: { mimeType: contentType, data: base64 }
            });
            validImageCount++;
          }
        }
      } catch (e) {
        console.warn(`[analyze-style] Failed to process image ${i + 1}:`, e);
      }
    }

    if (parts.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No valid images could be processed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const analysisPrompt = `Analise estas ${parts.length} imagens de referência para geração de imagens e extraia um JSON estruturado com as características visuais.

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
  "recurring_elements": ["elemento visual que aparece frequentemente"],
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
  "generation_prompt_template": "Um template de prompt detalhado para recriar este estilo"
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
            temperature: 0.3,
            maxOutputTokens: 2048,
          }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[analyze-style] Gemini API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to analyze images' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Get token usage
    const inputTokens = data.usageMetadata?.promptTokenCount || (estimateImageTokens(validImageCount) + estimateTokens(analysisPrompt));
    const outputTokens = data.usageMetadata?.candidatesTokenCount || estimateTokens(textContent);

    // Log AI usage
    if (userId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      await logAIUsage(
        supabase,
        userId,
        MODEL,
        "analyze-style",
        inputTokens,
        outputTokens,
        { imageCount: validImageCount, clientId }
      );
    }
    
    // Extract JSON from response
    let styleAnalysis;
    try {
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        styleAnalysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('[analyze-style] Failed to parse:', parseError);
      styleAnalysis = {
        style_summary: textContent.substring(0, 500),
        generation_prompt_template: `Imagem no estilo das referências: ${textContent.substring(0, 300)}`
      };
    }

    // Debit tokens after successful analysis
    const debitResult = await debitWorkspaceTokens(
      workspaceId,
      user.id,
      tokenCost,
      "Análise de estilo visual",
      { clientId, imageCount: validImageCount }
    );
    
    if (!debitResult.success) {
      console.warn(`[analyze-style] Token debit failed: ${debitResult.error}`);
    }

    console.log(`[analyze-style] Complete - ${inputTokens + outputTokens} tokens, ${tokenCost} debited`);

    return new Response(
      JSON.stringify({ styleAnalysis }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[analyze-style] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
