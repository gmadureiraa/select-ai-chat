// =====================================================
// GENERATE VOICE PROFILE
// Analyzes client's content to auto-generate voice profile
// Extracts tone, patterns, and suggestions from library
// =====================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VoiceProfileRequest {
  client_id: string;
}

interface VoiceProfileSuggestion {
  tone: string;
  use_patterns: string[];
  avoid_patterns: string[];
  detected_expressions: Array<{ expression: string; frequency: number }>;
  style_characteristics: string[];
  analysis_summary: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { client_id } = await req.json() as VoiceProfileRequest;

    if (!client_id) {
      return new Response(
        JSON.stringify({ error: "client_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_AI_STUDIO_API_KEY");

    if (!GOOGLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "API key não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[VOICE-PROFILE] Analyzing client: ${client_id}`);

    // 1. Fetch favorite/high-quality content from library
    const { data: libraryItems } = await supabase
      .from("client_content_library")
      .select("content, content_type, title, metadata, is_favorite")
      .eq("client_id", client_id)
      .order("is_favorite", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(15);

    // 2. Fetch top performing Instagram posts
    const { data: topPosts } = await supabase
      .from("instagram_posts")
      .select("caption, full_content, likes, comments, saves, shares, engagement_rate, is_favorite")
      .eq("client_id", client_id)
      .order("is_favorite", { ascending: false })
      .order("engagement_rate", { ascending: false })
      .limit(10);

    // 3. Fetch client identity guide
    const { data: client } = await supabase
      .from("clients")
      .select("identity_guide, voice_profile, description, name")
      .eq("id", client_id)
      .single();

    // Combine all content for analysis
    const contentSamples: string[] = [];

    if (libraryItems) {
      for (const item of libraryItems) {
        if (item.content) {
          contentSamples.push(`[${item.content_type}] ${item.content.slice(0, 1000)}`);
        }
      }
    }

    if (topPosts) {
      for (const post of topPosts) {
        const text = post.full_content || post.caption || "";
        if (text) {
          const engagementInfo = post.engagement_rate 
            ? ` (Engagement: ${post.engagement_rate.toFixed(2)}%)`
            : "";
          contentSamples.push(`[Instagram${engagementInfo}] ${text.slice(0, 800)}`);
        }
      }
    }

    if (contentSamples.length < 3) {
      return new Response(
        JSON.stringify({ 
          error: "Conteúdo insuficiente para análise",
          details: "Adicione pelo menos 3 conteúdos na biblioteca ou conecte o Instagram para gerar o Voice Profile automaticamente."
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[VOICE-PROFILE] Analyzing ${contentSamples.length} content samples`);

    // 4. Call AI to analyze and extract patterns
    const analysisPrompt = `Você é um especialista em análise de tom de voz e padrões de comunicação.

## TAREFA
Analise os conteúdos abaixo de ${client?.name || "este cliente"} e extraia:

1. **Tom predominante**: Descreva em 2-3 palavras (ex: "Direto e provocativo", "Técnico e acessível")

2. **Padrões a USAR** (expressões e estruturas que aparecem frequentemente):
   - Identifique 5-10 expressões, estruturas ou padrões que se repetem
   - Foque em inícios de frase, transições, fechamentos
   - Inclua uso característico de pontuação ou formatação

3. **Padrões a EVITAR** (o que este autor NÃO usa):
   - Identifique 3-5 coisas que este autor claramente evita
   - Pode ser estilo, expressões, ou abordagens

4. **Expressões mais frequentes** (com estimativa de frequência):
   - Liste as 5-10 expressões mais usadas com % de aparição

5. **Características de estilo**:
   - Tamanho típico de parágrafos
   - Uso de listas/bullet points
   - Uso de emojis
   - Uso de perguntas
   - Ritmo (curto/médio/longo)

## CONTEÚDOS PARA ANÁLISE
${contentSamples.slice(0, 10).join("\n\n---\n\n")}

## FORMATO DE RESPOSTA (JSON)
{
  "tone": "descrição do tom em 2-3 palavras",
  "use_patterns": ["padrão 1", "padrão 2", ...],
  "avoid_patterns": ["evitar 1", "evitar 2", ...],
  "detected_expressions": [
    {"expression": "expressão", "frequency": 80},
    ...
  ],
  "style_characteristics": ["característica 1", "característica 2", ...],
  "analysis_summary": "Resumo de 2-3 frases sobre o estilo geral"
}

Responda APENAS com o JSON, sem markdown.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: analysisPrompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2000,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[VOICE-PROFILE] AI error:", errorText);
      throw new Error("Erro ao analisar conteúdo");
    }

    const result = await response.json();
    const aiOutput = result?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Parse JSON from AI output
    let suggestion: VoiceProfileSuggestion;
    try {
      // Clean potential markdown code blocks
      const cleanedOutput = aiOutput.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      suggestion = JSON.parse(cleanedOutput);
    } catch (e) {
      console.error("[VOICE-PROFILE] Parse error:", e, "\nRaw output:", aiOutput);
      return new Response(
        JSON.stringify({ 
          error: "Erro ao processar análise",
          raw_output: aiOutput.slice(0, 500)
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[VOICE-PROFILE] Analysis complete. Tone: ${suggestion.tone}`);

    return new Response(
      JSON.stringify({
        success: true,
        suggestion,
        samples_analyzed: contentSamples.length,
        current_profile: client?.voice_profile,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[VOICE-PROFILE] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
