import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { logAIUsage, estimateTokens } from "../_shared/ai-usage.ts";
import { 
  checkWorkspaceTokens, 
  debitWorkspaceTokens, 
  getWorkspaceIdFromUser,
  createInsufficientTokensResponse,
  TOKEN_COSTS 
} from "../_shared/tokens.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
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

    const { clientId, topPostsContext, bottomPostsContext, typeAvgContext, totalPosts } = await req.json();

    if (!topPostsContext) {
      throw new Error("Context is required");
    }

    // Get workspace ID and check tokens
    const workspaceId = await getWorkspaceIdFromUser(user.id);
    if (!workspaceId) {
      return new Response(
        JSON.stringify({ error: 'Workspace not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenCost = TOKEN_COSTS.performance_insights;
    const tokenCheck = await checkWorkspaceTokens(workspaceId, tokenCost);
    
    if (!tokenCheck.hasTokens) {
      return createInsufficientTokensResponse(corsHeaders);
    }

    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_AI_STUDIO_API_KEY");
    if (!GOOGLE_API_KEY) {
      throw new Error("GOOGLE_AI_STUDIO_API_KEY not configured");
    }

    const prompt = `Você é um analista de conteúdo de redes sociais. Analise os dados de performance dos posts e extraia APRENDIZADOS PRÁTICOS sobre o que funciona melhor.

═══════════════════════════════════════════════════════════════
DADOS ANALISADOS (${totalPosts} posts)
═══════════════════════════════════════════════════════════════

## TOP 5 POSTS (maior engajamento)
${topPostsContext}

## POSTS COM MENOR PERFORMANCE
${bottomPostsContext}

## MÉDIA POR FORMATO
${typeAvgContext}

═══════════════════════════════════════════════════════════════
FORMATO DA RESPOSTA
═══════════════════════════════════════════════════════════════

Gere aprendizados estruturados em Markdown:

## ✅ O Que Está Funcionando
- [Padrão identificado nos top posts - seja específico sobre o conteúdo]
- [Formato ou estilo que gera mais engajamento]
- [Elemento comum nos posts de sucesso]

## ⚠️ O Que Evitar
- [Padrão identificado nos posts de baixa performance]
- [Elemento ou estilo que não engaja]

## 💡 Recomendações Baseadas nos Dados
1. **[Ação específica]:** [Baseada na análise dos top posts]
2. **[Formato ideal]:** [Baseado nas médias por tipo]

## 📊 Insight Principal
[Uma frase resumindo o aprendizado mais importante]

REGRAS:
- Baseie-se APENAS nos dados fornecidos
- Seja específico sobre elementos de conteúdo (ganchos, CTAs, temas)
- Cite métricas quando relevante
- Máximo 180 palavras`;

    const MODEL = "gemini-2.0-flash";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 500,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[generate-content-learnings] Gemini API error:", errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const learnings = data.candidates?.[0]?.content?.parts?.[0]?.text || "Não foi possível gerar aprendizados.";
    
    // Get token usage
    const inputTokens = data.usageMetadata?.promptTokenCount || estimateTokens(prompt);
    const outputTokens = data.usageMetadata?.candidatesTokenCount || estimateTokens(learnings);

    // Log AI usage
    const supabaseServiceUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseServiceUrl, supabaseServiceKey);
    
    await logAIUsage(
      supabase,
      user.id,
      MODEL,
      "generate-content-learnings",
      inputTokens,
      outputTokens,
      { clientId }
    );

    // Debit tokens
    await debitWorkspaceTokens(
      workspaceId,
      user.id,
      tokenCost,
      "Aprendizados de conteúdo",
      { clientId }
    );

    console.log(`[generate-content-learnings] Complete - ${inputTokens + outputTokens} tokens`);

    return new Response(
      JSON.stringify({ learnings }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[generate-content-learnings] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
