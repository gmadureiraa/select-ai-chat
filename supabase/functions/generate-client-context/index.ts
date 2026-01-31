import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Limits per source to avoid context overflow
const LIMITS = {
  websiteChars: 3000,
  documentChars: 2000,
  contentChars: 1500,
  referenceChars: 1000,
  instagramChars: 500,
  youtubeChars: 2000,
  totalPromptChars: 60000,
};

interface ContextSources {
  profile: {
    name: string;
    description: string | null;
    tags: Record<string, string>;
    social_media: Record<string, string>;
  };
  websites: Array<{ url: string; content: string }>;
  documents: Array<{ name: string; content: string }>;
  contentLibrary: Array<{ title: string; content: string; type: string }>;
  referenceLibrary: Array<{ title: string; content: string }>;
  instagramPosts: Array<{ caption: string; engagement: number }>;
  youtubeVideos: Array<{ title: string; transcript: string; views: number }>;
}

function truncate(text: string | null | undefined, limit: number): string {
  if (!text) return "";
  return text.length > limit ? text.substring(0, limit) + "..." : text;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { clientId } = await req.json();

    if (!clientId) {
      return new Response(
        JSON.stringify({ error: "clientId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[generate-client-context] Starting for client ${clientId}`);

    // Fetch all data sources in parallel
    const [
      clientResult,
      websitesResult,
      documentsResult,
      contentResult,
      referencesResult,
      instagramResult,
      youtubeResult,
    ] = await Promise.all([
      supabase.from("clients").select("name, description, tags, social_media").eq("id", clientId).single(),
      supabase.from("client_websites").select("url, scraped_markdown").eq("client_id", clientId),
      supabase.from("client_documents").select("name, extracted_content").eq("client_id", clientId),
      supabase.from("client_content_library").select("title, content, content_type").eq("client_id", clientId).eq("is_favorite", true).limit(10),
      supabase.from("client_reference_library").select("title, content").eq("client_id", clientId).limit(10),
      supabase.from("instagram_posts").select("caption, engagement_rate").eq("client_id", clientId).order("engagement_rate", { ascending: false, nullsFirst: false }).limit(5),
      supabase.from("youtube_videos").select("title, transcript, total_views").eq("client_id", clientId).not("transcript", "is", null).order("total_views", { ascending: false, nullsFirst: false }).limit(5),
    ]);

    const client = clientResult.data;
    if (!client) {
      return new Response(
        JSON.stringify({ error: "Cliente não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build sources object with counts for status
    const sources: ContextSources = {
      profile: {
        name: client.name,
        description: client.description,
        tags: (client.tags as Record<string, string>) || {},
        social_media: (client.social_media as Record<string, string>) || {},
      },
      websites: (websitesResult.data || [])
        .filter((w) => w.scraped_markdown)
        .map((w) => ({ url: w.url, content: truncate(w.scraped_markdown, LIMITS.websiteChars) })),
      documents: (documentsResult.data || [])
        .filter((d) => d.extracted_content)
        .map((d) => ({ name: d.name, content: truncate(d.extracted_content, LIMITS.documentChars) })),
      contentLibrary: (contentResult.data || []).map((c) => ({
        title: c.title,
        content: truncate(c.content, LIMITS.contentChars),
        type: c.content_type,
      })),
      referenceLibrary: (referencesResult.data || []).map((r) => ({
        title: r.title,
        content: truncate(r.content, LIMITS.referenceChars),
      })),
      instagramPosts: (instagramResult.data || []).map((p) => ({
        caption: truncate(p.caption, LIMITS.instagramChars),
        engagement: p.engagement_rate || 0,
      })),
      youtubeVideos: (youtubeResult.data || []).map((v) => ({
        title: v.title,
        transcript: truncate(v.transcript, LIMITS.youtubeChars),
        views: v.total_views || 0,
      })),
    };

    // Build the mega-prompt
    let dataSection = `# DADOS DO CLIENTE: ${sources.profile.name}

## INFORMAÇÕES BÁSICAS
- **Nome:** ${sources.profile.name}
- **Descrição:** ${sources.profile.description || "Não informada"}
- **Segmento:** ${sources.profile.tags.segment || "Não informado"}
- **Tom de Voz:** ${sources.profile.tags.tone || "Não informado"}
- **Público-Alvo:** ${sources.profile.tags.audience || "Não informado"}
- **Objetivos:** ${sources.profile.tags.objectives || "Não informados"}

## REDES SOCIAIS
${Object.entries(sources.profile.social_media)
  .filter(([_, v]) => v)
  .map(([k, v]) => `- **${k}:** ${v}`)
  .join("\n") || "Nenhuma rede social cadastrada"}
`;

    if (sources.websites.length > 0) {
      dataSection += `\n## WEBSITES ANALISADOS (${sources.websites.length})\n`;
      sources.websites.forEach((w, i) => {
        dataSection += `\n### Website ${i + 1}: ${w.url}\n${w.content}\n`;
      });
    }

    if (sources.documents.length > 0) {
      dataSection += `\n## DOCUMENTOS TRANSCRITOS (${sources.documents.length})\n`;
      sources.documents.forEach((d, i) => {
        dataSection += `\n### ${d.name}\n${d.content}\n`;
      });
    }

    if (sources.contentLibrary.length > 0) {
      dataSection += `\n## CONTEÚDOS FAVORITOS DA BIBLIOTECA (${sources.contentLibrary.length})\n`;
      sources.contentLibrary.forEach((c, i) => {
        dataSection += `\n### ${c.title} (${c.type})\n${c.content}\n`;
      });
    }

    if (sources.referenceLibrary.length > 0) {
      dataSection += `\n## REFERÊNCIAS EXTERNAS (${sources.referenceLibrary.length})\n`;
      sources.referenceLibrary.forEach((r, i) => {
        dataSection += `\n### ${r.title}\n${r.content}\n`;
      });
    }

    if (sources.instagramPosts.length > 0) {
      dataSection += `\n## TOP POSTS DO INSTAGRAM (${sources.instagramPosts.length})\n`;
      sources.instagramPosts.forEach((p, i) => {
        dataSection += `\n### Post ${i + 1} (${(p.engagement * 100).toFixed(1)}% engagement)\n${p.caption}\n`;
      });
    }

    if (sources.youtubeVideos.length > 0) {
      dataSection += `\n## TOP VÍDEOS DO YOUTUBE (${sources.youtubeVideos.length})\n`;
      sources.youtubeVideos.forEach((v, i) => {
        dataSection += `\n### ${v.title} (${v.views.toLocaleString()} views)\n**Transcrição:**\n${v.transcript}\n`;
      });
    }

    // Truncate total if needed
    if (dataSection.length > LIMITS.totalPromptChars) {
      dataSection = dataSection.substring(0, LIMITS.totalPromptChars) + "\n\n[... conteúdo truncado por limite de tamanho ...]";
    }

    const systemPrompt = `Você é um especialista em estratégia de marca e marketing digital.

Analise TODAS as informações fornecidas sobre o cliente e gere um documento de contexto COMPLETO e ESTRUTURADO em Markdown.

Este documento será usado pela IA para criar TODO o conteúdo do cliente, então seja:
- **ESPECÍFICO:** Use exemplos reais do material fornecido
- **PRÁTICO:** Foque em diretrizes acionáveis para criação de conteúdo
- **FIEL:** Preserve o tom de voz identificado nos materiais
- **COMPLETO:** Cubra todas as seções do template

IMPORTANTE:
- NÃO invente informações que não estão nos dados
- Se alguma seção não tem dados suficientes, indique "[Dados insuficientes - adicione mais material]"
- Extraia padrões de linguagem, estrutura e estilo dos conteúdos existentes
- Identifique palavras-chave e expressões recorrentes

TEMPLATE OBRIGATÓRIO:

# [Nome do Cliente] - Contexto Operacional para IA

## 1. IDENTIDADE E POSICIONAMENTO
[Descreva a essência da marca, missão, valores e posicionamento único no mercado]

## 2. PÚBLICO-ALVO
### Perfil Demográfico
[Idade, localização, gênero, renda, profissão - extraia dos dados]

### Perfil Psicográfico
[Interesses, valores, comportamentos, desafios - infira dos conteúdos]

### Necessidades e Dores
[Problemas que o cliente resolve para seu público]

## 3. TOM DE VOZ E LINGUAGEM
### Tom Principal
[Ex: Profissional e amigável / Técnico e didático / Casual e inspirador]

### Características de Linguagem
- [Característica 1]
- [Característica 2]
- [Característica 3]

### Palavras-Chave e Expressões
[Liste termos importantes identificados nos conteúdos]

### O que EVITAR
[Termos, abordagens ou estilos a não usar]

## 4. PRESENÇA DIGITAL
### Website
[Resumo do conteúdo e posicionamento encontrado]

### Redes Sociais Ativas
[Liste e descreva o tipo de conteúdo em cada rede]

## 5. ESTILO DE CONTEÚDO
### Formatos Preferidos
[Baseado nos conteúdos da biblioteca]

### Estrutura Típica de Posts
[Padrões identificados nos exemplos]

### Ganchos e CTAs Efetivos
[Extraídos dos top performers]

## 6. TEMAS E PILARES DE CONTEÚDO
[Liste 3-5 temas principais abordados]

## 7. DIRETRIZES DE CRIAÇÃO
### SEMPRE fazer:
- [Diretriz 1]
- [Diretriz 2]

### NUNCA fazer:
- [Restrição 1]
- [Restrição 2]

## 8. FONTES UTILIZADAS
[Liste quantos websites, documentos e conteúdos foram processados]

---
*Contexto gerado automaticamente em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}*`;

    const userPrompt = `${dataSection}

---

Com base em TODOS os dados acima, gere o documento de contexto seguindo EXATAMENTE o template fornecido. Seja específico e use exemplos reais dos materiais.`;

    // Call Gemini via Google AI API
    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_AI_STUDIO_API_KEY");

    if (!GOOGLE_API_KEY) {
      console.error("GOOGLE_AI_STUDIO_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Chave da API do Google AI não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[generate-client-context] Calling Gemini with ${dataSection.length} chars of context`);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            { role: "user", parts: [{ text: systemPrompt }] },
            { role: "model", parts: [{ text: "Entendido. Vou analisar os dados do cliente e gerar o documento de contexto seguindo o template especificado." }] },
            { role: "user", parts: [{ text: userPrompt }] },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 8192,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", errorText);
      throw new Error("Erro ao gerar contexto com IA");
    }

    const result = await response.json();
    const generatedContext = result?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    console.log(`[generate-client-context] Generated ${generatedContext.length} chars of context`);

    // Save to client's identity_guide
    const { error: updateError } = await supabase
      .from("clients")
      .update({
        identity_guide: generatedContext,
        updated_at: new Date().toISOString(),
      })
      .eq("id", clientId);

    if (updateError) {
      console.error("Error saving context:", updateError);
      throw new Error("Erro ao salvar contexto");
    }

    // Return the context and source counts
    return new Response(
      JSON.stringify({
        success: true,
        context: generatedContext,
        sources: {
          hasDescription: !!sources.profile.description,
          hasTags: Object.values(sources.profile.tags).some((v) => v),
          websitesCount: sources.websites.length,
          documentsCount: sources.documents.length,
          contentCount: sources.contentLibrary.length,
          referencesCount: sources.referenceLibrary.length,
          instagramCount: sources.instagramPosts.length,
          youtubeCount: sources.youtubeVideos.length,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("generate-client-context error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
