import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { callLLM, isLLMConfigured, LLMMessage } from "../_shared/llm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clientId } = await req.json();
    if (!clientId) {
      return new Response(JSON.stringify({ error: "clientId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isLLMConfigured()) {
      return new Response(JSON.stringify({ error: "No AI key configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Load client data in parallel
    const [clientResult, libraryResult, topPostsResult] = await Promise.all([
      supabase
        .from("clients")
        .select("name, description, identity_guide, voice_profile, tags")
        .eq("id", clientId)
        .single(),
      supabase
        .from("client_content_library")
        .select("title, content, content_type")
        .eq("client_id", clientId)
        .eq("is_favorite", true)
        .limit(5),
      supabase
        .from("instagram_posts")
        .select("caption, engagement_rate, post_type")
        .eq("client_id", clientId)
        .not("engagement_rate", "is", null)
        .order("engagement_rate", { ascending: false })
        .limit(5),
    ]);

    const client = clientResult.data;
    if (!client) {
      return new Response(JSON.stringify({ error: "Client not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build context for generation
    let analysisContext = `Cliente: ${client.name}\n`;
    if (client.description) analysisContext += `Descrição: ${client.description}\n`;
    if (client.identity_guide) analysisContext += `\nGuia de Identidade (resumo):\n${client.identity_guide.substring(0, 2000)}\n`;
    
    const vp = client.voice_profile as { tone?: string; use?: string[]; avoid?: string[] } | null;
    if (vp) {
      if (vp.tone) analysisContext += `\nTom: ${vp.tone}`;
      if (vp.use?.length) analysisContext += `\nUsar: ${vp.use.join(", ")}`;
      if (vp.avoid?.length) analysisContext += `\nEvitar: ${vp.avoid.join(", ")}`;
    }

    if (libraryResult.data?.length) {
      analysisContext += `\n\nExemplos favoritos da biblioteca:\n`;
      for (const item of libraryResult.data) {
        analysisContext += `- [${item.content_type}] "${item.title}": ${(item.content || "").substring(0, 300)}\n`;
      }
    }

    if (topPostsResult.data?.length) {
      analysisContext += `\n\nTop posts por engagement:\n`;
      for (const post of topPostsResult.data) {
        const rate = ((post.engagement_rate || 0) * 100).toFixed(1);
        analysisContext += `- [${post.post_type}] ${rate}% eng: "${(post.caption || "").substring(0, 200)}"\n`;
      }
    }

    const messages: LLMMessage[] = [
      {
        role: "system",
        content: `Você é um estrategista de conteúdo. Analise os dados do cliente e gere um GUIA DE CRIAÇÃO DE CONTEÚDO prático e direto.

O guia deve ter regras curtas e acionáveis em formato de bullet points (•). Categorize em seções:
1. Estrutura (como organizar o conteúdo)
2. Linguagem (tom, expressões, estilo)
3. Ganchos (como abrir posts/conteúdos)
4. CTAs (como fechar/converter)
5. O que NUNCA fazer

Cada regra deve ser específica para ESTE cliente baseado nos dados. Evite conselhos genéricos.
Máximo 15-20 regras no total. Retorne APENAS o guia, sem explicações.`,
      },
      {
        role: "user",
        content: `Gere o guia de criação para este cliente:\n\n${analysisContext}`,
      },
    ];

    const result = await callLLM(messages, { maxTokens: 2048, temperature: 0.6 });

    return new Response(
      JSON.stringify({ guidelines: result.content }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[GENERATE-GUIDELINES] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
