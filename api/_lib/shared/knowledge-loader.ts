// =====================================================
// CARREGADOR DE DOCUMENTAÇÃO DE AGENTES E FORMATOS (Node port)
// Ported from supabase/functions/_shared/knowledge-loader.ts
// Uses Neon (pg) instead of Supabase client.
// =====================================================
import { query, queryOne } from '../db.js';
import { getFormatSchema, buildFormatContract } from './format-schemas.js';
import { buildForbiddenPhrasesSection, UNIVERSAL_OUTPUT_RULES } from './quality-rules.js';

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

export interface VoiceProfile {
  tone?: string;
  use?: string[];
  avoid?: string[];
}

// Cache pra kai_documentation rows (format/agent docs).
// É data quase-estática (admin update raríssimo) e poucas entries (~30 docs
// no total). Cap defensivo de 200 pra cobrir potential growth + aliases.
// LRU eviction via Map insertion order.
const DOCS_CACHE_MAX = 200;
const docsCache: Map<string, KaiDocumentation> = new Map();

function trimDocsCache(): void {
  while (docsCache.size > DOCS_CACHE_MAX) {
    const oldestKey = docsCache.keys().next().value;
    if (!oldestKey) break;
    docsCache.delete(oldestKey);
  }
}

const FORMAT_KEY_ALIASES: Record<string, string> = {
  newsletter: 'newsletter',
  blog_post: 'blog_post',
  blogpost: 'blog_post',
  carousel: 'carousel',
  carrossel: 'carousel',
  thread: 'thread',
  tweet: 'tweet',
  linkedin_post: 'linkedin_post',
  linkedin: 'linkedin_post',
  stories: 'stories',
  story: 'stories',
  storie: 'stories',
  short_video: 'short_video',
  reels: 'short_video',
  tiktok: 'short_video',
  shorts: 'short_video',
  long_video: 'long_video',
  youtube: 'long_video',
  x_article: 'x_article',
  artigo_x: 'x_article',
  artigo: 'x_article',
  instagram_post: 'instagram_post',
  post_instagram: 'instagram_post',
  post: 'instagram_post',
  email: 'email_marketing',
  email_marketing: 'email_marketing',
};

const AGENT_KEY_ALIASES: Record<string, string> = {
  researcher: 'researcher',
  pesquisador: 'researcher',
  writer: 'content_writer',
  escritor: 'content_writer',
  content_writer: 'content_writer',
  editor: 'editor',
  reviewer: 'reviewer',
  revisor: 'reviewer',
  strategist: 'strategist',
  estrategista: 'strategist',
  metrics_analyst: 'metrics_analyst',
  analista: 'metrics_analyst',
  design_agent: 'design_agent',
  designer: 'design_agent',
  email_developer: 'email_developer',
};

async function fetchDocumentation(
  docType: 'format' | 'agent',
  docKey: string
): Promise<KaiDocumentation | null> {
  const cacheKey = `${docType}_${docKey}`;
  if (docsCache.has(cacheKey)) return docsCache.get(cacheKey)!;
  try {
    const row = await queryOne<any>(
      `SELECT * FROM kai_documentation WHERE doc_type = $1 AND doc_key = $2 LIMIT 1`,
      [docType, docKey]
    );
    if (!row) return null;
    const doc: KaiDocumentation = {
      id: row.id,
      doc_type: row.doc_type,
      doc_key: row.doc_key,
      title: row.title,
      content: row.content,
      summary: row.summary,
      checklist: row.checklist || [],
      metadata: row.metadata || {},
    };
    docsCache.set(cacheKey, doc);
    trimDocsCache();
    return doc;
  } catch (err) {
    console.error(`[KNOWLEDGE-LOADER] Error fetching ${docType}/${docKey}:`, err);
    return null;
  }
}

export function normalizeFormatKey(contentType: string): string {
  const normalized = (contentType || '').toLowerCase().replace(/-/g, '_').trim();
  return FORMAT_KEY_ALIASES[normalized] || normalized;
}

function normalizeAgentKey(agentId: string): string {
  const normalized = (agentId || '').toLowerCase().replace(/-/g, '_').trim();
  return AGENT_KEY_ALIASES[normalized] || normalized;
}

export async function getAgentDocs(agentId: string): Promise<string> {
  const normalizedKey = normalizeAgentKey(agentId);
  const doc = await fetchDocumentation('agent', normalizedKey);
  return doc?.content || getFallbackAgentDocs(normalizedKey);
}

export async function getFormatDocs(contentType: string): Promise<string> {
  const normalizedKey = normalizeFormatKey(contentType);
  const doc = await fetchDocumentation('format', normalizedKey);
  return doc?.content || getFallbackFormatDocs(normalizedKey);
}

export async function getFormatChecklist(contentType: string): Promise<string[]> {
  const normalizedKey = normalizeFormatKey(contentType);
  const doc = await fetchDocumentation('format', normalizedKey);
  return doc?.checklist || [];
}

export async function getFormatChecklistFormatted(contentType: string): Promise<string> {
  const checklist = await getFormatChecklist(contentType);
  if (!checklist || checklist.length === 0) return '';
  let validation = '\n## ✅ CHECKLIST DE AUTO-VALIDAÇÃO\n';
  validation += '*VERIFIQUE mentalmente antes de entregar a resposta final:*\n\n';
  checklist.forEach((item, i) => { validation += `${i + 1}. ${item}\n`; });
  validation += '\n⚠️ NÃO inclua este checklist na resposta. Use apenas para validar internamente.\n';
  return validation;
}

export async function getGlobalKnowledge(workspaceId: string, limit = 5): Promise<string> {
  if (!workspaceId) return '';
  try {
    const rows = await query<any>(
      `SELECT title, summary, category, content FROM global_knowledge WHERE workspace_id = $1 LIMIT $2`,
      [workspaceId, limit]
    );
    if (!rows || rows.length === 0) return '';
    let context = '\n## 📚 BASE DE CONHECIMENTO GLOBAL\n';
    context += '*Use esses insights para enriquecer o conteúdo:*\n\n';
    for (const item of rows) {
      context += `### ${item.title} (${item.category})\n`;
      context += (item.summary || (item.content ? String(item.content).substring(0, 500) : '')) + '\n\n';
    }
    return context;
  } catch (err) {
    console.error('[KNOWLEDGE-LOADER] Error fetching global knowledge:', err);
    return '';
  }
}

export async function getSuccessPatterns(clientId: string): Promise<string> {
  if (!clientId) return '';
  try {
    const topPosts = await query<any>(
      `SELECT caption, post_type, engagement_rate FROM instagram_posts
       WHERE client_id = $1 AND engagement_rate IS NOT NULL
       ORDER BY engagement_rate DESC LIMIT 5`,
      [clientId]
    );
    if (!topPosts || topPosts.length === 0) return '';

    let patterns = '\n## 🎯 PADRÕES QUE FUNCIONAM PARA ESTE CLIENTE\n';
    patterns += '*Baseado em análise de posts de alta performance:*\n\n';
    let hasQuestions = 0;
    let hasEmojis = 0;
    let hasCTA = 0;
    let hasNumbers = 0;
    let shortCaptions = 0;
    for (const post of topPosts) {
      if (!post.caption) continue;
      const caption: string = post.caption;
      const engagementPct = ((post.engagement_rate || 0) * 100).toFixed(1);
      patterns += `- **${post.post_type || 'Post'}** com ${engagementPct}% engagement\n`;
      if (/\?/.test(caption)) hasQuestions++;
      if (/[\u{1F600}-\u{1F6FF}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}]/u.test(caption)) hasEmojis++;
      if (/(coment|compartilh|salv|link|bio|clique|acesse|saiba mais)/i.test(caption)) hasCTA++;
      if (/\d+/.test(caption)) hasNumbers++;
      if (caption.length < 150) shortCaptions++;
    }
    patterns += '\n**Insights detectados:**\n';
    if (hasQuestions >= 2) patterns += '- ✅ Usar perguntas aumenta engajamento\n';
    if (hasEmojis >= 2) patterns += '- ✅ Emojis estratégicos funcionam bem\n';
    if (hasCTA >= 2) patterns += '- ✅ CTAs claros geram mais ação\n';
    if (hasNumbers >= 2) patterns += '- ✅ Números/dados chamam atenção\n';
    if (shortCaptions >= 2) patterns += '- ✅ Legendas mais curtas performam melhor\n';
    patterns += '\n';
    return patterns;
  } catch (err) {
    console.error('[KNOWLEDGE-LOADER] Error extracting success patterns:', err);
    return '';
  }
}

export async function buildAgentContext(agentId: string, contentType: string): Promise<string> {
  const agentDocs = await getAgentDocs(agentId);
  const formatDocs = await getFormatDocs(contentType);
  let context = '';
  if (agentDocs) context += `# DIRETRIZES DO AGENTE\n\n${agentDocs}\n\n`;
  const contentAgents = ['writer', 'escritor', 'content_writer', 'editor', 'reviewer', 'revisor'];
  if (formatDocs && contentAgents.includes(agentId.toLowerCase())) {
    context += `# REGRAS DO FORMATO\n\n${formatDocs}\n\n`;
  }
  return context;
}

export function clearDocsCache(): void {
  docsCache.clear();
}

export async function getStructuredVoice(clientId: string): Promise<string> {
  if (!clientId) return '';
  try {
    const client = await queryOne<any>(
      `SELECT name, voice_profile, identity_guide FROM clients WHERE id = $1`,
      [clientId]
    );
    if (!client) return '';
    let voiceSection = '';
    const voiceProfile: VoiceProfile = client.voice_profile || {};
    if (voiceProfile.tone || voiceProfile.use?.length || voiceProfile.avoid?.length) {
      voiceSection += `## 🎯 VOZ DO CLIENTE: ${client.name}\n\n`;
      if (voiceProfile.tone) voiceSection += `**Tom:** ${voiceProfile.tone}\n\n`;
      if (voiceProfile.use && voiceProfile.use.length > 0) {
        voiceSection += `**USE (expressões/padrões que funcionam):**\n`;
        for (const item of voiceProfile.use) voiceSection += `✅ ${item}\n`;
        voiceSection += `\n`;
      }
      if (voiceProfile.avoid && voiceProfile.avoid.length > 0) {
        voiceSection += `**EVITE (proibido para este cliente):**\n`;
        for (const item of voiceProfile.avoid) voiceSection += `❌ ${item}\n`;
        voiceSection += `\n`;
      }
    }
    return voiceSection;
  } catch (err) {
    console.error('[KNOWLEDGE-LOADER] Error fetching voice profile:', err);
    return '';
  }
}

export async function getClientAvoidList(clientId: string): Promise<string[]> {
  if (!clientId) return [];
  try {
    const client = await queryOne<any>(
      `SELECT voice_profile FROM clients WHERE id = $1`,
      [clientId]
    );
    if (!client?.voice_profile) return [];
    const voiceProfile: VoiceProfile = client.voice_profile;
    return voiceProfile.avoid || [];
  } catch {
    return [];
  }
}

export { getFormatSchema, buildFormatContract } from './format-schemas.js';
export { buildForbiddenPhrasesSection, UNIVERSAL_OUTPUT_RULES } from './quality-rules.js';

export async function getAvailableFormats(): Promise<string[]> {
  try {
    const rows = await query<any>(
      `SELECT doc_key FROM kai_documentation WHERE doc_type = 'format'`
    );
    if (!rows || rows.length === 0) return Object.values(FORMAT_KEY_ALIASES);
    return rows.map((d: any) => d.doc_key);
  } catch {
    return Object.values(FORMAT_KEY_ALIASES);
  }
}

export async function getAvailableAgents(): Promise<string[]> {
  try {
    const rows = await query<any>(
      `SELECT doc_key FROM kai_documentation WHERE doc_type = 'agent'`
    );
    if (!rows || rows.length === 0) return Object.values(AGENT_KEY_ALIASES);
    return rows.map((d: any) => d.doc_key);
  } catch {
    return Object.values(AGENT_KEY_ALIASES);
  }
}

interface FullContentContextParams {
  clientId: string;
  format: string;
  includeLibrary?: boolean;
  includeTopPerformers?: boolean;
  maxLibraryExamples?: number;
  maxTopPerformers?: number;
  workspaceId?: string;
  includeGlobalKnowledge?: boolean;
  includeSuccessPatterns?: boolean;
  includeChecklist?: boolean;
}

interface ContentExample {
  title: string;
  content: string;
  type: string;
  metric?: string;
}

export async function getFullContentContext(params: FullContentContextParams): Promise<string> {
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

  let context = '';

  // 1. FORMAT RULES
  const formatDocs = await getFormatDocs(format);
  if (formatDocs) {
    context += `## 📋 REGRAS DO FORMATO: ${format.toUpperCase()}\n\n${formatDocs}\n\n---\n\n`;
  }

  // 2. CLIENT CONTEXT
  try {
    const client = await queryOne<any>(
      `SELECT name, identity_guide, description, context_notes, social_media, content_guidelines
       FROM clients WHERE id = $1`,
      [clientId]
    );
    if (client) {
      if (client.identity_guide) {
        context += `## 🎯 CONTEXTO OPERACIONAL DO CLIENTE (DOCUMENTO MESTRE)\n\n`;
        context += `*SIGA RIGOROSAMENTE as diretrizes abaixo. Este documento foi criado para garantir consistência em todo o conteúdo.*\n\n`;
        context += `${client.identity_guide}\n\n---\n\n`;
      } else {
        context += `## 🎯 CONTEXTO DO CLIENTE: ${client.name}\n\n`;
        if (client.description) context += `**Descrição:** ${client.description}\n\n`;
        if (client.context_notes) context += `**Notas de Contexto:**\n${client.context_notes}\n\n`;
        context += `---\n\n`;
      }
      if (client.content_guidelines) {
        context += `## 📝 GUIA DE CRIAÇÃO (REGRAS PRÁTICAS — ALTA PRIORIDADE)\n`;
        context += `*SIGA estas regras práticas ao criar qualquer conteúdo para este cliente:*\n\n`;
        context += `${client.content_guidelines}\n\n---\n\n`;
      }
      if (client.social_media && Object.keys(client.social_media).length > 0) {
        const socialMedia = typeof client.social_media === 'string'
          ? JSON.parse(client.social_media)
          : client.social_media;
        if (Object.keys(socialMedia).some((k: string) => socialMedia[k])) {
          context += `### Redes Sociais do Cliente\n`;
          Object.entries(socialMedia).forEach(([key, value]) => {
            if (value) context += `- ${key}: ${value}\n`;
          });
          context += `\n`;
        }
      }
    }
  } catch (err) {
    console.error('[KNOWLEDGE-LOADER] Error fetching client:', err);
  }

  // 3. LIBRARY EXAMPLES (favorites)
  if (includeLibrary) {
    try {
      const normalizedFormat = normalizeFormatKey(format);
      const examples: ContentExample[] = [];

      const formatFavorites = await query<any>(
        `SELECT title, content, content_type FROM client_content_library
         WHERE client_id = $1 AND is_favorite = true AND content_type = $2
         ORDER BY created_at DESC LIMIT 3`,
        [clientId, normalizedFormat]
      );
      for (const fav of formatFavorites || []) {
        examples.push({
          title: fav.title,
          content: (fav.content || '').substring(0, 1200),
          type: fav.content_type + ' ⭐',
        });
      }

      if (examples.length < maxLibraryExamples) {
        const otherFavorites = await query<any>(
          `SELECT title, content, content_type FROM client_content_library
           WHERE client_id = $1 AND is_favorite = true AND content_type <> $2
           ORDER BY created_at DESC LIMIT $3`,
          [clientId, normalizedFormat, maxLibraryExamples - examples.length]
        );
        for (const fav of otherFavorites || []) {
          if (!examples.some((e) => e.title === fav.title)) {
            examples.push({
              title: fav.title,
              content: (fav.content || '').substring(0, 800),
              type: fav.content_type + ' ⭐',
            });
          }
        }
      }

      if (examples.length < 2) {
        const recentFormat = await query<any>(
          `SELECT title, content, content_type FROM client_content_library
           WHERE client_id = $1 AND content_type = $2 AND is_favorite = false
           ORDER BY created_at DESC LIMIT 3`,
          [clientId, normalizedFormat]
        );
        for (const item of recentFormat || []) {
          if (examples.length >= maxLibraryExamples) break;
          if (!examples.some((e) => e.title === item.title)) {
            examples.push({
              title: item.title,
              content: (item.content || '').substring(0, 800),
              type: item.content_type,
            });
          }
        }
      }

      if (examples.length < 2) {
        const recent = await query<any>(
          `SELECT title, content, content_type FROM client_content_library
           WHERE client_id = $1 ORDER BY created_at DESC LIMIT 5`,
          [clientId]
        );
        for (const item of recent || []) {
          if (examples.length >= maxLibraryExamples) break;
          if (!examples.some((e) => e.title === item.title)) {
            examples.push({
              title: item.title,
              content: (item.content || '').substring(0, 800),
              type: item.content_type,
            });
          }
        }
      }

      if (examples.length > 0) {
        context += `## 📚 EXEMPLOS DA BIBLIOTECA (USE COMO REFERÊNCIA DE TOM E ESTILO)\n`;
        context += `*Analise esses exemplos e replique o tom de voz, estrutura e linguagem:*\n\n`;
        examples.forEach((ex, i) => {
          context += `**Exemplo ${i + 1}: "${ex.title}"** (${ex.type})\n`;
          context += '```\n' + ex.content + (ex.content.length >= 800 ? '...' : '') + '\n```\n\n';
        });
        context += `---\n\n`;
      }
    } catch (err) {
      console.error('[KNOWLEDGE-LOADER] Error fetching library:', err);
    }
  }

  // 3.5 REFERENCE LIBRARY
  try {
    const references = await query<any>(
      `SELECT title, content, reference_type, source_url FROM client_reference_library
       WHERE client_id = $1 ORDER BY created_at DESC LIMIT 5`,
      [clientId]
    );
    if (references && references.length > 0) {
      context += `## 🔬 MATERIAL DE REFERÊNCIA — REPLIQUE O FORMATO E TOM\n`;
      context += `*Estes são exemplos curados pelo cliente que representam o ESTILO DESEJADO. REPLIQUE o formato, estrutura e tom desses exemplos. Use a mesma abordagem (listas, perguntas, provocações, dados concretos) adaptando o tema. Esses exemplos são o PADRÃO DE QUALIDADE — seu output deve parecer que foi escrito pela mesma pessoa.*\n\n`;
      for (const ref of references) {
        context += `**${ref.title}** (${ref.reference_type})${ref.source_url ? ` — [fonte](${ref.source_url})` : ''}\n`;
        context += '```\n' + (ref.content || '').substring(0, 800) + ((ref.content || '').length > 800 ? '...' : '') + '\n```\n\n';
      }
      context += `---\n\n`;
    }
  } catch (err) {
    console.error('[KNOWLEDGE-LOADER] Error fetching reference library:', err);
  }

  // 4. TOP PERFORMERS
  if (includeTopPerformers) {
    const topPerformers: ContentExample[] = [];
    try {
      const instaPosts = await query<any>(
        `SELECT caption, full_content, video_transcript, engagement_rate, post_type
         FROM instagram_posts WHERE client_id = $1 AND content_synced_at IS NOT NULL
         ORDER BY engagement_rate DESC NULLS LAST LIMIT 3`,
        [clientId]
      );
      for (const post of instaPosts || []) {
        const content = post.full_content || post.video_transcript || post.caption;
        if (content) {
          topPerformers.push({
            title: (post.caption || '').substring(0, 80) + '...',
            content: String(content).substring(0, 600),
            type: post.post_type === 'VIDEO' || post.post_type === 'reel' ? 'Reels' : 'Post',
            metric: `${((post.engagement_rate || 0) * 100).toFixed(1)}% engagement`,
          });
        }
      }
      const ytVideos = await query<any>(
        `SELECT title, transcript, total_views FROM youtube_videos
         WHERE client_id = $1 AND transcript IS NOT NULL
         ORDER BY total_views DESC NULLS LAST LIMIT 2`,
        [clientId]
      );
      for (const video of ytVideos || []) {
        if (video.transcript) {
          topPerformers.push({
            title: video.title,
            content: String(video.transcript).substring(0, 600),
            type: 'YouTube',
            metric: `${(video.total_views || 0).toLocaleString()} views`,
          });
        }
      }
      if (topPerformers.length > 0) {
        context += `## 🏆 CONTEÚDOS DE MAIOR PERFORMANCE (USE COMO INSPIRAÇÃO)\n`;
        context += `*Estes são os conteúdos do cliente com melhor desempenho. Analise o estilo, estrutura, ganchos e tom de voz para criar conteúdos similares.*\n\n`;
        topPerformers.slice(0, maxTopPerformers).forEach((perf, i) => {
          context += `**Top ${i + 1} [${perf.type}]** - ${perf.metric}\n`;
          context += `*"${perf.title}"*\n`;
          context += '```\n' + perf.content + (perf.content.length >= 600 ? '...' : '') + '\n```\n\n';
        });
        context += `---\n\n`;
      }
    } catch (err) {
      console.error('[KNOWLEDGE-LOADER] Error fetching top performers:', err);
    }
  }

  // 5. GLOBAL KNOWLEDGE
  if (includeGlobalKnowledge && workspaceId) {
    const globalKnowledge = await getGlobalKnowledge(workspaceId);
    if (globalKnowledge) context += globalKnowledge + '---\n\n';
  }

  // 6. SUCCESS PATTERNS
  if (includeSuccessPatterns && clientId) {
    const successPatterns = await getSuccessPatterns(clientId);
    if (successPatterns) context += successPatterns + '---\n\n';
  }

  // 7. CHECKLIST
  if (includeChecklist && format) {
    const checklistFormatted = await getFormatChecklistFormatted(format);
    if (checklistFormatted) context += checklistFormatted;
  }

  return context;
}

// =====================================================
// FALLBACKS
// =====================================================
function getFallbackAgentDocs(agentKey: string): string {
  const fallbacks: Record<string, string> = {
    researcher: `## AGENTE PESQUISADOR
Analise materiais disponíveis. Use APENAS dados fornecidos. Seja objetivo e factual.`,
    content_writer: `## AGENTE ESCRITOR
Crie conteúdo seguindo: 1) Identidade do cliente 2) Formato solicitado 3) Biblioteca como referência.
NUNCA use linguagem genérica de IA. SEMPRE adapte ao tom do cliente.`,
    editor: `## AGENTE EDITOR
Refine o conteúdo para soar EXATAMENTE como o cliente. Compare com exemplos reais.
O leitor não deve perceber que foi escrito por IA.`,
    reviewer: `## AGENTE REVISOR
Retorne APENAS o conteúdo final. NÃO inclua comentários ou explicações.
Apenas o conteúdo pronto para publicação.`,
    strategist: `## AGENTE ESTRATEGISTA
Baseie estratégias em dados. Seja específico e acionável. KPIs mensuráveis.`,
    design_agent: `## AGENTE DE DESIGN
Crie prompts que replicam EXATAMENTE o estilo visual do cliente.
Use cores e referências da marca.`,
    metrics_analyst: `## AGENTE ANALISTA
Analise dados objetivamente. Forneça insights acionáveis.`,
  };
  return fallbacks[agentKey] || fallbacks['content_writer'];
}

function getFallbackFormatDocs(formatKey: string): string {
  const fallbacks: Record<string, string> = {
    thread: `## FORMATO: THREAD (TWITTER/X)
- 5-15 tweets, max 280 chars cada
- Tweet 1 com 🧵 no final
- Numerar: 1/X, 2/X
- Último tweet pede RT do primeiro`,
    stories: `## FORMATO: STORIES (INSTAGRAM)
- 3-7 stories, max 50 palavras cada
- Indicar sequência (1/5, 2/5...)
- Formato vertical 9:16
- Último story com CTA`,
    carousel: `## FORMATO: CARROSSEL
- 7-10 slides, max 30 palavras cada
- Slide 1 = gancho impactante
- Último slide com CTA`,
    newsletter: `## FORMATO: NEWSLETTER
- Assunto max 50 chars
- Parágrafos curtos
- 1 CTA principal`,
    tweet: `## FORMATO: TWEET
- Max 280 caracteres
- Uma ideia por tweet`,
    linkedin_post: `## FORMATO: LINKEDIN
- Gancho nas 2 primeiras linhas
- Tom profissional mas humano
- Terminar com pergunta`,
    instagram_post: `## FORMATO: POST INSTAGRAM
- Primeira linha = gancho
- 5-10 hashtags no final`,
    email_marketing: `## FORMATO: EMAIL MARKETING
- Assunto max 50 chars
- 1 CTA repetido 2-3x`,
    blog_post: `## FORMATO: BLOG POST
- Título max 60 chars
- Hierarquia H2/H3
- 1.500-2.000 palavras`,
    x_article: `## FORMATO: ARTIGO X
- Título max 100 chars
- Tom opinativo
- 1.500-4.000 palavras`,
  };
  return fallbacks[formatKey] || '';
}
