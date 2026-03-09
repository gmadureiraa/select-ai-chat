// =====================================================
// CARREGADOR DE DOCUMENTAÇÃO DE AGENTES E FORMATOS
// Versão 3.0 - Suporta Voice Profile estruturado + Format Schemas
// =====================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import { getFormatSchema, buildFormatContract, FormatSchema } from "./format-schemas.ts";
import { buildForbiddenPhrasesSection, UNIVERSAL_OUTPUT_RULES } from "./quality-rules.ts";

// Interface para documentação
interface KaiDocumentation {
  id: string;
  doc_type: 'format' | 'agent' | 'flow';
  doc_key: string;
  title: string;
  content: string;
  summary: string | null;
  checklist: string[];
  metadata: Record<string, unknown>;
  output_schema?: Record<string, unknown>;
}

// Interface para Voice Profile do cliente
export interface VoiceProfile {
  tone?: string;
  use?: string[];
  avoid?: string[];
}

// Cache em memória para documentos já carregados (por sessão da edge function)
const docsCache: Map<string, KaiDocumentation> = new Map();

// Mapeamento de aliases para chaves canônicas
const FORMAT_KEY_ALIASES: Record<string, string> = {
  "newsletter": "newsletter",
  "blog_post": "blog_post",
  "blogpost": "blog_post",
  "carousel": "carousel",
  "carrossel": "carousel",
  "thread": "thread",
  "tweet": "tweet",
  "linkedin_post": "linkedin_post",
  "linkedin": "linkedin_post",
  "stories": "stories",
  "story": "stories",
  "storie": "stories",
  "short_video": "short_video",
  "reels": "short_video",
  "tiktok": "short_video",
  "shorts": "short_video",
  "long_video": "long_video",
  "youtube": "long_video",
  "x_article": "x_article",
  "artigo_x": "x_article",
  "artigo": "x_article",
  "instagram_post": "instagram_post",
  "post_instagram": "instagram_post",
  "post": "instagram_post",
  "email": "email_marketing",
  "email_marketing": "email_marketing",
};

const AGENT_KEY_ALIASES: Record<string, string> = {
  "researcher": "researcher",
  "pesquisador": "researcher",
  "writer": "content_writer",
  "escritor": "content_writer",
  "content_writer": "content_writer",
  "editor": "editor",
  "reviewer": "reviewer",
  "revisor": "reviewer",
  "strategist": "strategist",
  "estrategista": "strategist",
  "metrics_analyst": "metrics_analyst",
  "analista": "metrics_analyst",
  "design_agent": "design_agent",
  "designer": "design_agent",
  "email_developer": "email_developer",
};

// Criar cliente Supabase para edge functions
function getSupabaseClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing required environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  
  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Busca documentação do banco de dados
 */
async function fetchDocumentation(
  docType: 'format' | 'agent',
  docKey: string
): Promise<KaiDocumentation | null> {
  const cacheKey = `${docType}_${docKey}`;
  
  // Verificar cache primeiro
  if (docsCache.has(cacheKey)) {
    return docsCache.get(cacheKey)!;
  }
  
  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('kai_documentation')
      .select('*')
      .eq('doc_type', docType)
      .eq('doc_key', docKey)
      .single();
    
    if (error || !data) {
      console.log(`[KNOWLEDGE-LOADER] Doc not found: ${docType}/${docKey}`);
      return null;
    }
    
    const doc: KaiDocumentation = {
      id: data.id,
      doc_type: data.doc_type,
      doc_key: data.doc_key,
      title: data.title,
      content: data.content,
      summary: data.summary,
      checklist: data.checklist || [],
      metadata: data.metadata || {},
    };
    
    // Cachear
    docsCache.set(cacheKey, doc);
    
    return doc;
  } catch (err) {
    console.error(`[KNOWLEDGE-LOADER] Error fetching ${docType}/${docKey}:`, err);
    return null;
  }
}

/**
 * Normaliza a chave do formato
 */
export function normalizeFormatKey(contentType: string): string {
  const normalized = contentType.toLowerCase().replace(/-/g, "_").trim();
  return FORMAT_KEY_ALIASES[normalized] || normalized;
}

/**
 * Normaliza a chave do agente
 */
function normalizeAgentKey(agentId: string): string {
  const normalized = agentId.toLowerCase().replace(/-/g, "_").trim();
  return AGENT_KEY_ALIASES[normalized] || normalized;
}

/**
 * Carrega documentação de um agente específico
 */
export async function getAgentDocs(agentId: string): Promise<string> {
  const normalizedKey = normalizeAgentKey(agentId);
  
  const doc = await fetchDocumentation('agent', normalizedKey);
  
  if (doc) {
    return doc.content;
  }
  
  // Fallback para documentação embeddada básica
  return getFallbackAgentDocs(normalizedKey);
}

/**
 * Carrega documentação de um formato específico
 */
export async function getFormatDocs(contentType: string): Promise<string> {
  const normalizedKey = normalizeFormatKey(contentType);
  
  const doc = await fetchDocumentation('format', normalizedKey);
  
  if (doc) {
    return doc.content;
  }
  
  // Fallback para documentação embeddada básica
  return getFallbackFormatDocs(normalizedKey);
}

/**
 * Carrega checklist de validação de um formato (retorna array)
 */
export async function getFormatChecklist(contentType: string): Promise<string[]> {
  const normalizedKey = normalizeFormatKey(contentType);
  
  const doc = await fetchDocumentation('format', normalizedKey);
  
  return doc?.checklist || [];
}

/**
 * Carrega checklist de validação formatado como string para injeção no prompt
 * Usado para IA auto-validar o output antes de entregar
 */
export async function getFormatChecklistFormatted(contentType: string): Promise<string> {
  const checklist = await getFormatChecklist(contentType);
  
  if (!checklist || checklist.length === 0) return "";
  
  let validation = "\n## ✅ CHECKLIST DE AUTO-VALIDAÇÃO\n";
  validation += "*VERIFIQUE mentalmente antes de entregar a resposta final:*\n\n";
  
  checklist.forEach((item, i) => {
    validation += `${i + 1}. ${item}\n`;
  });
  
  validation += "\n⚠️ NÃO inclua este checklist na resposta. Use apenas para validar internamente.\n";
  
  return validation;
}

/**
 * Busca conhecimento global do workspace (melhores práticas, tendências, insights)
 */
export async function getGlobalKnowledge(workspaceId: string, limit = 5): Promise<string> {
  if (!workspaceId) return "";
  
  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from("global_knowledge")
      .select("title, summary, category, content")
      .eq("workspace_id", workspaceId)
      .limit(limit);
    
    if (error || !data || data.length === 0) return "";
    
    let context = "\n## 📚 BASE DE CONHECIMENTO GLOBAL\n";
    context += "*Use esses insights para enriquecer o conteúdo:*\n\n";
    
    for (const item of data) {
      context += `### ${item.title} (${item.category})\n`;
      context += (item.summary || item.content?.substring(0, 500) || "") + "\n\n";
    }
    
    return context;
  } catch (err) {
    console.error("[KNOWLEDGE-LOADER] Error fetching global knowledge:", err);
    return "";
  }
}

/**
 * Extrai padrões de sucesso dos conteúdos de alta performance do cliente
 * Analisa o que funcionou para gerar insights acionáveis
 */
export async function getSuccessPatterns(clientId: string): Promise<string> {
  if (!clientId) return "";
  
  try {
    const supabase = getSupabaseClient();
    
    // Buscar posts com maior engagement
    const { data: topPosts, error } = await supabase
      .from("instagram_posts")
      .select("caption, post_type, engagement_rate")
      .eq("client_id", clientId)
      .not("engagement_rate", "is", null)
      .order("engagement_rate", { ascending: false })
      .limit(5);
    
    if (error || !topPosts || topPosts.length === 0) return "";
    
    let patterns = "\n## 🎯 PADRÕES QUE FUNCIONAM PARA ESTE CLIENTE\n";
    patterns += "*Baseado em análise de posts de alta performance:*\n\n";
    
    // Analisar padrões comuns
    let hasQuestions = 0;
    let hasEmojis = 0;
    let hasCTA = 0;
    let hasNumbers = 0;
    let shortCaptions = 0;
    
    for (const post of topPosts) {
      if (!post.caption) continue;
      
      const caption = post.caption;
      const engagementPct = ((post.engagement_rate || 0) * 100).toFixed(1);
      
      patterns += `- **${post.post_type || 'Post'}** com ${engagementPct}% engagement\n`;
      
      // Detectar padrões
      if (/\?/.test(caption)) hasQuestions++;
      if (/[\u{1F600}-\u{1F6FF}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}]/u.test(caption)) hasEmojis++;
      if (/(coment|compartilh|salv|link|bio|clique|acesse|saiba mais)/i.test(caption)) hasCTA++;
      if (/\d+/.test(caption)) hasNumbers++;
      if (caption.length < 150) shortCaptions++;
    }
    
    patterns += "\n**Insights detectados:**\n";
    if (hasQuestions >= 2) patterns += "- ✅ Usar perguntas aumenta engajamento\n";
    if (hasEmojis >= 2) patterns += "- ✅ Emojis estratégicos funcionam bem\n";
    if (hasCTA >= 2) patterns += "- ✅ CTAs claros geram mais ação\n";
    if (hasNumbers >= 2) patterns += "- ✅ Números/dados chamam atenção\n";
    if (shortCaptions >= 2) patterns += "- ✅ Legendas mais curtas performam melhor\n";
    
    patterns += "\n";
    
    return patterns;
  } catch (err) {
    console.error("[KNOWLEDGE-LOADER] Error extracting success patterns:", err);
    return "";
  }
}

/**
 * Monta o contexto completo de documentação para um agente
 * baseado no tipo de conteúdo sendo criado
 */
export async function buildAgentContext(agentId: string, contentType: string): Promise<string> {
  const agentDocs = await getAgentDocs(agentId);
  const formatDocs = await getFormatDocs(contentType);
  
  let context = "";
  
  if (agentDocs) {
    context += `# DIRETRIZES DO AGENTE\n\n${agentDocs}\n\n`;
  }
  
  // Só adiciona docs de formato para agentes que criam conteúdo
  const contentAgents = ["writer", "escritor", "content_writer", "editor", "reviewer", "revisor"];
  if (formatDocs && contentAgents.includes(agentId.toLowerCase())) {
    context += `# REGRAS DO FORMATO\n\n${formatDocs}\n\n`;
  }
  
  return context;
}

/**
 * Limpa o cache de documentos
 */
export function clearDocsCache(): void {
  docsCache.clear();
}

// =====================================================
// VOZ ESTRUTURADA DO CLIENTE
// =====================================================

/**
 * Busca o voice profile estruturado do cliente (Use/Evite)
 * Retorna uma seção formatada para o prompt
 */
export async function getStructuredVoice(clientId: string): Promise<string> {
  if (!clientId) return "";
  
  try {
    const supabase = getSupabaseClient();
    
    const { data: client, error } = await supabase
      .from("clients")
      .select("name, voice_profile, identity_guide")
      .eq("id", clientId)
      .single();
    
    if (error || !client) return "";
    
    let voiceSection = "";
    
    // Parse voice_profile JSONB
    const voiceProfile: VoiceProfile = client.voice_profile || {};
    
    if (voiceProfile.tone || voiceProfile.use?.length || voiceProfile.avoid?.length) {
      voiceSection += `## 🎯 VOZ DO CLIENTE: ${client.name}\n\n`;
      
      if (voiceProfile.tone) {
        voiceSection += `**Tom:** ${voiceProfile.tone}\n\n`;
      }
      
      if (voiceProfile.use && voiceProfile.use.length > 0) {
        voiceSection += `**USE (expressões/padrões que funcionam):**\n`;
        for (const item of voiceProfile.use) {
          voiceSection += `✅ ${item}\n`;
        }
        voiceSection += `\n`;
      }
      
      if (voiceProfile.avoid && voiceProfile.avoid.length > 0) {
        voiceSection += `**EVITE (proibido para este cliente):**\n`;
        for (const item of voiceProfile.avoid) {
          voiceSection += `❌ ${item}\n`;
        }
        voiceSection += `\n`;
      }
    }
    
    return voiceSection;
  } catch (err) {
    console.error("[KNOWLEDGE-LOADER] Error fetching voice profile:", err);
    return "";
  }
}

/**
 * Retorna a lista de palavras a evitar do cliente (para validação)
 */
export async function getClientAvoidList(clientId: string): Promise<string[]> {
  if (!clientId) return [];
  
  try {
    const supabase = getSupabaseClient();
    
    const { data: client } = await supabase
      .from("clients")
      .select("voice_profile")
      .eq("id", clientId)
      .single();
    
    if (!client?.voice_profile) return [];
    
    const voiceProfile: VoiceProfile = client.voice_profile;
    return voiceProfile.avoid || [];
  } catch {
    return [];
  }
}

// Re-export types and functions from new modules
export { getFormatSchema, buildFormatContract } from "./format-schemas.ts";
export { buildForbiddenPhrasesSection, UNIVERSAL_OUTPUT_RULES } from "./quality-rules.ts";
export type { VoiceProfile };

/**
 * Retorna lista de formatos disponíveis
 */
export async function getAvailableFormats(): Promise<string[]> {
  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('kai_documentation')
      .select('doc_key')
      .eq('doc_type', 'format');
    
    if (error || !data) return Object.values(FORMAT_KEY_ALIASES);
    
    return data.map(d => d.doc_key);
  } catch {
    return Object.values(FORMAT_KEY_ALIASES);
  }
}

/**
 * Retorna lista de agentes disponíveis
 */
export async function getAvailableAgents(): Promise<string[]> {
  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('kai_documentation')
      .select('doc_key')
      .eq('doc_type', 'agent');
    
    if (error || !data) return Object.values(AGENT_KEY_ALIASES);
    
    return data.map(d => d.doc_key);
  } catch {
    return Object.values(AGENT_KEY_ALIASES);
  }
}

// =====================================================
// CONTEXTO UNIFICADO PARA GERAÇÃO DE CONTEÚDO
// Combina: Regras de Formato + Identidade do Cliente + Exemplos
// =====================================================

interface FullContentContextParams {
  clientId: string;
  format: string;
  includeLibrary?: boolean;
  includeTopPerformers?: boolean;
  maxLibraryExamples?: number;
  maxTopPerformers?: number;
}

interface ContentExample {
  title: string;
  content: string;
  type: string;
  metric?: string;
}

/**
 * Monta o contexto completo de conteúdo para qualquer agente.
 * Essa é a FUNÇÃO CENTRAL que garante consistência em todos os ambientes.
 * 
 * Retorna um bloco de texto formatado contendo:
 * 1. Regras do formato (do kai_documentation)
 * 2. Contexto do cliente (identity_guide + context_notes)
 * 3. Exemplos favoritos da biblioteca (se includeLibrary = true)
 * 4. Top performers do Instagram/YouTube (se includeTopPerformers = true)
 */
export async function getFullContentContext(params: FullContentContextParams & {
  workspaceId?: string;
  includeGlobalKnowledge?: boolean;
  includeSuccessPatterns?: boolean;
  includeChecklist?: boolean;
}): Promise<string> {
  const { 
    clientId, 
    format, 
    includeLibrary = true, 
    includeTopPerformers = true,
    maxLibraryExamples = 5,
    maxTopPerformers = 5,
    workspaceId,
    includeGlobalKnowledge = true,
    includeSuccessPatterns = true,
    includeChecklist = true,
  } = params;
  
  const supabase = getSupabaseClient();
  let context = "";
  
  // 1. REGRAS DO FORMATO (do banco, com fallback)
  const formatDocs = await getFormatDocs(format);
  if (formatDocs) {
    context += `## 📋 REGRAS DO FORMATO: ${format.toUpperCase()}\n\n${formatDocs}\n\n---\n\n`;
  }
  
  // 2. CONTEXTO DO CLIENTE (identity_guide como documento mestre)
  try {
    const { data: client, error } = await supabase
      .from("clients")
      .select("name, identity_guide, description, context_notes, social_media, content_guidelines")
      .eq("id", clientId)
      .single();
    
    if (!error && client) {
      if (client.identity_guide) {
        context += `## 🎯 CONTEXTO OPERACIONAL DO CLIENTE (DOCUMENTO MESTRE)\n\n`;
        context += `*SIGA RIGOROSAMENTE as diretrizes abaixo. Este documento foi criado para garantir consistência em todo o conteúdo.*\n\n`;
        context += `${client.identity_guide}\n\n---\n\n`;
      } else {
        // Fallback para descrição + notas
        context += `## 🎯 CONTEXTO DO CLIENTE: ${client.name}\n\n`;
        if (client.description) {
          context += `**Descrição:** ${client.description}\n\n`;
        }
        if (client.context_notes) {
          context += `**Notas de Contexto:**\n${client.context_notes}\n\n`;
        }
        context += `---\n\n`;
      }
      
      // CONTENT GUIDELINES (guia de criação prático)
      if (client.content_guidelines) {
        context += `## 📝 GUIA DE CRIAÇÃO (REGRAS PRÁTICAS — ALTA PRIORIDADE)\n`;
        context += `*SIGA estas regras práticas ao criar qualquer conteúdo para este cliente:*\n\n`;
        context += `${client.content_guidelines}\n\n---\n\n`;
      }
      
      // Redes sociais (informativo)
      if (client.social_media && Object.keys(client.social_media).length > 0) {
        const socialMedia = typeof client.social_media === 'string' 
          ? JSON.parse(client.social_media) 
          : client.social_media;
        if (Object.keys(socialMedia).some(k => socialMedia[k])) {
          context += `### Redes Sociais do Cliente\n`;
          Object.entries(socialMedia).forEach(([key, value]) => {
            if (value) context += `- ${key}: ${value}\n`;
          });
          context += `\n`;
        }
      }
    }
  } catch (err) {
    console.error("[KNOWLEDGE-LOADER] Error fetching client:", err);
  }
  
  // 3. EXEMPLOS FAVORITOS DA BIBLIOTECA (PRIORIZA FAVORITOS DO MESMO FORMATO)
  if (includeLibrary) {
    try {
      const normalizedFormat = normalizeFormatKey(format);
      
      const examples: ContentExample[] = [];
      
      // PRIORITY 1: Favoritos do MESMO formato (máxima relevância)
      const { data: formatFavorites } = await supabase
        .from("client_content_library")
        .select("title, content, content_type")
        .eq("client_id", clientId)
        .eq("is_favorite", true)
        .eq("content_type", normalizedFormat)
        .order("created_at", { ascending: false })
        .limit(3);
      
      if (formatFavorites && formatFavorites.length > 0) {
        for (const fav of formatFavorites) {
          examples.push({
            title: fav.title,
            content: fav.content?.substring(0, 1200) || "",
            type: fav.content_type + " ⭐",
          });
        }
        console.log(`[KNOWLEDGE-LOADER] Found ${formatFavorites.length} favorite ${normalizedFormat}s`);
      }
      
      // PRIORITY 2: Outros favoritos (qualquer formato)
      if (examples.length < maxLibraryExamples) {
        const { data: otherFavorites } = await supabase
          .from("client_content_library")
          .select("title, content, content_type")
          .eq("client_id", clientId)
          .eq("is_favorite", true)
          .neq("content_type", normalizedFormat)
          .order("created_at", { ascending: false })
          .limit(maxLibraryExamples - examples.length);
        
        if (otherFavorites) {
          for (const fav of otherFavorites) {
            if (!examples.some(e => e.title === fav.title)) {
              examples.push({
                title: fav.title,
                content: fav.content?.substring(0, 800) || "",
                type: fav.content_type + " ⭐",
              });
            }
          }
        }
      }
      
      // PRIORITY 3: Recentes do mesmo formato (se ainda não tem exemplos suficientes)
      if (examples.length < 2) {
        const { data: recentFormat } = await supabase
          .from("client_content_library")
          .select("title, content, content_type")
          .eq("client_id", clientId)
          .eq("content_type", normalizedFormat)
          .eq("is_favorite", false)
          .order("created_at", { ascending: false })
          .limit(3);
        
        if (recentFormat) {
          for (const item of recentFormat) {
            if (examples.length >= maxLibraryExamples) break;
            if (!examples.some(e => e.title === item.title)) {
              examples.push({
                title: item.title,
                content: item.content?.substring(0, 800) || "",
                type: item.content_type,
              });
            }
          }
        }
      }
      
      // PRIORITY 4: Recentes gerais (último fallback)
      if (examples.length < 2) {
        const { data: recent } = await supabase
          .from("client_content_library")
          .select("title, content, content_type")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false })
          .limit(5);
        
        if (recent) {
          for (const item of recent) {
            if (examples.length >= maxLibraryExamples) break;
            if (!examples.some(e => e.title === item.title)) {
              examples.push({
                title: item.title,
                content: item.content?.substring(0, 800) || "",
                type: item.content_type,
              });
            }
          }
        }
      }
      
      if (examples.length > 0) {
        context += `## 📚 EXEMPLOS DA BIBLIOTECA (USE COMO REFERÊNCIA DE TOM E ESTILO)\n`;
        context += `*Analise esses exemplos e replique o tom de voz, estrutura e linguagem:*\n\n`;
        
        examples.forEach((ex, i) => {
          context += `**Exemplo ${i + 1}: "${ex.title}"** (${ex.type})\n`;
          context += `\`\`\`\n${ex.content}${ex.content.length >= 800 ? "..." : ""}\n\`\`\`\n\n`;
        });
        
        context += `---\n\n`;
      }
    } catch (err) {
      console.error("[KNOWLEDGE-LOADER] Error fetching library:", err);
    }
  }
  
  // 3.5. BIBLIOTECA DE REFERÊNCIAS (artigos, inspirações, estudos de caso)
  try {
    const { data: references } = await supabase
      .from("client_reference_library")
      .select("title, content, reference_type, source_url")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(5);
    
    if (references && references.length > 0) {
      context += `## 🔬 MATERIAL DE REFERÊNCIA — USE COMO INSPIRAÇÃO CRIATIVA\n`;
      context += `*Estes são artigos, estudos e referências curados pelo cliente. EXTRAIA insights, dados e perspectivas originais deles. NÃO copie — reinterprete com a voz do cliente.*\n\n`;
      
      for (const ref of references) {
        context += `**${ref.title}** (${ref.reference_type})${ref.source_url ? ` — [fonte](${ref.source_url})` : ''}\n`;
        context += `\`\`\`\n${(ref.content || '').substring(0, 800)}${(ref.content || '').length > 800 ? '...' : ''}\n\`\`\`\n\n`;
      }
      
      context += `---\n\n`;
      console.log(`[KNOWLEDGE-LOADER] Loaded ${references.length} reference library items`);
    }
  } catch (err) {
    console.error("[KNOWLEDGE-LOADER] Error fetching reference library:", err);
  }
  
  // 4. TOP PERFORMERS (Instagram + YouTube)
  if (includeTopPerformers) {
    const topPerformers: ContentExample[] = [];
    
    try {
      // Top Instagram posts por engagement
      const { data: instaPosts } = await supabase
        .from("instagram_posts")
        .select("caption, full_content, video_transcript, engagement_rate, post_type")
        .eq("client_id", clientId)
        .not("content_synced_at", "is", null)
        .order("engagement_rate", { ascending: false, nullsFirst: false })
        .limit(3);
      
      if (instaPosts) {
        for (const post of instaPosts) {
          const content = post.full_content || post.video_transcript || post.caption;
          if (content) {
            topPerformers.push({
              title: (post.caption || "").substring(0, 80) + "...",
              content: content.substring(0, 600),
              type: post.post_type === "VIDEO" || post.post_type === "reel" ? "Reels" : "Post",
              metric: `${((post.engagement_rate || 0) * 100).toFixed(1)}% engagement`
            });
          }
        }
      }
      
      // Top YouTube videos por views
      const { data: ytVideos } = await supabase
        .from("youtube_videos")
        .select("title, transcript, total_views")
        .eq("client_id", clientId)
        .not("transcript", "is", null)
        .order("total_views", { ascending: false, nullsFirst: false })
        .limit(2);
      
      if (ytVideos) {
        for (const video of ytVideos) {
          if (video.transcript) {
            topPerformers.push({
              title: video.title,
              content: video.transcript.substring(0, 600),
              type: "YouTube",
              metric: `${(video.total_views || 0).toLocaleString()} views`
            });
          }
        }
      }
      
      if (topPerformers.length > 0) {
        context += `## 🏆 CONTEÚDOS DE MAIOR PERFORMANCE (USE COMO INSPIRAÇÃO)\n`;
        context += `*Estes são os conteúdos do cliente com melhor desempenho. Analise o estilo, estrutura, ganchos e tom de voz para criar conteúdos similares.*\n\n`;
        
        topPerformers.slice(0, maxTopPerformers).forEach((perf, i) => {
          context += `**Top ${i + 1} [${perf.type}]** - ${perf.metric}\n`;
          context += `*"${perf.title}"*\n`;
          context += `\`\`\`\n${perf.content}${perf.content.length >= 600 ? "..." : ""}\n\`\`\`\n\n`;
        });
        
        context += `---\n\n`;
      }
    } catch (err) {
      console.error("[KNOWLEDGE-LOADER] Error fetching top performers:", err);
    }
  }
  
  // 5. GLOBAL KNOWLEDGE (base de conhecimento do workspace)
  if (includeGlobalKnowledge && workspaceId) {
    const globalKnowledge = await getGlobalKnowledge(workspaceId);
    if (globalKnowledge) {
      context += globalKnowledge;
      context += `---\n\n`;
    }
  }
  
  // 6. SUCCESS PATTERNS (padrões que funcionam para o cliente)
  if (includeSuccessPatterns && clientId) {
    const successPatterns = await getSuccessPatterns(clientId);
    if (successPatterns) {
      context += successPatterns;
      context += `---\n\n`;
    }
  }
  
  // 7. CHECKLIST DE VALIDAÇÃO (para IA auto-validar)
  if (includeChecklist && format) {
    const checklistFormatted = await getFormatChecklistFormatted(format);
    if (checklistFormatted) {
      context += checklistFormatted;
    }
  }
  
  return context;
}

// =====================================================
// FALLBACKS - Documentação básica caso banco falhe
// =====================================================

function getFallbackAgentDocs(agentKey: string): string {
  const fallbacks: Record<string, string> = {
    "researcher": `## AGENTE PESQUISADOR
Analise materiais disponíveis. Use APENAS dados fornecidos. Seja objetivo e factual.`,
    
    "content_writer": `## AGENTE ESCRITOR
Crie conteúdo seguindo: 1) Identidade do cliente 2) Formato solicitado 3) Biblioteca como referência.
NUNCA use linguagem genérica de IA. SEMPRE adapte ao tom do cliente.`,
    
    "editor": `## AGENTE EDITOR
Refine o conteúdo para soar EXATAMENTE como o cliente. Compare com exemplos reais.
O leitor não deve perceber que foi escrito por IA.`,
    
    "reviewer": `## AGENTE REVISOR
Retorne APENAS o conteúdo final. NÃO inclua comentários ou explicações.
Apenas o conteúdo pronto para publicação.`,
    
    "strategist": `## AGENTE ESTRATEGISTA
Baseie estratégias em dados. Seja específico e acionável. KPIs mensuráveis.`,
    
    "design_agent": `## AGENTE DE DESIGN
Crie prompts que replicam EXATAMENTE o estilo visual do cliente.
Use cores e referências da marca.`,
    
    "metrics_analyst": `## AGENTE ANALISTA
Analise dados objetivamente. Forneça insights acionáveis.`,
  };
  
  return fallbacks[agentKey] || fallbacks["content_writer"];
}

function getFallbackFormatDocs(formatKey: string): string {
  const fallbacks: Record<string, string> = {
    "thread": `## FORMATO: THREAD (TWITTER/X)
- 5-15 tweets, max 280 chars cada
- Tweet 1 com 🧵 no final
- Numerar: 1/X, 2/X
- Último tweet pede RT do primeiro`,
    
    "stories": `## FORMATO: STORIES (INSTAGRAM)
- 3-7 stories, max 50 palavras cada
- Indicar sequência (1/5, 2/5...)
- Formato vertical 9:16
- Último story com CTA`,
    
    "carousel": `## FORMATO: CARROSSEL
- 7-10 slides, max 30 palavras cada
- Slide 1 = gancho impactante
- Último slide com CTA`,
    
    "newsletter": `## FORMATO: NEWSLETTER
- Assunto max 50 chars
- Parágrafos curtos
- 1 CTA principal`,
    
    "tweet": `## FORMATO: TWEET
- Max 280 caracteres
- Uma ideia por tweet`,
    
    "linkedin_post": `## FORMATO: LINKEDIN
- Gancho nas 2 primeiras linhas
- Tom profissional mas humano
- Terminar com pergunta`,
    
    "instagram_post": `## FORMATO: POST INSTAGRAM
- Primeira linha = gancho
- 5-10 hashtags no final`,
    
    "email_marketing": `## FORMATO: EMAIL MARKETING
- Assunto max 50 chars
- 1 CTA repetido 2-3x`,
    
    "blog_post": `## FORMATO: BLOG POST
- Título max 60 chars
- Hierarquia H2/H3
- 1.500-2.000 palavras`,
    
    "x_article": `## FORMATO: ARTIGO X
- Título max 100 chars
- Tom opinativo
- 1.500-4.000 palavras`,
  };
  
  return fallbacks[formatKey] || "";
}
