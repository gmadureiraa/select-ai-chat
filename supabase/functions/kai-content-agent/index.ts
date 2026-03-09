import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getFormatRules } from "../_shared/format-rules.ts";
import { getFormatDocs, getFormatChecklistFormatted, getGlobalKnowledge, getSuccessPatterns } from "../_shared/knowledge-loader.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ContentRequest {
  clientId: string;
  request: string;
  format?: string;
  platform?: string;
  workspaceId?: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  includePerformanceContext?: boolean;
  additionalMaterial?: string; // Pre-extracted references from frontend
}

interface TopPerformer {
  title: string;
  type: string;
  engagement?: number;
  views?: number;
  content: string;
  transcript?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const requestBody = await req.json() as ContentRequest & { stream?: boolean; message?: string };
    const { clientId, request, format, platform, workspaceId, conversationHistory, includePerformanceContext = true, stream = true, message, additionalMaterial } = requestBody;
    
    // Support both 'request' and 'message' field names for flexibility
    // Support both 'request' and 'message' field names for flexibility
    const userRequest = request || message;

    if (!clientId) {
      return new Response(
        JSON.stringify({ error: "clientId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch complete client context
    const { data: client } = await supabase
      .from("clients")
      .select("name, description, identity_guide, context_notes, social_media, tags")
      .eq("id", clientId)
      .single();

    // Fetch format rules if available
    let formatRules = null;
    if (format && workspaceId) {
      const { data } = await supabase
        .from("format_rules")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("format_id", format)
        .single();
      formatRules = data;
    }

    // Fetch recent successful content WITH FULL TEXT for style reference
    const { data: recentContent } = await supabase
      .from("client_content_library")
      .select("title, content, content_type, metadata")
      .eq("client_id", clientId)
      .eq("is_favorite", true) // Prioritize favorited content
      .order("created_at", { ascending: false })
      .limit(3);

    // Also fetch more recent content if we don't have enough favorites
    let additionalContent: typeof recentContent = [];
    if (!recentContent || recentContent.length < 3) {
      const { data: moreContent } = await supabase
        .from("client_content_library")
        .select("title, content, content_type, metadata")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(5);
      additionalContent = moreContent || [];
    }

    const allContent = [...(recentContent || []), ...additionalContent].slice(0, 5);

    // Fetch reference library
    const { data: references } = await supabase
      .from("client_reference_library")
      .select("title, content, reference_type")
      .eq("client_id", clientId)
      .limit(5);

    // Fetch global knowledge for extra context
    let globalKnowledge = null;
    if (workspaceId) {
      const { data } = await supabase
        .from("global_knowledge")
        .select("title, summary, category")
        .eq("workspace_id", workspaceId)
        .limit(3);
      globalKnowledge = data;
    }

    // NEW: Fetch TOP PERFORMERS from Instagram and YouTube
    const topPerformers: TopPerformer[] = [];
    
    if (includePerformanceContext) {
      // Top Instagram posts by engagement rate (only synced content)
      const { data: topInstaPosts } = await supabase
        .from("instagram_posts")
        .select("caption, post_type, engagement_rate, likes, full_content, video_transcript")
        .eq("client_id", clientId)
        .not("content_synced_at", "is", null) // Only synced posts
        .order("engagement_rate", { ascending: false, nullsFirst: false })
        .limit(5);

      if (topInstaPosts) {
        for (const post of topInstaPosts) {
          if (post.full_content || post.video_transcript) {
            topPerformers.push({
              title: (post.caption || "").substring(0, 100) + "...",
              type: post.post_type === "VIDEO" || post.post_type === "reel" ? "Reels" : post.post_type || "Post",
              engagement: post.engagement_rate || 0,
              content: post.full_content || "",
              transcript: post.video_transcript || undefined,
            });
          }
        }
      }

      // Top YouTube videos by views (only synced content)
      const { data: topYTVideos } = await supabase
        .from("youtube_videos")
        .select("title, total_views, watch_hours, transcript")
        .eq("client_id", clientId)
        .not("content_synced_at", "is", null) // Only synced videos
        .order("total_views", { ascending: false, nullsFirst: false })
        .limit(5);

      if (topYTVideos) {
        for (const video of topYTVideos) {
          if (video.transcript) {
            topPerformers.push({
              title: video.title,
              type: "YouTube",
              views: video.total_views || 0,
              content: video.transcript || "",
            });
          }
        }
      }
    }

    // Build rich context - PRIORITIZE identity_guide as MASTER DOCUMENT
    let contextPrompt = "";
    
    if (client?.identity_guide) {
      // identity_guide is the MASTER DOCUMENT - use it as primary context
      contextPrompt = `## 🎯 CONTEXTO OPERACIONAL DO CLIENTE (DOCUMENTO MESTRE)

*SIGA RIGOROSAMENTE as diretrizes abaixo. Este documento foi criado para garantir consistência em todo o conteúdo.*

${client.identity_guide}

---

## INFORMAÇÕES ADICIONAIS
`;
    } else {
      // Fallback: build context from fragments if no master document
      contextPrompt = `## Cliente: ${client?.name || "Não especificado"}\n`;
    }
    
    // Always add basic info if not in identity_guide
    if (!client?.identity_guide) {
      if (client?.description) {
        contextPrompt += `**Descrição:** ${client.description}\n\n`;
      }
      
      if (client?.context_notes) {
        contextPrompt += `### Contexto Adicional\n${client.context_notes}\n\n`;
      }
    }

    if (client?.social_media) {
      const socialMedia = typeof client.social_media === 'string' 
        ? JSON.parse(client.social_media) 
        : client.social_media;
      if (Object.keys(socialMedia).length > 0) {
        contextPrompt += `### Redes Sociais\n`;
        Object.entries(socialMedia).forEach(([key, value]) => {
          if (value) contextPrompt += `- ${key}: ${value}\n`;
        });
        contextPrompt += `\n`;
      }
    }

    if (formatRules) {
      contextPrompt += `### Regras do Formato: ${formatRules.name}\n`;
      contextPrompt += `${formatRules.description || ""}\n`;
      if (formatRules.rules) {
        contextPrompt += `**Estrutura:** ${JSON.stringify(formatRules.rules, null, 2)}\n`;
      }
      if (formatRules.prompt_template) {
        contextPrompt += `**Template:** ${formatRules.prompt_template}\n`;
      }
      contextPrompt += `\n`;
    }

    // NEW: Include TOP PERFORMERS section
    if (topPerformers.length > 0) {
      contextPrompt += `### 🏆 CONTEÚDOS DE MAIOR PERFORMANCE (USE COMO INSPIRAÇÃO)\n`;
      contextPrompt += `*Estes são os conteúdos do cliente com melhor desempenho. Analise o estilo, estrutura, ganchos e tom de voz para criar conteúdos similares.*\n\n`;
      
      topPerformers.forEach((perf, i) => {
        const metric = perf.engagement 
          ? `${(perf.engagement * 100).toFixed(1)}% engagement` 
          : `${(perf.views || 0).toLocaleString()} views`;
        
        contextPrompt += `**Top ${i + 1} [${perf.type}]** - ${metric}\n`;
        contextPrompt += `*"${perf.title}"*\n`;
        
        if (perf.transcript) {
          contextPrompt += `**Roteiro/Transcrição:**\n\`\`\`\n${perf.transcript.substring(0, 1500)}${perf.transcript.length > 1500 ? "..." : ""}\n\`\`\`\n`;
        } else if (perf.content) {
          contextPrompt += `**Conteúdo:**\n\`\`\`\n${perf.content.substring(0, 1500)}${perf.content.length > 1500 ? "..." : ""}\n\`\`\`\n`;
        }
        contextPrompt += `\n`;
      });
    }

    // Include FULL content samples for style matching
    if (allContent && allContent.length > 0) {
      contextPrompt += `### Exemplos de Conteúdo do Cliente (USE COMO REFERÊNCIA DE TOM E ESTILO)\n`;
      contextPrompt += `*Analise esses exemplos e replique o tom de voz, estrutura e estilo:*\n\n`;
      allContent.forEach((c, i) => {
        const contentPreview = c.content?.substring(0, 800) || "";
        contextPrompt += `**Exemplo ${i + 1}: "${c.title}"** (${c.content_type})\n`;
        contextPrompt += `\`\`\`\n${contentPreview}${c.content && c.content.length > 800 ? "..." : ""}\n\`\`\`\n\n`;
      });
    }

    if (references && references.length > 0) {
      contextPrompt += `### Referências do Cliente\n`;
      references.forEach((r, i) => {
        contextPrompt += `${i + 1}. **${r.title}** (${r.reference_type})\n`;
        if (r.content) {
          contextPrompt += `   ${r.content.substring(0, 200)}...\n`;
        }
      });
      contextPrompt += `\n`;
    }

    if (globalKnowledge && globalKnowledge.length > 0) {
      contextPrompt += `### Base de Conhecimento\n`;
      globalKnowledge.forEach((k) => {
        contextPrompt += `- **${k.title}** (${k.category}): ${k.summary?.substring(0, 150) || ""}...\n`;
      });
      contextPrompt += `\n`;
    }

    // NEW: Include additional material from frontend if provided
    if (additionalMaterial) {
      contextPrompt += `### Material de Referência Fornecido\n`;
      contextPrompt += `*Material extraído e fornecido pelo usuário:*\n\n`;
      contextPrompt += additionalMaterial.substring(0, 15000); // Limit to 15k chars
      contextPrompt += `\n\n`;
    }

    // ===================================================
    // FORMATO: Buscar do banco primeiro, fallback hardcoded
    // ===================================================
    let formatRulesContent = "";
    
    if (format) {
      console.log("[kai-content-agent] Loading format rules for:", format);
      
      // Tentar buscar do banco de dados (kai_documentation)
      const dbFormatDocs = await getFormatDocs(format);
      
      if (dbFormatDocs && dbFormatDocs.trim().length > 50) {
        // Usar documentação do banco
        formatRulesContent = `\n## 📋 REGRAS DO FORMATO: ${format.toUpperCase()}\n\n${dbFormatDocs}\n`;
        console.log("[kai-content-agent] Using DB format rules, length:", dbFormatDocs.length);
      } else {
        // Fallback para regras hardcoded
        formatRulesContent = getFormatRules(format);
        console.log("[kai-content-agent] Using hardcoded format rules (fallback)");
      }
    } else {
      // Sem formato especificado, usar regras genéricas de post
      formatRulesContent = getFormatRules("post");
    }

    // ===================================================
    // NOVOS ENRICHMENTS: Global Knowledge, Success Patterns, Checklist
    // ===================================================
    let enrichmentContext = "";
    
    // Global Knowledge (se temos workspaceId)
    if (workspaceId) {
      const globalKnowledge = await getGlobalKnowledge(workspaceId);
      if (globalKnowledge) {
        enrichmentContext += globalKnowledge;
        console.log("[kai-content-agent] Added global knowledge");
      }
    }
    
    // Success Patterns (padrões que funcionam para o cliente)
    if (clientId) {
      const successPatterns = await getSuccessPatterns(clientId);
      if (successPatterns) {
        enrichmentContext += successPatterns;
        console.log("[kai-content-agent] Added success patterns");
      }
    }
    
    // Checklist de validação (para IA auto-validar internamente)
    if (format) {
      const checklist = await getFormatChecklistFormatted(format);
      if (checklist) {
        enrichmentContext += checklist;
        console.log("[kai-content-agent] Added format checklist");
      }
    }

    const systemPrompt = `# REGRAS ABSOLUTAS DE ENTREGA (LEIA PRIMEIRO)

⛔ PROIBIDO INCLUIR NA RESPOSTA:
- "Checklist:", "Observações:", "Notas:", "Dicas:"
- Comentários como "Aqui está...", "Segue...", "Criei para você..."
- Emojis de validação (✅❌)
- Hashtags
- Meta-texto explicando o que você fez

✅ ENTREGUE APENAS: O conteúdo final pronto para publicação.

---

Você é um copywriter especialista em criação de conteúdo para redes sociais e marketing digital.

${contextPrompt}

${formatRulesContent}

${enrichmentContext}

## Suas Responsabilidades:

1. **Manter a Identidade**: Siga rigorosamente o guia de identidade e tom de voz do cliente
2. **Replicar o Estilo**: Use os exemplos de conteúdo como referência para estrutura e linguagem
3. **Aprender com Top Performers**: Analise os conteúdos de maior performance para entender O QUE FUNCIONA para este cliente
4. **Copywriting Estratégico**: Use gatilhos mentais, CTAs e técnicas de persuasão apropriadas
5. **Seguir Regras do Formato**: Respeite TODAS as regras específicas acima - limites de palavras, estrutura, proibições
6. **Conteúdo Completo**: Entregue o conteúdo PRONTO PARA USO, não apenas sugestões
7. **Auto-Validar**: Use o checklist interno para garantir conformidade antes de responder

## Formato Solicitado: ${format || "post"}
## Plataforma: ${platform || "Instagram"}

Sua resposta deve conter SOMENTE o conteúdo pronto para publicação. Siga EXATAMENTE o formato de entrega especificado nas regras acima.`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    // Build messages array with conversation history
    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

    // Add conversation history if provided
    if (conversationHistory && conversationHistory.length > 0) {
      messages.push(...conversationHistory.slice(-10)); // Keep last 10 messages
    }

    // Add current request
    messages.push({ role: "user", content: userRequest || request || "" });

    // Use user's own Google AI Studio API key instead of Lovable AI Gateway
    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_AI_STUDIO_API_KEY");
    
    if (!GOOGLE_API_KEY) {
      console.error("GOOGLE_AI_STUDIO_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Chave da API do Google AI não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use the stream value from the already-parsed requestBody
    const useStreaming = stream !== false;

    // Convert messages to Gemini format
    const geminiContents = messages.map(msg => ({
      role: msg.role === "assistant" ? "model" : msg.role === "system" ? "user" : "user",
      parts: [{ text: msg.content }]
    }));

    // Merge consecutive user messages (Gemini doesn't allow consecutive same-role messages)
    const mergedContents: typeof geminiContents = [];
    for (const content of geminiContents) {
      if (mergedContents.length > 0 && mergedContents[mergedContents.length - 1].role === content.role) {
        mergedContents[mergedContents.length - 1].parts[0].text += "\n\n" + content.parts[0].text;
      } else {
        mergedContents.push(content);
      }
    }

    // Select model based on format complexity
    const COMPLEX_FORMATS = ['carousel', 'newsletter', 'blog_post', 'long_video', 'x_article', 'case_study'];
    const isComplexFormat = format && COMPLEX_FORMATS.includes(format);
    const modelName = isComplexFormat ? 'gemini-2.5-pro-preview-06-05' : 'gemini-2.0-flash';
    const modelTemperature = isComplexFormat ? 0.8 : 0.7;
    const modelMaxTokens = isComplexFormat ? 8192 : 4096;
    
    console.log(`[kai-content-agent] Using model: ${modelName} (format: ${format || 'generic'}, complex: ${isComplexFormat})`);

    // Non-streaming request
    if (!useStreaming) {
      console.log("[kai-content-agent] Non-streaming request");
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GOOGLE_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: mergedContents,
            generationConfig: {
              temperature: modelTemperature,
              maxOutputTokens: modelMaxTokens,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Gemini API error (non-streaming):", errorText);
        
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: "Rate limit excedido. Tente novamente em alguns segundos." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        throw new Error("Erro ao gerar conteúdo");
      }

      const result = await response.json();
      const content = result?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      
      console.log("[kai-content-agent] Non-streaming response length:", content.length);

      return new Response(
        JSON.stringify({ content }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Streaming request
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?alt=sse&key=${GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: mergedContents,
          generationConfig: {
            temperature: modelTemperature,
            maxOutputTokens: modelMaxTokens,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error("Erro ao gerar conteúdo");
    }

    // Transform Gemini SSE format to OpenAI-compatible format for frontend
    const transformStream = new TransformStream({
      transform(chunk, controller) {
        const text = new TextDecoder().decode(chunk);
        const lines = text.split("\n");
        
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
              if (content) {
                // Convert to OpenAI format
                const openAIFormat = {
                  choices: [{ delta: { content } }]
                };
                controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(openAIFormat)}\n\n`));
              }
            } catch {
              // Skip invalid JSON lines
            }
          }
        }
      },
      flush(controller) {
        controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
      }
    });

    return new Response(response.body?.pipeThrough(transformStream), {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Content agent error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
