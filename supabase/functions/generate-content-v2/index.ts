import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getFormatRules, UNIVERSAL_RULES } from "../_shared/format-rules.ts";
import { getFormatDocs, getFormatChecklistFormatted, getGlobalKnowledge, getSuccessPatterns, getFullContentContext, getStructuredVoice } from "../_shared/knowledge-loader.ts";
import { buildForbiddenPhrasesSection, UNIVERSAL_OUTPUT_RULES } from "../_shared/quality-rules.ts";
import { selectModelForFormat } from "../_shared/prompt-builder.ts";
import { logAIUsage, estimateTokens } from "../_shared/ai-usage.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AttachmentInput {
  type: "image" | "video" | "audio" | "text" | "url" | "instagram" | "youtube";
  content: string;
  imageBase64?: string;
  analysis?: Record<string, unknown>;
  transcription?: string;
  // Instagram-specific
  extractedImages?: string[];
  caption?: string;
  imageCount?: number;
}

interface GenerateRequest {
  type: "text" | "image";
  inputs: AttachmentInput[];
  config: {
    format?: string;
    platform?: string;
    aspectRatio?: string;
    noText?: boolean;
    preserveFace?: boolean;
  };
  clientId?: string;
}

interface BrandContext {
  name?: string;
  brandVoice?: string;
  values?: string;
  keywords?: string[];
  colorPalette?: {
    primary?: string;
    secondary?: string;
    accent?: string;
  };
  photographyStyle?: string;
}

// Visual reference from client
interface VisualReference {
  imageUrl: string;
  type: string;
  styleAnalysis?: {
    style_summary?: string;
    visual_elements?: {
      photography_style?: string;
      color_palette?: string[];
    };
  };
  isPrimary: boolean;
}

// Fetch client visual references for image generation
async function fetchClientVisualReferences(
  supabaseClient: any,
  clientId: string | null
): Promise<VisualReference[]> {
  if (!clientId) return [];

  try {
    const { data, error } = await supabaseClient
      .from('client_visual_references')
      .select('image_url, reference_type, is_primary, metadata')
      .eq('client_id', clientId)
      .order('is_primary', { ascending: false })
      .limit(5);

    if (error || !data) return [];

    return data.map((ref: any) => ({
      imageUrl: ref.image_url,
      type: ref.reference_type,
      styleAnalysis: ref.metadata?.styleAnalysis,
      isPrimary: ref.is_primary,
    }));
  } catch (err) {
    console.error("[generate-content-v2] Error fetching visual references:", err);
    return [];
  }
}

// Fetch client brand context for enriched prompts
async function fetchClientBrandContext(
  supabaseClient: any,
  clientId: string | null
): Promise<BrandContext | null> {
  try {
    if (!clientId) {
      console.log("[generate-content-v2] No clientId provided");
      return null;
    }

    // Get the specific client by ID
    const { data: clientData, error } = await supabaseClient
      .from('clients')
      .select('name, identity_guide, context_notes, brand_assets')
      .eq('id', clientId)
      .single();

    if (error || !clientData) {
      console.log("[generate-content-v2] No client data found for ID:", clientId);
      return null;
    }

    const brandAssets = clientData.brand_assets || {};
    
    return {
      name: clientData.name,
      brandVoice: extractFromGuide(clientData.identity_guide, 'tom de voz') || 
                  extractFromGuide(clientData.identity_guide, 'voice') || undefined,
      values: extractFromGuide(clientData.identity_guide, 'valores') ||
              extractFromGuide(clientData.identity_guide, 'values') || undefined,
      keywords: extractKeywords(clientData.context_notes),
      colorPalette: {
        primary: brandAssets.color_palette?.primary || brandAssets.colors?.primary,
        secondary: brandAssets.color_palette?.secondary || brandAssets.colors?.secondary,
        accent: brandAssets.color_palette?.accent || brandAssets.colors?.accent,
      },
      photographyStyle: brandAssets.visual_style?.photography_style || brandAssets.photographyStyle,
    };
  } catch (err) {
    console.error("[generate-content-v2] Error fetching brand context:", err);
    return null;
  }
}

function extractFromGuide(guide: string | null, keyword: string): string | null {
  if (!guide) return null;
  const lines = guide.split('\n');
  for (const line of lines) {
    if (line.toLowerCase().includes(keyword.toLowerCase())) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > -1) {
        return line.substring(colonIndex + 1).trim();
      }
    }
  }
  return null;
}

function extractKeywords(notes: string | null): string[] {
  if (!notes) return [];
  // Extract words that might be keywords (capitalized or repeated)
  const words = notes.split(/\s+/).filter(w => w.length > 3);
  const wordCounts: Record<string, number> = {};
  words.forEach(w => {
    const clean = w.replace(/[^a-zA-ZÀ-ÿ]/g, '').toLowerCase();
    if (clean) wordCounts[clean] = (wordCounts[clean] || 0) + 1;
  });
  return Object.entries(wordCounts)
    .filter(([_, count]) => count >= 2)
    .map(([word]) => word)
    .slice(0, 10);
}

// Fetch favorite content from client's content library for style reference
async function fetchFavoriteContent(
  supabaseClient: any,
  clientId: string | null,
  contentType?: string
): Promise<Array<{ title: string; content: string; type: string }>> {
  if (!clientId) return [];
  
  try {
    let query = supabaseClient
      .from('client_content_library')
      .select('title, content, content_type')
      .eq('client_id', clientId)
      .eq('is_favorite', true)
      .order('created_at', { ascending: false })
      .limit(3);
    
    const { data, error } = await query;
    if (error || !data) return [];
    
    return data.map((item: any) => ({
      title: item.title,
      content: item.content?.substring(0, 800) || '',
      type: item.content_type
    }));
  } catch (err) {
    console.error("[generate-content-v2] Error fetching favorites:", err);
    return [];
  }
}

// Fetch top performing content from Instagram/YouTube for inspiration
async function fetchTopPerformers(
  supabaseClient: any,
  clientId: string | null
): Promise<Array<{ title: string; content: string; type: string; metric: string }>> {
  if (!clientId) return [];
  const topPerformers: Array<{ title: string; content: string; type: string; metric: string }> = [];
  
  try {
    // Top Instagram posts by engagement
    const { data: instaPosts } = await supabaseClient
      .from('instagram_posts')
      .select('caption, full_content, video_transcript, engagement_rate, post_type')
      .eq('client_id', clientId)
      .not('content_synced_at', 'is', null)
      .order('engagement_rate', { ascending: false, nullsFirst: false })
      .limit(3);
    
    if (instaPosts) {
      for (const post of instaPosts) {
        const content = post.full_content || post.video_transcript || post.caption;
        if (content) {
          topPerformers.push({
            title: (post.caption || '').substring(0, 80) + '...',
            content: content.substring(0, 600),
            type: post.post_type === 'VIDEO' || post.post_type === 'reel' ? 'Reels' : 'Post',
            metric: `${((post.engagement_rate || 0) * 100).toFixed(1)}% engagement`
          });
        }
      }
    }
    
    // Top YouTube videos
    const { data: ytVideos } = await supabaseClient
      .from('youtube_videos')
      .select('title, transcript, total_views')
      .eq('client_id', clientId)
      .not('transcript', 'is', null)
      .order('total_views', { ascending: false, nullsFirst: false })
      .limit(2);
    
    if (ytVideos) {
      for (const video of ytVideos) {
        if (video.transcript) {
          topPerformers.push({
            title: video.title,
            content: video.transcript.substring(0, 600),
            type: 'YouTube',
            metric: `${(video.total_views || 0).toLocaleString()} views`
          });
        }
      }
    }
  } catch (err) {
    console.error("[generate-content-v2] Error fetching top performers:", err);
  }
  
  return topPerformers;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if this is a service_role call (from other edge functions)
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const token = authHeader.replace("Bearer ", "");
    const isServiceRole = token === serviceRoleKey;

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      isServiceRole ? serviceRoleKey! : Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      isServiceRole ? {} : { global: { headers: { Authorization: authHeader } } }
    );

    let userId: string | null = null;
    if (!isServiceRole) {
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      userId = user.id;
    }

    const body: GenerateRequest = await req.json();
    const { type, inputs, config, clientId } = body;

    // Resolve userId for service-role automation calls (so usage gets attributed)
    if (!userId && isServiceRole && clientId) {
      try {
        const svc = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceRoleKey!);
        const { data: c } = await svc
          .from("clients")
          .select("user_id, created_by, workspace_id")
          .eq("id", clientId)
          .maybeSingle();
        userId = c?.user_id || c?.created_by || null;
        if (!userId && c?.workspace_id) {
          const { data: ws } = await svc.from("workspaces").select("owner_id").eq("id", c.workspace_id).maybeSingle();
          userId = ws?.owner_id || null;
        }
      } catch (_) { /* ignore */ }
    }

    console.log("[generate-content-v2] Request:", { type, inputsCount: inputs.length, config, clientId });

    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_AI_STUDIO_API_KEY");
    if (!GOOGLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch brand context for the specific client
    const brandContext = await fetchClientBrandContext(supabaseClient, clientId || null);
    console.log("[generate-content-v2] Brand context:", brandContext?.name || "none", "for client:", clientId);

    if (type === "text") {
      // Fetch enriched context: favorites + top performers + voice profile
      const [favorites, topPerformers, voiceSection] = await Promise.all([
        fetchFavoriteContent(supabaseClient, clientId || null),
        fetchTopPerformers(supabaseClient, clientId || null),
        clientId ? getStructuredVoice(clientId) : Promise.resolve(""),
      ]);
      
      console.log("[generate-content-v2] Enriched context:", {
        favorites: favorites.length,
        topPerformers: topPerformers.length,
        hasVoice: !!voiceSection,
      });

      // Build context from all inputs - PRIORITIZE REAL EXTRACTED DATA
      let context = "";
      let hasInstagramReference = false;
      
      for (const input of inputs) {
        if (input.type === "instagram") {
          hasInstagramReference = true;
          context += `\n\n### REFERÊNCIA INSTAGRAM (USE COMO BASE PRINCIPAL):`;
          if (input.caption) {
            context += `\n**Legenda original do post:**\n${input.caption}`;
          }
          if (input.imageCount) {
            context += `\n**Número de slides/imagens:** ${input.imageCount}`;
          }
          if (input.transcription) {
            context += `\n**Transcrição do vídeo/áudio:**\n${input.transcription}`;
          }
          context += `\n---`;
        } else if (input.type === "youtube") {
          context += `\n\n### REFERÊNCIA YOUTUBE:`;
          context += `\n**Transcrição:**\n${input.transcription || input.content}`;
          context += `\n---`;
        } else if (input.type === "text") {
          context += `\n\n### Texto/Briefing do usuário:\n${input.content}`;
        } else if (input.type === "url") {
          context += `\n\n### Conteúdo de URL:\n${input.transcription || input.content}`;
        } else if (input.type === "image" && input.analysis) {
          context += `\n\n### Análise de Imagem:\n${JSON.stringify(input.analysis, null, 2)}`;
        } else if ((input.type === "video" || input.type === "audio") && input.transcription) {
          context += `\n\n### Transcrição de ${input.type === "video" ? "Vídeo" : "Áudio"}:\n${input.transcription}`;
        }
      }

      // ===================================================
      // FORMATO: Buscar do banco primeiro, fallback hardcoded
      // ===================================================
      let formatRules = "";
      const requestedFormat = config.format || "post";
      
      console.log("[generate-content-v2] Loading format rules for:", requestedFormat);
      
      const dbFormatDocs = await getFormatDocs(requestedFormat);
      
      if (dbFormatDocs && dbFormatDocs.trim().length > 50) {
        formatRules = `## 📋 REGRAS DO FORMATO: ${requestedFormat.toUpperCase()}\n\n${dbFormatDocs}`;
        console.log("[generate-content-v2] Using DB format rules, length:", dbFormatDocs.length);
      } else {
        formatRules = getFormatRules(requestedFormat);
        console.log("[generate-content-v2] Using hardcoded format rules (fallback)");
      }

      // Build enriched prompt with brand context
      let brandSection = "";
      if (brandContext) {
        brandSection = `
## IDENTIDADE DA MARCA:
- Nome: ${brandContext.name || "Não especificado"}
${brandContext.brandVoice ? `- Tom de voz: ${brandContext.brandVoice}` : ""}
${brandContext.values ? `- Valores: ${brandContext.values}` : ""}
${brandContext.keywords?.length ? `- Palavras-chave: ${brandContext.keywords.join(", ")}` : ""}
`;
      }

      // Voice Profile section (USE/AVOID)
      let voiceProfileSection = "";
      if (voiceSection) {
        voiceProfileSection = `\n${voiceSection}\n`;
      }

      // Add favorites as style reference
      let favoritesSection = "";
      if (favorites.length > 0) {
        favoritesSection = `\n## 🎯 EXEMPLOS FAVORITOS DO CLIENTE (USE COMO REFERÊNCIA DE TOM E ESTILO)\n*Replique o tom, estrutura e linguagem:*\n\n`;
        favorites.forEach((fav, i) => {
          favoritesSection += `**Exemplo ${i + 1}: "${fav.title}"** (${fav.type})\n\`\`\`\n${fav.content}\n\`\`\`\n\n`;
        });
      }

      // Add top performers for inspiration
      let performersSection = "";
      if (topPerformers.length > 0) {
        performersSection = `\n## 🏆 CONTEÚDOS DE MAIOR PERFORMANCE (USE COMO INSPIRAÇÃO)\n*Analise o que funcionou:*\n\n`;
        topPerformers.forEach((perf, i) => {
        performersSection += `**Top ${i + 1} [${perf.type}]** - ${perf.metric}\n*"${perf.title}"*\n\`\`\`\n${perf.content}\n\`\`\`\n\n`;
        });
      }

      // STRICT rules when using references
      const strictReferenceRules = hasInstagramReference ? `
## REGRAS ABSOLUTAS PARA REFERÊNCIA INSTAGRAM:
1. Use EXCLUSIVAMENTE o conteúdo da referência Instagram fornecida
2. NÃO invente dados, estatísticas, exemplos ou informações que não estejam nas referências
3. Mantenha o TEMA e ASSUNTO exato da referência original
4. Se for carrossel, use número similar de slides
5. Adapte a linguagem para a plataforma, mas mantenha o conteúdo fiel
6. Se a referência fala de um tema específico, NÃO mude para outro tema
` : "";

      // Success Patterns + Checklist
      let enrichmentContext = "";
      
      if (clientId) {
        const successPatterns = await getSuccessPatterns(clientId);
        if (successPatterns) {
          enrichmentContext += successPatterns;
          console.log("[generate-content-v2] Added success patterns");
        }
      }
      
      const checklist = await getFormatChecklistFormatted(requestedFormat);
      if (checklist) {
        enrichmentContext += checklist;
        console.log("[generate-content-v2] Added format checklist");
      }

      // Quality rules (forbidden phrases + universal rules)
      const forbiddenPhrases = buildForbiddenPhrasesSection();

      const prompt = `${UNIVERSAL_OUTPUT_RULES}

${forbiddenPhrases}

Você é um copywriter especialista em criação de conteúdo para redes sociais e marketing digital.

${brandSection}${voiceProfileSection}${favoritesSection}${performersSection}${strictReferenceRules}

## CONTEXTO E REFERÊNCIAS DO USUÁRIO:
${context}

${formatRules}

${enrichmentContext}

## Formato Solicitado: ${config.format || "post"}
## Plataforma: ${config.platform || "instagram"}

Siga EXATAMENTE o formato de entrega especificado nas regras acima.
Gere o conteúdo agora:`;

      console.log("[generate-content-v2] Generating text with unified rules...");

      // Select model based on format complexity
      const modelConfig = selectModelForFormat(requestedFormat);
      const modelName = modelConfig.model;
      console.log(`[generate-content-v2] Using model: ${modelName} for format: ${requestedFormat}`);

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GOOGLE_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: modelConfig.temperature,
              maxOutputTokens: modelConfig.maxTokens,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[generate-content-v2] API error:", errorText);
        throw new Error("Failed to generate text");
      }

      const aiData = await response.json();
      const generatedText = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

      // Log AI usage
      if (userId) {
        try {
          const svcLogger = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
          const inTok = aiData?.usageMetadata?.promptTokenCount ?? estimateTokens(prompt);
          const outTok = aiData?.usageMetadata?.candidatesTokenCount ?? estimateTokens(generatedText);
          await logAIUsage(svcLogger, userId, modelName, "generate-content-v2", inTok, outTok, {
            client_id: clientId,
            format: requestedFormat,
            platform: config.platform,
          });
        } catch (e) {
          console.error("[generate-content-v2] Failed to log usage:", e);
        }
      }

      // Special handling for thread format - parse structured response
      if (config.format === 'thread') {
        try {
          const parsedTweets: Array<{ id: string; text: string; media_urls: string[] }> = [];
          
          // Method 1: Split by --- separator (preferred format)
          if (generatedText.includes('---')) {
            const parts = generatedText.split(/\n*---\n*/g).filter((p: string) => p.trim());
            parts.forEach((part: string, i: number) => {
              // Clean up "Tweet X:" prefixes if present
              let cleanText = part
                .replace(/^Tweet\s*\d+:?\s*/i, '')
                .replace(/^\[\w+[^\]]*\]:?\s*/i, '') // Remove [Hook], [CTA] etc
                .trim();
              
              if (cleanText && cleanText.length > 5) {
                parsedTweets.push({
                  id: `tweet-${i + 1}`,
                  text: cleanText.substring(0, 280),
                  media_urls: []
                });
              }
            });
          }
          
          // Method 2: Try numbered format (1/, 2/, etc) or (1., 2., etc)
          if (parsedTweets.length < 2) {
            const numberedPattern = /(?:^|\n\n?)(\d+)[\/\.\)]\s*([^]*?)(?=\n\n?\d+[\/\.\)]|$)/g;
            let match;
            let tempTweets: Array<{ id: string; text: string; media_urls: string[] }> = [];
            while ((match = numberedPattern.exec(generatedText)) !== null) {
              const text = match[2].trim();
              if (text && text.length > 5) {
                tempTweets.push({
                  id: `tweet-${tempTweets.length + 1}`,
                  text: text.substring(0, 280),
                  media_urls: []
                });
              }
            }
            if (tempTweets.length >= 2) {
              parsedTweets.length = 0;
              parsedTweets.push(...tempTweets);
            }
          }
          
          // Method 3: Try "Tweet X:" format
          if (parsedTweets.length < 2) {
            const tweetPattern = /Tweet\s*\d+:?\s*([^]*?)(?=Tweet\s*\d+:|$)/gi;
            let match;
            let tempTweets: Array<{ id: string; text: string; media_urls: string[] }> = [];
            while ((match = tweetPattern.exec(generatedText)) !== null) {
              const text = match[1].trim();
              if (text && text.length > 5) {
                tempTweets.push({
                  id: `tweet-${tempTweets.length + 1}`,
                  text: text.substring(0, 280),
                  media_urls: []
                });
              }
            }
            if (tempTweets.length >= 2) {
              parsedTweets.length = 0;
              parsedTweets.push(...tempTweets);
            }
          }
          
          // Method 4: Try JSON if AI returned it anyway
          if (parsedTweets.length < 2) {
            const jsonMatch = generatedText.match(/\{[\s\S]*"thread_tweets"[\s\S]*\}/);
            if (jsonMatch) {
              try {
                const threadData = JSON.parse(jsonMatch[0]);
                if (threadData.thread_tweets && Array.isArray(threadData.thread_tweets)) {
                  threadData.thread_tweets.forEach((t: any, i: number) => {
                    const text = (t.text || t.content || '').trim();
                    if (text) {
                      parsedTweets.push({
                        id: `tweet-${i + 1}`,
                        text: text.substring(0, 280),
                        media_urls: []
                      });
                    }
                  });
                }
              } catch (e) {
                console.log("[generate-content-v2] JSON parse failed");
              }
            }
          }
          
          if (parsedTweets.length >= 2) {
            // Build clean content from parsed tweets
            const cleanContent = parsedTweets.map((t, i) => `Tweet ${i + 1}:\n${t.text}`).join('\n\n---\n\n');
            
            console.log(`[generate-content-v2] Parsed ${parsedTweets.length} tweets for thread`);
            return new Response(
              JSON.stringify({ 
                content: cleanContent,
                thread_tweets: parsedTweets
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          
          console.log("[generate-content-v2] Could not parse thread, returning single tweet fallback");
        } catch (parseErr) {
          console.log("[generate-content-v2] Thread parsing failed:", parseErr);
        }
      }

      return new Response(
        JSON.stringify({ content: generatedText }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else {
      // Image generation with style matching - using English for better results
      // Uses high-quality model (gemini-3-pro-image-preview) for better results
      
      // Build base prompt from client style preferences
      let preferredStyle = "";
      if (brandContext) {
        // Check for client-specific style preference in brand_assets
        const brandAssets = brandContext as any;
        preferredStyle = brandAssets?.visual_style?.preferred_style || 
                         brandAssets?.visual_style?.photography_style || "";
      }
      
      // EMPHATIC NO-TEXT instruction if enabled
      let noTextPrefix = "";
      if (config.noText) {
        noTextPrefix = `🚫 CRITICAL - ABSOLUTELY NO TEXT IN THIS IMAGE 🚫
⛔ This image MUST NOT contain ANY:
   - Text, letters, numbers, or symbols (in ANY language)
   - Words, typography, captions, or titles
   - Watermarks, logos with text, or written content
   - Decorative text or any readable characters
   
⚠️ IF ANY TEXT APPEARS, THE IMAGE WILL BE IMMEDIATELY REJECTED.
⚠️ Generate ONLY visual elements - no text whatsoever.

`;
      }
      
      let imagePrompt = `${noTextPrefix}Create a professional, high-quality social media image.

QUALITY REQUIREMENTS:
- Ultra high resolution, professional photography or illustration
- Clean, polished composition with great attention to detail
- Vibrant, eye-catching colors
- Modern, sophisticated aesthetic
${config.noText ? '- PURE VISUAL CONTENT ONLY - NO TEXT, LETTERS, OR NUMBERS' : ''}

`;
      let referenceImage: string | null = null;
      let styleDescription = "";
      let briefingText = "";

      // Build prompt from inputs
      for (const input of inputs) {
        if (input.type === "image" && input.imageBase64) {
          referenceImage = input.imageBase64;
          if (input.analysis) {
            // Extract style details from analysis
            const analysis = input.analysis as Record<string, any>;
            if (analysis.generation_prompt) {
              styleDescription += `\nREFERENCE STYLE: ${analysis.generation_prompt}`;
            }
            if (analysis.color_palette) {
              const colors = analysis.color_palette.dominant_colors || [];
              if (colors.length > 0) {
                styleDescription += `\nCOLOR PALETTE: ${colors.join(", ")}`;
              }
            }
            if (analysis.mood_atmosphere) {
              styleDescription += `\nMOOD: ${analysis.mood_atmosphere.overall_mood || ""}`;
            }
          }
        } else if (input.type === "text") {
          briefingText += input.content + " ";
        } else if (input.transcription) {
          briefingText += input.transcription + " ";
        }
      }

      // Improved briefing extraction - create visual theme from text
      if (briefingText.trim()) {
        const themeSummary = briefingText.trim().substring(0, 500);
        imagePrompt += `VISUAL CONCEPT/THEME:
Based on this content, create a compelling visual representation:
"${themeSummary}"

Create an image that captures the essence, mood, and topic of this content.
The image should evoke the main theme visually without being overly literal.

`;
      }

      // Fetch visual references from client profile
      const visualRefs = await fetchClientVisualReferences(supabaseClient, clientId || null);
      const hasVisualRefs = visualRefs.length > 0;
      const useVisualReferences = (config as any).useVisualReferences || false;
      
      // Collect reference image URLs to pass as visual input to the model
      const referenceImageUrls: string[] = [];
      
      if (visualRefs.length > 0) {
        imagePrompt += `CLIENT VISUAL REFERENCES (match this style EXACTLY):\n`;
        
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        
        for (const ref of visualRefs) {
          // Build full URL for the reference image
          if (ref.imageUrl) {
            const fullUrl = ref.imageUrl.startsWith('http') 
              ? ref.imageUrl 
              : `${supabaseUrl}/storage/v1/object/public/client-files/${ref.imageUrl}`;
            referenceImageUrls.push(fullUrl);
          }
          
          if (ref.styleAnalysis) {
            if (ref.styleAnalysis.style_summary) {
              imagePrompt += `- ${ref.type.toUpperCase()} STYLE: ${ref.styleAnalysis.style_summary}\n`;
            }
            if (ref.styleAnalysis.visual_elements?.photography_style) {
              imagePrompt += `  Photography: ${ref.styleAnalysis.visual_elements.photography_style}\n`;
            }
            if (ref.styleAnalysis.visual_elements?.color_palette && ref.styleAnalysis.visual_elements.color_palette.length > 0) {
              imagePrompt += `  Colors: ${ref.styleAnalysis.visual_elements.color_palette.join(', ')}\n`;
            }
          }
        }
        
        if (referenceImageUrls.length > 0) {
          imagePrompt += `\n⚡ IMPORTANT: Reference images are provided as visual input. Study them carefully and replicate the EXACT art style, character design, color palette, and linework.\n`;
        }
        imagePrompt += "\n";
      }
      
      // Also collect reference images passed directly from process-automations inputs
      for (const input of inputs) {
        if (input.type === "image" && input.content && !input.imageBase64) {
          // This is a URL reference image from process-automations
          if (input.content.startsWith('http') && !referenceImageUrls.includes(input.content)) {
            referenceImageUrls.push(input.content);
          }
        }
      }
      
      console.log("[generate-content-v2] Reference images to pass to model:", referenceImageUrls.length);

      // Add client-specific style if available
      if (preferredStyle) {
        imagePrompt += `PREFERRED VISUAL STYLE: ${preferredStyle}\n\n`;
      }

      // Add brand visual identity
      if (brandContext) {
        imagePrompt += `BRAND VISUAL IDENTITY:\n`;
        if (brandContext.colorPalette?.primary) {
          imagePrompt += `- Primary color: ${brandContext.colorPalette.primary}\n`;
        }
        if (brandContext.colorPalette?.secondary) {
          imagePrompt += `- Secondary color: ${brandContext.colorPalette.secondary}\n`;
        }
        if (brandContext.photographyStyle) {
          imagePrompt += `- Photography style: ${brandContext.photographyStyle}\n`;
        }
        if (brandContext.name) {
          imagePrompt += `- Brand: ${brandContext.name}\n`;
        }
        imagePrompt += "\n";
      }

      // Add style description from reference
      if (styleDescription) {
        imagePrompt += `STYLE MATCHING (replicate this exactly):\n${styleDescription}\n\n`;
      }

      // Add config instructions
      if (config.aspectRatio) {
        const aspectRatioMap: Record<string, string> = {
          "1:1": "Square format (1:1 ratio, 1024x1024px)",
          "4:5": "Portrait format (4:5 ratio, 1024x1280px)",
          "9:16": "Vertical/Stories format (9:16 ratio, 1080x1920px)",
          "16:9": "Landscape format (16:9 ratio, 1920x1080px)",
        };
        imagePrompt += `ASPECT RATIO: ${aspectRatioMap[config.aspectRatio] || config.aspectRatio}\n\n`;
      }
      
      // Add negative prompt with EMPHATIC no-text rules if enabled
      imagePrompt += `AVOID (STRICTLY FORBIDDEN):
- Blurry or low resolution images
- Artificial-looking elements
- Overly saturated or garish colors
- Distorted proportions
`;
      
      if (config.noText) {
        imagePrompt += `
⛔ CRITICAL - THE FOLLOWING WILL CAUSE IMMEDIATE REJECTION:
- ANY text, letters, numbers, or symbols in any language
- Typography, fonts, or written words of any kind
- Watermarks with text
- Logos that contain text or letters
- Decorative text, titles, or captions
- Numbers, symbols, characters, or glyphs
- ANY readable content whatsoever
`;
      }
      if (config.preserveFace && referenceImage) {
        imagePrompt += `\nIMPORTANT: Preserve the exact facial features and characteristics of the person in the reference image.\n`;
      }

      // Add strong consistency instructions
      imagePrompt += `
GENERATION RULES:
1. Maintain total fidelity to the described visual style
2. Use ONLY the colors mentioned when specified
3. Preserve the composition and framing of the reference if provided
4. High quality, professional result
5. Clean, modern aesthetic
${config.noText ? '6. 🚫 ABSOLUTELY NO TEXT, LETTERS, NUMBERS, OR WRITTEN CONTENT OF ANY KIND' : ''}`;

      console.log("[generate-content-v2] Generating image with enhanced prompt:");
      console.log("[generate-content-v2] Prompt length:", imagePrompt.length, "chars");
      console.log("[generate-content-v2] Has reference image:", !!referenceImage);
      console.log("[generate-content-v2] Aspect ratio:", config.aspectRatio || "default");
      console.log("[generate-content-v2] No text:", config.noText);
      console.log("[generate-content-v2] Using high-quality model: gemini-3-pro-image-preview");

      // Build request parts
      const parts: any[] = [];

      if (referenceImage) {
        const match = referenceImage.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          parts.push({
            inlineData: {
              mimeType: match[1],
              data: match[2],
            },
          });
        }
      }

      parts.push({ text: imagePrompt });

      // Auto-retry mechanism for no-text requirement
      const MAX_RETRIES = config.noText ? 2 : 0;
      let attempt = 0;
      let imageBase64: string | null = null;
      let mimeType = "image/png";
      
      while (attempt <= MAX_RETRIES) {
        attempt++;
        console.log(`[generate-content-v2] Image generation attempt ${attempt}/${MAX_RETRIES + 1}`);

        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
        
        // Build content with reference images as visual input
        let imageContent: any;
        
        if (referenceImageUrls.length > 0 || referenceImage) {
          // Multi-modal: text + reference images
          const contentParts: any[] = [{ type: "text", text: imagePrompt }];
          
          // Add reference image (user-uploaded)
          if (referenceImage) {
            contentParts.push({ type: "image_url", image_url: { url: referenceImage } });
          }
          
          // Add client visual reference images (anime style refs etc.)
          for (const refUrl of referenceImageUrls.slice(0, 3)) {
            contentParts.push({ type: "image_url", image_url: { url: refUrl } });
          }
          
          imageContent = contentParts;
          console.log(`[generate-content-v2] Sending ${contentParts.length - 1} reference images to model`);
        } else {
          imageContent = referenceImage 
            ? [{ type: "text", text: imagePrompt }, { type: "image_url", image_url: { url: referenceImage } }]
            : imagePrompt;
        }
        
        // Use pro model when visual references exist for maximum quality
        const imageModel = (hasVisualRefs || useVisualReferences) 
          ? "google/gemini-3-pro-image-preview" 
          : "google/gemini-2.5-flash-image";
        
        console.log(`[generate-content-v2] Using model: ${imageModel}`);
        
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: imageModel,
            messages: [{ role: "user", content: imageContent }],
            modalities: ["image", "text"],
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("[generate-content-v2] Image API error:", errorText);
          
          if (response.status === 429) {
            return new Response(
              JSON.stringify({ error: "Rate limit exceeded. Please wait a moment." }),
              { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          
          throw new Error("Failed to generate image");
        }

        const data = await response.json();
        
        // Extract image from Lovable AI Gateway response
        const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        if (imageUrl && imageUrl.startsWith("data:image/")) {
          // Parse data URL: data:image/png;base64,XXXXX
          const matches = imageUrl.match(/^data:(image\/\w+);base64,(.+)$/);
          if (matches) {
            mimeType = matches[1];
            imageBase64 = matches[2];
          }
        }

        if (!imageBase64) {
          if (attempt <= MAX_RETRIES) {
            console.log("[generate-content-v2] No image generated, retrying...");
            continue;
          }
          return new Response(
            JSON.stringify({ error: "No image generated" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // If noText is enabled, we've done what we can - the emphatic prompts should help
        // No OCR validation available, just trust the emphatic prompts worked
        break;
      }

      if (!imageBase64) {
        return new Response(
          JSON.stringify({ error: "Failed to generate image after retries" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Upload to storage - use clientId as fallback for service_role calls
      const uploadUserId = isServiceRole ? (clientId || "automation") : (await supabaseClient.auth.getUser()).data?.user?.id || "unknown";
      const fileName = `generated/${uploadUserId}/${Date.now()}.${mimeType.split("/")[1] || "png"}`;
      const imageBuffer = Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0));

      const { error: uploadError } = await supabaseClient.storage
        .from("client-files")
        .upload(fileName, imageBuffer, {
          contentType: mimeType,
          upsert: true,
        });

      if (uploadError) {
        console.error("[generate-content-v2] Upload error:", uploadError);
        // Return base64 as fallback
        return new Response(
          JSON.stringify({ imageUrl: `data:${mimeType};base64,${imageBase64}` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: { publicUrl } } = supabaseClient.storage
        .from("client-files")
        .getPublicUrl(fileName);

      console.log("[generate-content-v2] Image generated and uploaded successfully");

      return new Response(
        JSON.stringify({ imageUrl: publicUrl }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error) {
    console.error("[generate-content-v2] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
