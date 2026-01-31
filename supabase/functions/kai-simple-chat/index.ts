import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { 
  FORMAT_KEY_MAP,
  CONTENT_TYPE_MAP,
  CONTENT_FORMAT_KEYWORDS,
  detectFormatFromKeywords 
} from "../_shared/format-constants.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Constantes
const MAX_IDENTITY_GUIDE_LENGTH = 8000;
const MAX_CITED_CONTENT_LENGTH = 12000;
const MAX_HISTORY_MESSAGES = 15;
const MAX_METRICS_CONTEXT_LENGTH = 8000; // Increased for detailed analysis

// Planos que têm acesso ao kAI Chat
const ALLOWED_PLANS = ["pro", "enterprise", "agency"];

interface Citation {
  id: string;
  type: "content" | "reference" | "format";
  title: string;
}

interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
}

interface RequestBody {
  message: string;
  clientId: string;
  imageUrls?: string[];
  citations?: Citation[];
  history?: HistoryMessage[];
}

interface DateRange {
  start: string;
  end: string;
}

type MetricFocus = 'likes' | 'engagement' | 'reach' | 'comments' | 'saves' | 'shares';

// ============================================
// INTENT DETECTION HELPERS
// ============================================

function isMetricsQuery(message: string): boolean {
  const patterns = [
    /m[eé]trica/i,
    /performance/i,
    /estat[ií]stica/i,
    /engajamento/i,
    /seguidores/i,
    /crescimento/i,
    /alcance/i,
    /impress[oõ]es/i,
    /visualiza[cç][oõ]es/i,
    /likes/i,
    /curtidas?/i,            // ADDED: Portuguese for likes
    /coment[aá]rios/i,
    /compartilhamentos/i,
    /views/i,
    /inscritos/i,
    /subscribers/i,
    /analytics/i,
    /relat[oó]rio/i,
    /report/i,
    /dados\s+(do|da|de)/i,
    /como\s+(est[aá]|foi|anda)/i,
    /resultado/i,
    /melhor\s+post/i,
    /top\s*\d*/i,
    /ranking/i,
    /m[eé]dia\s+(de|do|da)/i, // ADDED: Average queries
    /total\s+(de|do|da)/i,    // ADDED: Total queries
    /quantos?/i,              // ADDED: "How many" queries
    /instagram/i,             // ADDED: Platform-specific queries
    /youtube/i,
    /linkedin/i,
  ];
  return patterns.some(p => p.test(message));
}

function isReportRequest(message: string): boolean {
  const patterns = [
    /gerar?\s+relat[oó]rio/i,
    /criar?\s+relat[oó]rio/i,
    /fazer?\s+relat[oó]rio/i,
    /an[aá]lise\s+completa/i,
    /report\s+completo/i,
    /relat[oó]rio\s+de\s+performance/i,
    /relat[oó]rio\s+de\s+m[eé]tricas/i,
    /resumo\s+de\s+performance/i,
    /overview\s+completo/i,
  ];
  return patterns.some(p => p.test(message));
}

function isWebSearchQuery(message: string): boolean {
  const patterns = [
    /pesquise?\s+(sobre|por)/i,
    /busque?\s+(sobre|por)/i,
    /procure?\s+(sobre|por)/i,
    /o\s+que\s+[eé]/i,
    /quem\s+[eé]/i,
    /not[ií]cias\s+(sobre|de)/i,
    /tend[eê]ncias?\s+(de|em|sobre)/i,
    /atualiza[cç][oõ]es?\s+(sobre|de)/i,
    /me\s+conte\s+sobre/i,
    /me\s+fale\s+sobre/i,
  ];
  return patterns.some(p => p.test(message));
}

function isSpecificContentQuery(message: string): boolean {
  const patterns = [
    /qual\s+(foi\s+)?(o\s+)?(melhor|pior|maior|menor)/i,
    /qual\s+([eé]|a)\s+m[eé]dia/i,   // ADDED: "qual a média"
    /post\s+(com\s+)?(mais|menos)/i,
    /top\s*\d*/i,
    /ranking/i,
    /conte[uú]do\s+que\s+(mais|menos)/i,
    /melhor(es)?\s+post/i,
    /pior(es)?\s+post/i,
    /post\s+mais\s+curtido/i,
    /maior\s+engajamento/i,
    /mais\s+(likes|curtidas?|coment[aá]rios|compartilhamentos|saves|alcance)/i,
    /quantos?\s+(likes|curtidas?|posts|coment[aá]rios)/i,
    /m[eé]dia\s+(de|do|da)\s+(likes|curtidas?|coment[aá]rios|engajamento)/i, // ADDED
    /por\s*que\s+(esse|este|aquele)\s+post/i,
    /analise?\s+(esse|este|o)\s+post/i,
  ];
  return patterns.some(p => p.test(message));
}

// ============================================
// PLANNING CARD CREATION DETECTION
// ============================================

interface PlanningIntent {
  isPlanning: boolean;
  action: "create" | "schedule" | "distribute" | null;
  quantity: number;
  platform: string | null;
  specificDate: string | null;
  sourceUrl: string | null;
  topic: string | null;
  missingInfo: string[];
  isFollowUp?: boolean;
}

/**
 * Get platform emoji
 */
function getPlatformEmoji(platform: string): string {
  const emojis: Record<string, string> = {
    instagram: "📸",
    twitter: "🐦",
    linkedin: "💼",
    youtube: "🎬",
    newsletter: "📧",
    tiktok: "🎵",
  };
  return emojis[platform?.toLowerCase()] || "📱";
}

/**
 * Detect planning intent from conversation context (follow-up answers)
 */
function detectPlanningIntentFromContext(
  message: string,
  history?: HistoryMessage[]
): PlanningIntent | null {
  if (!history || history.length === 0) return null;
  
  // Find the last assistant message
  const lastAssistant = history.filter(h => h.role === "assistant").pop();
  if (!lastAssistant) return null;
  
  // Check if the last message was asking for planning info
  const wasPlanningQuestion = 
    lastAssistant.content.includes("Para qual plataforma") ||
    lastAssistant.content.includes("Para qual data") ||
    lastAssistant.content.includes("Sobre qual tema") ||
    lastAssistant.content.includes("qual rede social") ||
    lastAssistant.content.includes("quando você gostaria");
  
  if (!wasPlanningQuestion) return null;
  
  console.log("[kai-simple-chat] Detected follow-up to planning question");
  
  const lowerMessage = message.toLowerCase().trim();
  const result: PlanningIntent = {
    isPlanning: true,
    action: "create",
    quantity: 1,
    platform: null,
    specificDate: null,
    sourceUrl: null,
    topic: null,
    missingInfo: [],
    isFollowUp: true,
  };
  
  // Extract platform from answer
  const platforms: Record<string, string> = {
    'instagram': 'instagram',
    'insta': 'instagram',
    'twitter': 'twitter',
    'x': 'twitter',
    'linkedin': 'linkedin',
    'youtube': 'youtube',
    'newsletter': 'newsletter',
    'tiktok': 'tiktok',
  };
  
  for (const [keyword, platform] of Object.entries(platforms)) {
    if (lowerMessage.includes(keyword)) {
      result.platform = platform;
      break;
    }
  }
  
  // Extract date patterns
  const dateMatch = lowerMessage.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{4}))?/);
  if (dateMatch) {
    const day = dateMatch[1].padStart(2, '0');
    const month = dateMatch[2].padStart(2, '0');
    const year = dateMatch[3] || new Date().getFullYear().toString();
    result.specificDate = `${year}-${month}-${day}`;
  } else if (/amanh[ãa]/i.test(lowerMessage)) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    result.specificDate = tomorrow.toISOString().split('T')[0];
  } else if (/hoje/i.test(lowerMessage)) {
    result.specificDate = new Date().toISOString().split('T')[0];
  }
  
  // Extract topic from what's left
  let topic = message
    .replace(/instagram|twitter|linkedin|youtube|tiktok|newsletter/gi, '')
    .replace(/\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{4})?/g, '')
    .replace(/amanh[ãa]|hoje/gi, '')
    .replace(/sobre|para|no|na/gi, '')
    .trim();
  
  if (topic.length > 3) {
    result.topic = topic;
  }
  
  // Only return if we extracted something meaningful
  if (result.platform || result.specificDate || result.topic) {
    return result;
  }
  
  return null;
}

/**
 * Detect if user wants to create planning cards
 */
function detectPlanningIntent(message: string, history?: HistoryMessage[]): PlanningIntent {
  // First check if this is a follow-up to a previous planning question
  const contextIntent = detectPlanningIntentFromContext(message, history);
  if (contextIntent) {
    console.log("[kai-simple-chat] Using context-based planning intent:", contextIntent);
    return contextIntent;
  }
  
  const lowerMessage = message.toLowerCase();
  
  const result: PlanningIntent = {
    isPlanning: false,
    action: null,
    quantity: 1,
    platform: null,
    specificDate: null,
    sourceUrl: null,
    topic: null,
    missingInfo: [],
  };
  
  // Patterns for planning card creation
  const planningPatterns = [
    /cri(e|ar|a)\s+(\d+\s+)?cards?\s+(no\s+)?planejamento/i,
    /adicionar?\s+(ao\s+)?planejamento/i,
    /agendar?\s+(um\s+|uma\s+)?(post|conte[uú]do|card|publica[cç][aã]o)/i,
    /programa(r|e)\s+(um\s+|uma\s+)?(post|conte[uú]do|card|publica[cç][aã]o)/i,
    /coloca(r)?\s+(isso\s+)?(no\s+)?planejamento/i,
    /criar?\s+(\d+\s+)?(posts?|tweets?|carross[eé]is?|reels?|conte[uú]dos?)\s+(para|e)\s+(agendar|programar|planejamento)/i,
    /gerar?\s+(\d+\s+)?(posts?|tweets?|carross[eé]is?|reels?)\s+(para|e)?\s*(a\s+)?semana/i,
    /planeje?\s+(\d+\s+)?(posts?|conte[uú]dos?)/i,
    /montar?\s+(um\s+)?cronograma/i,
    /distribu(ir|a)\s+ao\s+longo\s+da\s+semana/i,
  ];
  
  for (const pattern of planningPatterns) {
    if (pattern.test(lowerMessage)) {
      result.isPlanning = true;
      break;
    }
  }
  
  if (!result.isPlanning) return result;
  
  // Detect action type
  if (/distribu(ir|a)|ao\s+longo|semana/i.test(lowerMessage)) {
    result.action = "distribute";
  } else if (/agendar|programar|para\s+(o\s+)?(dia|data)/i.test(lowerMessage)) {
    result.action = "schedule";
  } else {
    result.action = "create";
  }
  
  // Extract quantity
  const quantityMatch = lowerMessage.match(/(\d+)\s*(cards?|posts?|tweets?|conte[uú]dos?|carross[eé]is?|reels?)/i);
  if (quantityMatch) {
    result.quantity = parseInt(quantityMatch[1]);
  }
  
  // Extract platform
  const platforms: Record<string, string> = {
    'instagram': 'instagram',
    'insta': 'instagram',
    'twitter': 'twitter',
    'x': 'twitter',
    'tweet': 'twitter',
    'linkedin': 'linkedin',
    'youtube': 'youtube',
    'newsletter': 'newsletter',
    'tiktok': 'tiktok',
  };
  
  for (const [keyword, platform] of Object.entries(platforms)) {
    if (lowerMessage.includes(keyword)) {
      result.platform = platform;
      break;
    }
  }
  
  // Extract URL
  const urlMatch = message.match(/https?:\/\/[^\s]+/);
  if (urlMatch) {
    result.sourceUrl = urlMatch[0];
  }
  
  // Extract specific date patterns
  // DD/MM/YYYY or DD-MM-YYYY
  const dateMatch = lowerMessage.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dateMatch) {
    const [, day, month, year] = dateMatch;
    result.specificDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Relative dates
  if (/amanh[ãa]/i.test(lowerMessage)) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    result.specificDate = tomorrow.toISOString().split('T')[0];
  } else if (/hoje/i.test(lowerMessage)) {
    result.specificDate = new Date().toISOString().split('T')[0];
  }
  
  // Day of week
  const weekdays: Record<string, number> = {
    'domingo': 0, 'segunda': 1, 'terça': 2, 'terca': 2,
    'quarta': 3, 'quinta': 4, 'sexta': 5, 'sábado': 6, 'sabado': 6
  };
  
  for (const [day, num] of Object.entries(weekdays)) {
    if (lowerMessage.includes(day)) {
      const now = new Date();
      const currentDay = now.getDay();
      let daysToAdd = num - currentDay;
      if (daysToAdd <= 0) daysToAdd += 7;
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + daysToAdd);
      result.specificDate = targetDate.toISOString().split('T')[0];
      break;
    }
  }
  
  // Extract topic (remove patterns and extract what's left)
  let topic = message
    .replace(/https?:\/\/[^\s]+/g, '')
    .replace(/cri(e|ar|a)\s+(\d+\s+)?cards?\s+(no\s+)?planejamento/gi, '')
    .replace(/adicionar?\s+(ao\s+)?planejamento/gi, '')
    .replace(/agendar?\s+(um\s+|uma\s+)?(post|conte[uú]do|card|publica[cç][aã]o)/gi, '')
    .replace(/programa(r|e)\s+(um\s+|uma\s+)?(post|conte[uú]do|card|publica[cç][aã]o)/gi, '')
    .replace(/coloca(r)?\s+(isso\s+)?(no\s+)?planejamento/gi, '')
    .replace(/para\s+(o\s+)?(dia|data)\s+\d+[\/\-]\d+[\/\-]?\d*/gi, '')
    .replace(/para\s+(instagram|twitter|linkedin|youtube|tiktok)/gi, '')
    .replace(/(sobre|baseado\s+em|a\s+partir\s+de)/gi, '')
    .trim();
  
  if (topic.length > 10) {
    result.topic = topic;
  }
  
  // Determine missing info
  if (!result.platform) {
    result.missingInfo.push("plataforma");
  }
  if (!result.specificDate && result.action === "schedule") {
    result.missingInfo.push("data");
  }
  
  return result;
}

// ============================================
// CONTENT CREATION DETECTION
// ============================================

// Note: FORMAT_KEY_MAP, CONTENT_TYPE_MAP, and CONTENT_FORMAT_KEYWORDS 
// are imported from ../_shared/format-constants.ts

interface ContentCreationResult {
  isContentCreation: boolean;
  detectedFormat: string | null;
}

// Local alias for backward compatibility
const contentFormats = CONTENT_FORMAT_KEYWORDS;

/**
 * Detect implicit format from conversation history when explicit detection fails
 * This allows natural follow-ups like "create another one" to work
 */
function detectImplicitFormat(
  message: string,
  history?: HistoryMessage[]
): string | null {
  if (!history || history.length === 0) return null;
  
  // Check recent history (last 5 messages) for format mentions
  const recentHistory = history.slice(-5);
  
  for (const msg of recentHistory.reverse()) {
    const content = msg.content.toLowerCase();
    for (const [format, keywords] of Object.entries(contentFormats)) {
      if (keywords.some(k => content.includes(k))) {
        console.log("[kai-simple-chat] Implicit format detected from history:", format);
        return format;
      }
    }
  }
  
  return null;
}

function detectContentCreation(message: string, history?: HistoryMessage[]): ContentCreationResult {
  const lowerMessage = message.toLowerCase();
  
  // Creation intent keywords
  const creationPatterns = [
    /cri(e|ar|a|ando)/i,
    /fa(ça|zer|z|zendo)/i,
    /gere?(ar)?/i,
    /escrev(a|er|endo)/i,
    /elabor(e|ar|ando)/i,
    /mont(e|ar|ando)/i,
    /produz(a|ir|indo)/i,
    /desenvolv(a|er|endo)/i,
    /prepara?(r)?/i,
  ];
  
  // Check if there's a creation intent
  const hasCreationIntent = creationPatterns.some(p => p.test(lowerMessage));
  
  if (!hasCreationIntent) {
    return { isContentCreation: false, detectedFormat: null };
  }
  
  // Check for explicit content format in current message
  for (const [format, keywords] of Object.entries(contentFormats)) {
    if (keywords.some(k => lowerMessage.includes(k))) {
      return { isContentCreation: true, detectedFormat: format };
    }
  }
  
  // Generic content creation without specific format - try implicit detection
  if (/conte[uú]do|conteudo|texto|copy/i.test(lowerMessage)) {
    // Try to infer from history
    const implicitFormat = detectImplicitFormat(message, history);
    return { isContentCreation: true, detectedFormat: implicitFormat };
  }
  
  return { isContentCreation: false, detectedFormat: null };
}

// ============================================
// AUTOMATIC CONTEXT FETCHING FOR CONTENT CREATION
// ============================================

const MAX_LIBRARY_EXAMPLE_LENGTH = 1500;
const MAX_REFERENCE_LENGTH = 1000;

/**
 * Fetch examples from client's content library (same format)
 * These serve as style/structure reference for new content
 */
/**
 * Fetch examples from client's content library
 * PRIORITY ORDER:
 * 1. Favorites of specific format
 * 2. General favorites
 * 3. Recent of specific format
 * 4. Any recent content
 */
async function fetchLibraryExamples(
  supabase: any,
  clientId: string,
  contentType: string | null,
  limit: number = 5
): Promise<string> {
  // Map detected format to database content_type
  const dbContentType = contentType ? CONTENT_TYPE_MAP[contentType] : null;
  let examples: any[] = [];
  
  // PHASE 1: Fetch favorites of specific format first
  if (dbContentType) {
    const { data: favoriteExamples } = await supabase
      .from("client_content_library")
      .select("id, title, content, content_type, is_favorite, metadata, created_at")
      .eq("client_id", clientId)
      .eq("content_type", dbContentType)
      .eq("is_favorite", true)
      .order("created_at", { ascending: false })
      .limit(3);
    
    if (favoriteExamples && favoriteExamples.length > 0) {
      examples = favoriteExamples;
      console.log("[kai-simple-chat] Found", favoriteExamples.length, "favorite examples of type:", dbContentType);
    }
  }
  
  // PHASE 2: If not enough favorites, fetch general favorites
  if (examples.length < 3) {
    const existingIds = examples.map(e => e.id);
    let query = supabase
      .from("client_content_library")
      .select("id, title, content, content_type, is_favorite, metadata, created_at")
      .eq("client_id", clientId)
      .eq("is_favorite", true)
      .order("created_at", { ascending: false })
      .limit(3 - examples.length);
    
    if (existingIds.length > 0) {
      query = query.not("id", "in", `(${existingIds.join(",")})`);
    }
    
    const { data: moreFavorites } = await query;
    if (moreFavorites && moreFavorites.length > 0) {
      examples = [...examples, ...moreFavorites];
      console.log("[kai-simple-chat] Added", moreFavorites.length, "general favorites");
    }
  }
  
  // PHASE 3: Fill remaining slots with recent content of same format
  if (examples.length < limit && dbContentType) {
    const existingIds = examples.map(e => e.id);
    let query = supabase
      .from("client_content_library")
      .select("id, title, content, content_type, is_favorite, metadata, created_at")
      .eq("client_id", clientId)
      .eq("content_type", dbContentType)
      .order("created_at", { ascending: false })
      .limit(limit - examples.length);
    
    if (existingIds.length > 0) {
      query = query.not("id", "in", `(${existingIds.join(",")})`);
    }
    
    const { data: recentExamples } = await query;
    if (recentExamples && recentExamples.length > 0) {
      examples = [...examples, ...recentExamples];
      console.log("[kai-simple-chat] Added", recentExamples.length, "recent examples of type:", dbContentType);
    }
  }
  
  // PHASE 4: Fallback - any recent content
  if (examples.length < 2) {
    const existingIds = examples.map(e => e.id);
    let query = supabase
      .from("client_content_library")
      .select("id, title, content, content_type, is_favorite, metadata, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(3);
    
    if (existingIds.length > 0) {
      query = query.not("id", "in", `(${existingIds.join(",")})`);
    }
    
    const { data: fallbackExamples } = await query;
    if (fallbackExamples && fallbackExamples.length > 0) {
      examples = [...examples, ...fallbackExamples];
      console.log("[kai-simple-chat] Added", fallbackExamples.length, "fallback examples");
    }
  }
  
  if (examples.length === 0) {
    return "";
  }
  
  // Enrich with metrics (cross-reference with instagram_posts)
  examples = await enrichWithMetrics(supabase, clientId, examples);
  
  // Build context with favorite indicators and metrics
  let context = `\n## 📚 Exemplos da Biblioteca de Conteúdo (SIGA ESTE ESTILO E ESTRUTURA)\n`;
  context += `*Estes são conteúdos reais do cliente. REPLIQUE o tom, estrutura e abordagem.*\n`;
  
  examples.forEach((ex: any, i: number) => {
    const favIcon = ex.is_favorite ? "⭐ " : "";
    const metricsLabel = ex.engagement_rate 
      ? ` [📈 ${ex.engagement_rate.toFixed(2)}% engajamento]`
      : ex.likes 
        ? ` [${ex.likes} likes]`
        : "";
    
    const truncatedContent = ex.content?.substring(0, MAX_LIBRARY_EXAMPLE_LENGTH) || "";
    const ellipsis = ex.content?.length > MAX_LIBRARY_EXAMPLE_LENGTH ? "..." : "";
    
    context += `\n### ${favIcon}Exemplo ${i + 1}: ${ex.title} (${ex.content_type})${metricsLabel}\n`;
    context += `${truncatedContent}${ellipsis}\n`;
  });
  
  console.log("[kai-simple-chat] Loaded", examples.length, "library examples with priority order");
  return context;
}

/**
 * Enrich examples with performance metrics from Instagram posts
 * This helps the AI understand which content performs best
 */
async function enrichWithMetrics(
  supabase: any,
  clientId: string,
  examples: any[]
): Promise<any[]> {
  if (examples.length === 0) return examples;
  
  // Fetch top Instagram posts for cross-referencing
  const { data: instaPosts } = await supabase
    .from("instagram_posts")
    .select("caption, full_content, engagement_rate, likes, posted_at")
    .eq("client_id", clientId)
    .order("engagement_rate", { ascending: false, nullsFirst: false })
    .limit(30);
  
  if (!instaPosts || instaPosts.length === 0) return examples;
  
  // Match examples with Instagram posts by content similarity
  return examples.map(ex => {
    const exTitle = (ex.title || "").toLowerCase().substring(0, 40);
    const exContent = (ex.content || "").toLowerCase().substring(0, 100);
    
    const matchingPost = instaPosts.find((p: any) => {
      const caption = (p.caption || "").toLowerCase();
      const fullContent = (p.full_content || "").toLowerCase();
      
      // Check if title appears in caption or full content
      if (exTitle.length > 10 && (caption.includes(exTitle) || fullContent.includes(exTitle))) {
        return true;
      }
      
      // Check if significant part of content matches
      if (exContent.length > 30) {
        const contentSample = exContent.substring(0, 50);
        if (caption.includes(contentSample) || fullContent.includes(contentSample)) {
          return true;
        }
      }
      
      return false;
    });
    
    if (matchingPost) {
      console.log("[kai-simple-chat] Enriched example with metrics:", ex.title);
      return {
        ...ex,
        engagement_rate: matchingPost.engagement_rate,
        likes: matchingPost.likes,
      };
    }
    
    return ex;
  });
}

/**
 * Fetch references from client's reference library
 * These serve as inspiration/benchmarks
 */
async function fetchReferenceExamples(
  supabase: any,
  clientId: string,
  referenceType: string | null,
  limit: number = 3
): Promise<string> {
  // Map detected format to reference type (similar mapping)
  const dbReferenceType = referenceType ? CONTENT_TYPE_MAP[referenceType] : null;
  
  let query = supabase
    .from("client_reference_library")
    .select("title, content, reference_type, source_url")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  
  // Filter by reference type if we have a mapping
  if (dbReferenceType) {
    query = query.eq("reference_type", dbReferenceType);
  }
  
  const { data: refs, error } = await query.limit(limit);
  
  if (error) {
    console.log("[kai-simple-chat] Error fetching reference examples:", error.message);
    return "";
  }
  
  // If no refs of specific type, try to get any refs
  if (!refs || refs.length === 0) {
    if (dbReferenceType) {
      const { data: fallbackRefs } = await supabase
        .from("client_reference_library")
        .select("title, content, reference_type, source_url")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(2);
      
      if (fallbackRefs && fallbackRefs.length > 0) {
        let context = `\n## 🎯 Referências Salvas (inspiração e benchmarks)\n`;
        fallbackRefs.forEach((ref: any, i: number) => {
          const truncatedContent = ref.content?.substring(0, MAX_REFERENCE_LENGTH) || "";
          const ellipsis = ref.content?.length > MAX_REFERENCE_LENGTH ? "..." : "";
          context += `\n### Referência ${i + 1}: ${ref.title}\n`;
          context += `${truncatedContent}${ellipsis}\n`;
          if (ref.source_url) {
            context += `Fonte: ${ref.source_url}\n`;
          }
        });
        console.log("[kai-simple-chat] Loaded", fallbackRefs.length, "fallback references");
        return context;
      }
    }
    return "";
  }
  
  let context = `\n## 🎯 Referências do Cliente (inspiração e benchmarks)\n`;
  context += `*Use como inspiração, mas adapte ao estilo próprio do cliente.*\n`;
  
  refs.forEach((ref: any, i: number) => {
    const truncatedContent = ref.content?.substring(0, MAX_REFERENCE_LENGTH) || "";
    const ellipsis = ref.content?.length > MAX_REFERENCE_LENGTH ? "..." : "";
    context += `\n### Referência ${i + 1}: ${ref.title} (${ref.reference_type})\n`;
    context += `${truncatedContent}${ellipsis}\n`;
    if (ref.source_url) {
      context += `Fonte: ${ref.source_url}\n`;
    }
  });
  
  console.log("[kai-simple-chat] Loaded", refs.length, "reference examples of type:", dbReferenceType || "mixed");
  return context;
}

// ============================================
// IMAGE GENERATION DETECTION
// ============================================

interface ImageGenerationResult {
  isRequest: boolean;
  prompt: string;
}

function isImageGenerationRequest(message: string): ImageGenerationResult {
  const patterns = [
    /gera(r|ndo)?\s*(uma?)?\s*imagem/i,
    /cria(r|ndo)?\s*(uma?)?\s*imagem/i,
    /@imagem\s*/i,
    /fazer?\s*(uma?)?\s*(arte|visual|imagem)/i,
    /crie?\s*(uma?)?\s*foto/i,
    /desenhar?\s*(uma?)?/i,
    /ilustra[cç][aã]o/i,
  ];
  
  for (const pattern of patterns) {
    if (pattern.test(message)) {
      // Extract prompt after the pattern match
      const prompt = message
        .replace(pattern, "")
        .replace(/^[\s:,]+/, "")
        .trim() || message;
      
      return { isRequest: true, prompt };
    }
  }
  
  return { isRequest: false, prompt: "" };
}

// ============================================
// PERIOD COMPARISON DETECTION
// ============================================

interface ComparisonResult {
  isComparison: boolean;
  period1: DateRange | null;
  period2: DateRange | null;
  period1Label: string;
  period2Label: string;
}

function isComparisonQuery(message: string): ComparisonResult {
  const lowerMessage = message.toLowerCase();
  
  const comparisonPatterns = [
    /compare?\s+(.+?)\s+(com|vs?|versus|e|contra)\s+(.+)/i,
    /diferen[cç]a\s+entre\s+(.+?)\s+e\s+(.+)/i,
    /(.+?)\s+vs\.?\s+(.+)/i,
    /compara[cç][aã]o\s+(.+?)\s+(com|e)\s+(.+)/i,
  ];
  
  for (const pattern of comparisonPatterns) {
    const match = lowerMessage.match(pattern);
    if (match) {
      let period1Str = "";
      let period2Str = "";
      
      // Handle different pattern groups
      if (pattern.source.includes("entre")) {
        period1Str = match[1];
        period2Str = match[2];
      } else if (pattern.source.includes("compare")) {
        period1Str = match[1];
        period2Str = match[3];
      } else if (pattern.source.includes("compara")) {
        period1Str = match[1];
        period2Str = match[3];
      } else {
        period1Str = match[1];
        period2Str = match[2];
      }
      
      const period1 = extractDateRangeFromText(period1Str);
      const period2 = extractDateRangeFromText(period2Str);
      
      if (period1 && period2) {
        return {
          isComparison: true,
          period1,
          period2,
          period1Label: period1Str.trim(),
          period2Label: period2Str.trim(),
        };
      }
    }
  }
  
  return { isComparison: false, period1: null, period2: null, period1Label: "", period2Label: "" };
}

// Helper to extract date range from text fragment
function extractDateRangeFromText(text: string): DateRange | null {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  
  // Check for month names
  for (const [monthName, monthNum] of Object.entries(MONTH_MAP)) {
    if (text.toLowerCase().includes(monthName)) {
      // Check for year in the text
      const yearMatch = text.match(/20(2[4-9]|3[0-9])/);
      const year = yearMatch ? parseInt(yearMatch[0]) : (monthNum > currentMonth ? currentYear - 1 : currentYear);
      
      const start = new Date(year, monthNum, 1);
      const end = new Date(year, monthNum + 1, 0);
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      };
    }
  }
  
  // Check for relative terms
  if (/mês\s+passado|último\s+mês/i.test(text)) {
    const start = new Date(currentYear, currentMonth - 1, 1);
    const end = new Date(currentYear, currentMonth, 0);
    return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
  }
  
  if (/este\s+mês|mês\s+atual/i.test(text)) {
    const start = new Date(currentYear, currentMonth, 1);
    const end = new Date(currentYear, currentMonth + 1, 0);
    return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
  }
  
  return null;
}

// ============================================
// DATE EXTRACTION
// ============================================

const MONTH_MAP: Record<string, number> = {
  janeiro: 0, jan: 0,
  fevereiro: 1, fev: 1,
  março: 2, marco: 2, mar: 2,
  abril: 3, abr: 3,
  maio: 4, mai: 4,
  junho: 5, jun: 5,
  julho: 6, jul: 6,
  agosto: 7, ago: 7,
  setembro: 8, set: 8,
  outubro: 9, out: 9,
  novembro: 10, nov: 10,
  dezembro: 11, dez: 11,
};

function extractDateRange(message: string): DateRange | null {
  const lowerMessage = message.toLowerCase();
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  // Pattern 1: Month + Year (e.g., "dezembro de 2025", "dezembro 2025", "dez/2025")
  const monthYearPattern = /(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\s*(de\s*|\/)?(\d{4})/i;
  const monthYearMatch = lowerMessage.match(monthYearPattern);
  
  if (monthYearMatch) {
    const monthName = monthYearMatch[1].toLowerCase();
    const year = parseInt(monthYearMatch[3]);
    const month = MONTH_MAP[monthName];
    
    if (month !== undefined) {
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0); // Last day of month
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      };
    }
  }

  // Pattern 2: Just month name (assume current year or last occurrence)
  const monthOnlyPattern = /\b(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\b/i;
  const monthOnlyMatch = lowerMessage.match(monthOnlyPattern);
  
  if (monthOnlyMatch && !monthYearMatch) {
    const monthName = monthOnlyMatch[1].toLowerCase();
    const month = MONTH_MAP[monthName];
    
    if (month !== undefined) {
      // If the month is in the future for this year, use last year
      const year = month > currentMonth ? currentYear - 1 : currentYear;
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0);
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      };
    }
  }

  // Pattern 3: Relative periods
  if (/mês\s+passado|último\s+mês|mes\s+passado/i.test(lowerMessage)) {
    const start = new Date(currentYear, currentMonth - 1, 1);
    const end = new Date(currentYear, currentMonth, 0);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  }

  if (/este\s+mês|esse\s+mês|mês\s+atual/i.test(lowerMessage)) {
    const start = new Date(currentYear, currentMonth, 1);
    const end = new Date(currentYear, currentMonth + 1, 0);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  }

  if (/últim(os|as)\s+(\d+)\s*(dias|semanas)/i.test(lowerMessage)) {
    const match = lowerMessage.match(/últim(os|as)\s+(\d+)\s*(dias|semanas)/i);
    if (match) {
      const num = parseInt(match[2]);
      const unit = match[3].toLowerCase();
      const daysBack = unit === 'semanas' ? num * 7 : num;
      const start = new Date();
      start.setDate(start.getDate() - daysBack);
      return {
        start: start.toISOString().split('T')[0],
        end: currentDate.toISOString().split('T')[0],
      };
    }
  }

  // Pattern 4: Year only (e.g., "em 2025")
  const yearPattern = /\b(em\s+)?20(2[4-9]|3[0-9])\b/;
  const yearMatch = lowerMessage.match(yearPattern);
  if (yearMatch && !monthYearMatch) {
    const year = parseInt(yearMatch[0].replace(/em\s+/, ''));
    return {
      start: `${year}-01-01`,
      end: `${year}-12-31`,
    };
  }

  return null;
}

// ============================================
// METRIC FOCUS DETECTION
// ============================================

function detectMetricFocus(message: string): MetricFocus {
  const lowerMessage = message.toLowerCase();
  
  if (/engajamento|engagement|taxa\s+de\s+engajamento/i.test(lowerMessage)) {
    return 'engagement';
  }
  if (/alcance|reach/i.test(lowerMessage)) {
    return 'reach';
  }
  if (/coment[aá]rios?|comments?/i.test(lowerMessage)) {
    return 'comments';
  }
  if (/saves?|salvos?|salvamentos?/i.test(lowerMessage)) {
    return 'saves';
  }
  if (/compartilhamentos?|shares?/i.test(lowerMessage)) {
    return 'shares';
  }
  
  // Default to likes as most common metric
  return 'likes';
}

// ============================================
// METRICS CONTEXT BUILDER (ENHANCED)
// ============================================

async function fetchMetricsContext(
  supabase: any,
  clientId: string,
  dateRange?: DateRange | null,
  metricFocus?: MetricFocus,
  isSpecificQuery?: boolean
): Promise<string> {
  console.log("[kai-simple-chat] fetchMetricsContext:", { clientId, dateRange, metricFocus, isSpecificQuery });

  // Determine date range to use
  const queryStart = dateRange?.start || (() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  })();
  const queryEnd = dateRange?.end || new Date().toISOString().split("T")[0];

  // Determine order column based on metric focus
  const orderColumn = metricFocus === 'engagement' ? 'engagement_rate' :
                      metricFocus === 'reach' ? 'reach' :
                      metricFocus === 'comments' ? 'comments' :
                      metricFocus === 'saves' ? 'saves' :
                      metricFocus === 'shares' ? 'shares' : 'likes';

  const postsLimit = isSpecificQuery ? 10 : 20;

  const [metricsResult, postsResult] = await Promise.all([
    supabase
      .from("platform_metrics")
      .select("*")
      .eq("client_id", clientId)
      .gte("metric_date", queryStart)
      .lte("metric_date", queryEnd)
      .order("metric_date", { ascending: false })
      .limit(60),
    supabase
      .from("instagram_posts")
      .select("id, caption, full_content, video_transcript, likes, comments, saves, shares, reach, impressions, engagement_rate, posted_at, post_type, permalink")
      .eq("client_id", clientId)
      .gte("posted_at", queryStart)
      .lte("posted_at", queryEnd + "T23:59:59Z")
      .order(orderColumn, { ascending: false, nullsFirst: false })
      .limit(postsLimit),
  ]);

  const metrics: any[] = metricsResult.data || [];
  const posts: any[] = postsResult.data || [];

  console.log("[kai-simple-chat] Fetched data:", { 
    metricsCount: metrics.length, 
    postsCount: posts.length,
    dateRange: { start: queryStart, end: queryEnd }
  });

  if (metrics.length === 0 && posts.length === 0) {
    return `\n## Dados de Performance\nNenhum dado encontrado para o período de ${queryStart} a ${queryEnd}.\n`;
  }

  // Build period label
  const periodLabel = dateRange 
    ? `${formatDateBR(queryStart)} a ${formatDateBR(queryEnd)}`
    : "Últimos 30 dias";

  let context = `\n## Dados de Performance do Cliente (${periodLabel})\n`;

  // Add platform metrics summary
  const byPlatform: Record<string, any[]> = {};
  for (const m of metrics) {
    if (!byPlatform[m.platform]) byPlatform[m.platform] = [];
    byPlatform[m.platform].push(m);
  }

  for (const [platform, platformMetrics] of Object.entries(byPlatform)) {
    const latest = platformMetrics[0];
    const oldest = platformMetrics[platformMetrics.length - 1];
    
    context += `\n### ${platform.charAt(0).toUpperCase() + platform.slice(1)}\n`;
    
    if (latest.subscribers !== null && latest.subscribers !== undefined) {
      const current = latest.subscribers || 0;
      const previous = oldest.subscribers || 0;
      const growth = current - previous;
      context += `- Inscritos: ${current.toLocaleString('pt-BR')} (${growth >= 0 ? "+" : ""}${growth.toLocaleString('pt-BR')} no período)\n`;
    }
    
    if (latest.engagement_rate !== null) {
      const avgEngagement = platformMetrics.reduce((sum: number, m: any) => sum + (m.engagement_rate || 0), 0) / platformMetrics.length;
      context += `- Taxa de Engajamento Média: ${avgEngagement.toFixed(2)}%\n`;
    }
    
    if (latest.views !== null) {
      const totalViews = platformMetrics.reduce((sum: number, m: any) => sum + (m.views || 0), 0);
      context += `- Total de Views: ${totalViews.toLocaleString('pt-BR')}\n`;
    }
  }

  // Add detailed posts data
  if (posts.length > 0) {
    const metricLabel = metricFocus === 'engagement' ? 'Engajamento' :
                       metricFocus === 'reach' ? 'Alcance' :
                       metricFocus === 'comments' ? 'Comentários' :
                       metricFocus === 'saves' ? 'Salvamentos' :
                       metricFocus === 'shares' ? 'Compartilhamentos' : 'Likes';

    // Calculate averages for comparison
    const avgLikes = posts.reduce((sum: number, p: any) => sum + (p.likes || 0), 0) / posts.length;
    const avgEngagement = posts.reduce((sum: number, p: any) => sum + (p.engagement_rate || 0), 0) / posts.length;
    const avgComments = posts.reduce((sum: number, p: any) => sum + (p.comments || 0), 0) / posts.length;
    const avgReach = posts.reduce((sum: number, p: any) => sum + (p.reach || 0), 0) / posts.length;

    context += `\n### Posts do Instagram (${posts.length} posts encontrados)\n`;
    context += `**Médias do período:** ${Math.round(avgLikes).toLocaleString('pt-BR')} likes | ${avgEngagement.toFixed(2)}% eng | ${Math.round(avgComments)} comments | ${Math.round(avgReach).toLocaleString('pt-BR')} reach\n`;

    // If specific query, provide detailed ranking
    if (isSpecificQuery) {
      context += `\n**Ranking por ${metricLabel}:**\n`;
      
      posts.forEach((p: any, i: number) => {
        const metricValue = metricFocus === 'engagement' ? p.engagement_rate?.toFixed(2) + '%' :
                           metricFocus === 'reach' ? (p.reach || 0).toLocaleString('pt-BR') :
                           metricFocus === 'comments' ? (p.comments || 0).toString() :
                           metricFocus === 'saves' ? (p.saves || 0).toString() :
                           metricFocus === 'shares' ? (p.shares || 0).toString() :
                           (p.likes || 0).toLocaleString('pt-BR');
        
        const postDate = p.posted_at ? formatDateBR(p.posted_at.split('T')[0]) : 'Data desconhecida';
        const postType = p.post_type || 'post';
        
        // For top 3, include full content (with transcriptions) for analysis
        const fullContent = p.full_content || p.caption || 'Sem legenda';
        const caption = i < 3 
          ? fullContent
          : (fullContent.substring(0, 100)) + (fullContent.length > 100 ? '...' : '');
        
        const likesVsAvg = p.likes && avgLikes > 0 
          ? ((p.likes / avgLikes - 1) * 100).toFixed(0)
          : '0';
        const likesIndicator = parseInt(likesVsAvg) > 0 ? `📈 +${likesVsAvg}% vs média` : '';

        context += `\n**#${i + 1} - ${metricValue} ${metricLabel}** (${postDate})\n`;
        context += `Tipo: ${postType} | Likes: ${(p.likes || 0).toLocaleString('pt-BR')} | Comments: ${p.comments || 0} | Shares: ${p.shares || 0} | Saves: ${p.saves || 0}\n`;
        context += `Engajamento: ${p.engagement_rate?.toFixed(2) || 0}% | Alcance: ${(p.reach || 0).toLocaleString('pt-BR')} ${likesIndicator}\n`;
        context += `Conteúdo: ${caption}\n`;
        
        // Include video/audio transcription if available
        if (p.video_transcript && i < 3) {
          context += `Transcrição do Áudio: ${p.video_transcript.substring(0, 500)}${p.video_transcript.length > 500 ? '...' : ''}\n`;
        }
        
        if (p.permalink) {
          context += `Link: ${p.permalink}\n`;
        }
      });
    } else {
      // Regular summary - top 5 by chosen metric
      context += `\n**Top 5 por ${metricLabel}:**\n`;
      const topPosts = posts.slice(0, 5);
      
      topPosts.forEach((p: any, i: number) => {
        const caption = p.caption?.substring(0, 80) || "Sem legenda";
        const postDate = p.posted_at ? formatDateBR(p.posted_at.split('T')[0]) : '';
        context += `${i + 1}. ${caption}${p.caption?.length > 80 ? '...' : ''}\n`;
        context += `   📊 ${(p.likes || 0).toLocaleString('pt-BR')} likes | ${p.engagement_rate?.toFixed(2) || 0}% eng | ${postDate}\n`;
      });
    }
  }

  return context.substring(0, MAX_METRICS_CONTEXT_LENGTH);
}

function formatDateBR(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

// ============================================
// WEB SEARCH INTEGRATION
// ============================================

async function performWebSearch(
  query: string,
  authHeader: string
): Promise<string | null> {
  const GROK_API_KEY = Deno.env.get("GROK_API_KEY");
  if (!GROK_API_KEY) {
    console.log("[kai-simple-chat] Grok API key not configured, skipping web search");
    return null;
  }

  try {
    console.log("[kai-simple-chat] Performing web search:", query);
    
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROK_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-beta",
        messages: [
          {
            role: "system",
            content: "Você é um assistente de pesquisa. Forneça informações atualizadas, precisas e bem fundamentadas. Seja conciso e objetivo.",
          },
          {
            role: "user",
            content: query,
          },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      console.error("[kai-simple-chat] Grok search error:", response.status);
      return null;
    }

    const data = await response.json();
    const result = data.choices?.[0]?.message?.content;
    
    if (result) {
      console.log("[kai-simple-chat] Web search completed");
      return `\n## Informações da Pesquisa Web\n${result}\n`;
    }
    
    return null;
  } catch (error) {
    console.error("[kai-simple-chat] Web search failed:", error);
    return null;
  }
}

// ============================================
// IMAGE GENERATION
// ============================================

interface ImageGenerationOutput {
  imageData?: string;
  text?: string;
  error?: string;
}

async function generateImage(
  prompt: string,
  clientName: string
): Promise<ImageGenerationOutput> {
  const GOOGLE_API_KEY = Deno.env.get("GOOGLE_AI_STUDIO_API_KEY");
  if (!GOOGLE_API_KEY) {
    return { error: "Chave de API do Google não configurada" };
  }

  try {
    console.log("[kai-simple-chat] Generating image for:", prompt);
    
    // Enhance prompt with client context
    const enhancedPrompt = `Create a professional, high-quality image for ${clientName}. 
The image should be: ${prompt}
Style: Modern, clean, professional. No text or watermarks.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: enhancedPrompt }] }],
          generationConfig: {
            responseModalities: ["Text", "Image"],
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[kai-simple-chat] Image generation error:", response.status, errorText);
      return { error: "Erro ao gerar imagem. Tente novamente." };
    }

    const data = await response.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    
    let imageData: string | undefined;
    let text = "Imagem gerada! 🎨";
    
    for (const part of parts) {
      if (part.inlineData?.mimeType?.startsWith("image/")) {
        imageData = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
      if (part.text) {
        text = part.text;
      }
    }
    
    if (!imageData) {
      return { error: "Não foi possível gerar a imagem. Tente reformular o pedido." };
    }

    console.log("[kai-simple-chat] Image generated successfully");
    return { imageData, text };
    
  } catch (error) {
    console.error("[kai-simple-chat] Image generation failed:", error);
    return { error: "Erro ao gerar imagem. Tente novamente." };
  }
}

// ============================================
// PERIOD COMPARISON
// ============================================

async function fetchComparisonContext(
  supabase: any,
  clientId: string,
  period1: DateRange,
  period2: DateRange,
  period1Label: string,
  period2Label: string
): Promise<string> {
  console.log("[kai-simple-chat] Fetching comparison context:", { period1, period2 });

  // Fetch metrics for both periods in parallel
  const [posts1Result, posts2Result] = await Promise.all([
    supabase
      .from("instagram_posts")
      .select("likes, comments, saves, shares, reach, impressions, engagement_rate")
      .eq("client_id", clientId)
      .gte("posted_at", period1.start)
      .lte("posted_at", period1.end + "T23:59:59Z"),
    supabase
      .from("instagram_posts")
      .select("likes, comments, saves, shares, reach, impressions, engagement_rate")
      .eq("client_id", clientId)
      .gte("posted_at", period2.start)
      .lte("posted_at", period2.end + "T23:59:59Z"),
  ]);

  const posts1: any[] = posts1Result.data || [];
  const posts2: any[] = posts2Result.data || [];

  // Calculate aggregates
  const calcAggregates = (posts: any[]) => {
    if (posts.length === 0) {
      return { posts: 0, likes: 0, comments: 0, saves: 0, shares: 0, reach: 0, engagement: 0 };
    }
    return {
      posts: posts.length,
      likes: posts.reduce((sum, p) => sum + (p.likes || 0), 0),
      comments: posts.reduce((sum, p) => sum + (p.comments || 0), 0),
      saves: posts.reduce((sum, p) => sum + (p.saves || 0), 0),
      shares: posts.reduce((sum, p) => sum + (p.shares || 0), 0),
      reach: posts.reduce((sum, p) => sum + (p.reach || 0), 0),
      engagement: posts.reduce((sum, p) => sum + (p.engagement_rate || 0), 0) / posts.length,
    };
  };

  const agg1 = calcAggregates(posts1);
  const agg2 = calcAggregates(posts2);

  // Calculate percentage changes
  const calcChange = (val1: number, val2: number): string => {
    if (val2 === 0) return val1 > 0 ? "+100%" : "0%";
    const change = ((val1 - val2) / val2) * 100;
    return `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`;
  };

  const changeEmoji = (val1: number, val2: number): string => {
    if (val1 > val2) return "📈";
    if (val1 < val2) return "📉";
    return "➡️";
  };

  let context = `
## Comparativo: ${period1Label} vs ${period2Label}

| Métrica | ${period1Label} | ${period2Label} | Variação |
|---------|-----------------|-----------------|----------|
| Posts | ${agg1.posts} | ${agg2.posts} | ${calcChange(agg1.posts, agg2.posts)} ${changeEmoji(agg1.posts, agg2.posts)} |
| Likes | ${agg1.likes.toLocaleString('pt-BR')} | ${agg2.likes.toLocaleString('pt-BR')} | ${calcChange(agg1.likes, agg2.likes)} ${changeEmoji(agg1.likes, agg2.likes)} |
| Comentários | ${agg1.comments.toLocaleString('pt-BR')} | ${agg2.comments.toLocaleString('pt-BR')} | ${calcChange(agg1.comments, agg2.comments)} ${changeEmoji(agg1.comments, agg2.comments)} |
| Saves | ${agg1.saves.toLocaleString('pt-BR')} | ${agg2.saves.toLocaleString('pt-BR')} | ${calcChange(agg1.saves, agg2.saves)} ${changeEmoji(agg1.saves, agg2.saves)} |
| Shares | ${agg1.shares.toLocaleString('pt-BR')} | ${agg2.shares.toLocaleString('pt-BR')} | ${calcChange(agg1.shares, agg2.shares)} ${changeEmoji(agg1.shares, agg2.shares)} |
| Alcance Total | ${agg1.reach.toLocaleString('pt-BR')} | ${agg2.reach.toLocaleString('pt-BR')} | ${calcChange(agg1.reach, agg2.reach)} ${changeEmoji(agg1.reach, agg2.reach)} |
| Engajamento Médio | ${agg1.engagement.toFixed(2)}% | ${agg2.engagement.toFixed(2)}% | ${calcChange(agg1.engagement, agg2.engagement)} ${changeEmoji(agg1.engagement, agg2.engagement)} |

### Resumo
- **${period1Label}**: ${agg1.posts} posts, ${agg1.likes.toLocaleString('pt-BR')} likes totais
- **${period2Label}**: ${agg2.posts} posts, ${agg2.likes.toLocaleString('pt-BR')} likes totais
`;

  return context;
}

// ============================================
// PLANNING HELPERS
// ============================================

/**
 * Build a question prompt when info is missing
 */
function buildPlanningQuestionPrompt(intent: PlanningIntent, clientName: string): string {
  const questions: string[] = [];
  
  if (!intent.platform) {
    questions.push("📱 **Para qual plataforma?** (Instagram, Twitter, LinkedIn, YouTube, Newsletter, TikTok)");
  }
  
  if (!intent.specificDate && intent.action === "schedule") {
    questions.push("📅 **Para qual data?** (ex: 28/01/2026, amanhã, próxima segunda)");
  }
  
  if (!intent.topic && !intent.sourceUrl) {
    questions.push("📝 **Sobre qual tema ou assunto?** (pode enviar um link de referência também)");
  }
  
  let response = `Vou criar ${intent.quantity > 1 ? `${intent.quantity} cards` : "o card"} no planejamento para **${clientName}**! ✨\n\nPreciso de algumas informações:\n\n`;
  response += questions.join("\n\n");
  response += "\n\n*Responda com as informações que faltam para eu criar os cards.*";
  
  return response;
}

/**
 * Generate planning cards using AI for content
 */
async function generatePlanningCards(
  supabase: any,
  client: any,
  clientId: string,
  workspaceId: string,
  userId: string,
  intent: PlanningIntent,
  authHeader: string
): Promise<any[]> {
  console.log("[kai-simple-chat] generatePlanningCards called:", {
    clientId,
    workspaceId,
    userId,
    quantity: intent.quantity,
    platform: intent.platform,
    specificDate: intent.specificDate,
    hasSourceUrl: !!intent.sourceUrl,
    hasTopic: !!intent.topic,
    action: intent.action,
  });
  
  const GOOGLE_API_KEY = Deno.env.get("GOOGLE_AI_STUDIO_API_KEY");
  
  // Validate workspace_id
  if (!workspaceId) {
    console.error("[kai-simple-chat] Missing workspace_id for planning cards");
    throw new Error("Cliente não está associado a um workspace");
  }
  
  // Get first column (Ideias) for the workspace
  const { data: columns, error: columnsError } = await supabase
    .from("kanban_columns")
    .select("id")
    .eq("workspace_id", workspaceId)
    .order("position", { ascending: true })
    .limit(1);

  if (columnsError || !columns || columns.length === 0) {
    console.error("[kai-simple-chat] No columns found:", columnsError);
    throw new Error("Nenhuma coluna de planejamento configurada. Configure o Kanban primeiro.");
  }

  const columnId = columns[0].id;
  console.log("[kai-simple-chat] Using column:", columnId);
  
  const cards: any[] = [];
  
  // Generate dates if distributing across week
  let dates: string[] = [];
  if (intent.action === "distribute") {
    dates = distributeAcrossWeek(intent.quantity);
    console.log("[kai-simple-chat] Distributed dates:", dates);
  } else if (intent.specificDate) {
    dates = Array(intent.quantity).fill(intent.specificDate);
    console.log("[kai-simple-chat] Using specific date:", intent.specificDate);
  }
  
  // Get URL content if available
  let urlContext = "";
  if (intent.sourceUrl) {
    console.log("[kai-simple-chat] Extracting content from URL:", intent.sourceUrl);
    if (intent.sourceUrl.includes("youtube.com") || intent.sourceUrl.includes("youtu.be")) {
      const { data: ytData } = await supabase.functions.invoke("extract-youtube", {
        body: { url: intent.sourceUrl },
      });
      if (ytData?.transcript) {
        urlContext = `Título do vídeo: ${ytData.title || 'N/A'}\nTranscrição: ${ytData.transcript.substring(0, 3000)}`;
        console.log("[kai-simple-chat] YouTube content extracted, length:", urlContext.length);
      }
    } else {
      const { data: scrapeData } = await supabase.functions.invoke("firecrawl-scrape", {
        body: { url: intent.sourceUrl },
      });
      if (scrapeData?.data?.markdown) {
        urlContext = scrapeData.data.markdown.substring(0, 3000);
        console.log("[kai-simple-chat] URL content extracted, length:", urlContext.length);
      }
    }
  }
  
  // Generate content for cards
  if (GOOGLE_API_KEY && (intent.topic || urlContext)) {
    const platformInstructions: Record<string, string> = {
      instagram: "Posts para Instagram: hook forte, máximo 2200 chars, poucos emojis",
      twitter: "Tweets: diretos, máximo 280 chars, impactantes",
      linkedin: "Posts LinkedIn: profissionais, storytelling, insights",
      youtube: "Títulos/descrições para YouTube: SEO otimizado",
      newsletter: "Títulos para newsletter: valor claro, CTA forte",
      tiktok: "Ideias para TikTok: trends, ganchos virais",
    };
    
    const prompt = `Você é um estrategista de conteúdo para ${client.name}.
${client.identity_guide ? `\nGuia de Identidade:\n${client.identity_guide.substring(0, 1500)}` : ""}
${urlContext ? `\n## Conteúdo de Referência:\n${urlContext}` : ""}

TAREFA: Gere ${intent.quantity} ideias de conteúdo para ${intent.platform || "redes sociais"}.
${intent.topic ? `Tema: ${intent.topic}` : ""}
${platformInstructions[intent.platform || "instagram"] || ""}

Responda APENAS com JSON no formato:
{
  "cards": [
    { "title": "título descritivo curto", "description": "conteúdo completo pronto para publicar" }
  ]
}`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.8, maxOutputTokens: 4096 },
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const jsonMatch = text.match(/\{[\s\S]*"cards"[\s\S]*\}/);
        
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const generatedCards = parsed.cards || [];
          
          console.log("[kai-simple-chat] Generated cards from AI:", {
            count: generatedCards.length,
            requestedQuantity: intent.quantity,
          });
          
          for (let i = 0; i < Math.min(generatedCards.length, intent.quantity); i++) {
            const genCard = generatedCards[i];
            const { data: newCard, error } = await supabase
              .from("planning_items")
              .insert({
                title: genCard.title,
                description: genCard.title, // Short summary
                content: genCard.description, // Full content here
                client_id: clientId,
                workspace_id: workspaceId,
                column_id: columnId,
                scheduled_at: dates[i] || null,
                platform: intent.platform,
                status: "todo",
                created_by: userId,
              })
              .select()
              .single();
            
            if (error) {
              console.error("[kai-simple-chat] Error inserting card:", error);
            } else if (newCard) {
              console.log("[kai-simple-chat] Card created:", { id: newCard.id, title: newCard.title });
              cards.push(newCard);
            }
          }
        }
      }
    } catch (error) {
      console.error("[kai-simple-chat] AI generation error:", error);
    }
  }
  
  // Fallback: create cards with basic info if AI didn't generate
  if (cards.length === 0) {
    console.log("[kai-simple-chat] Fallback: Creating cards with basic info");
    for (let i = 0; i < intent.quantity; i++) {
      const fallbackTitle = intent.topic || `Card ${i + 1}`;
      const fallbackContent = intent.sourceUrl ? `Referência: ${intent.sourceUrl}` : "";
      
      const { data: newCard, error } = await supabase
        .from("planning_items")
        .insert({
          title: fallbackTitle,
          description: fallbackTitle,
          content: fallbackContent,
          client_id: clientId,
          workspace_id: workspaceId,
          column_id: columnId,
          scheduled_at: dates[i] || intent.specificDate || null,
          platform: intent.platform,
          status: "todo",
          created_by: userId,
        })
        .select()
        .single();
      
      if (error) {
        console.error("[kai-simple-chat] Fallback card error:", error);
      } else if (newCard) {
        console.log("[kai-simple-chat] Fallback card created:", { id: newCard.id });
        cards.push(newCard);
      }
    }
  }
  
  if (cards.length === 0) {
    throw new Error("Não foi possível criar nenhum card");
  }
  
  return cards;
}

/**
 * Distribute dates across the week
 */
function distributeAcrossWeek(count: number): string[] {
  const dates: string[] = [];
  const start = new Date();
  const currentDay = start.getDay();
  
  // Prefer weekdays (Mon-Fri)
  const preferredDays = [1, 2, 3, 4, 5];
  let dayIndex = 0;
  
  for (let i = 0; i < count; i++) {
    const targetDate = new Date(start);
    const targetDay = preferredDays[dayIndex % preferredDays.length];
    
    let daysToAdd = targetDay - currentDay;
    if (daysToAdd <= 0) daysToAdd += 7;
    daysToAdd += Math.floor(dayIndex / 5) * 7;
    
    targetDate.setDate(start.getDate() + daysToAdd);
    dates.push(targetDate.toISOString().split('T')[0]);
    
    dayIndex++;
  }
  
  return dates.sort();
}

/**
 * Build success message after creating cards
 */
function buildPlanningSuccessMessage(cards: any[], intent: PlanningIntent): string {
  const count = cards.length;
  const platformEmoji = intent.platform ? getPlatformEmoji(intent.platform) : "📋";
  const platformLabel = intent.platform 
    ? ` para **${intent.platform.charAt(0).toUpperCase() + intent.platform.slice(1)}**` 
    : "";
  
  let message = `✅ **${count} ${count === 1 ? "card criado" : "cards criados"}${platformLabel}!**\n\n`;
  
  if (intent.sourceUrl) {
    message += `📎 Baseado em: ${intent.sourceUrl}\n\n`;
  }
  
  message += "📋 **Cards adicionados ao planejamento:**\n\n";
  
  for (let i = 0; i < Math.min(cards.length, 5); i++) {
    const card = cards[i];
    const dateStr = card.scheduled_at 
      ? ` | 📅 ${formatDateBR(card.scheduled_at.split('T')[0])}`
      : "";
    const platformIcon = card.platform ? ` | ${getPlatformEmoji(card.platform)}` : "";
    message += `${i + 1}. **${card.title}**${platformIcon}${dateStr}\n`;
  }
  
  if (cards.length > 5) {
    message += `\n*...e mais ${cards.length - 5} cards*\n`;
  }
  
  message += "\n---\n";
  message += "💡 **Próximos passos:**\n";
  message += "• Acesse **Planejamento** para editar ou reagendar\n";
  message += "• Use drag & drop para reorganizar no calendário\n";
  
  return message;
}

// ============================================
// MAIN HANDLER
// ============================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json() as RequestBody;
    const { message, clientId, imageUrls, citations, history } = body;

    console.log("[kai-simple-chat] Request:", { 
      userId: user.id,
      clientId, 
      imageUrlsCount: imageUrls?.length,
      citationsCount: citations?.length,
      historyCount: history?.length,
      messageLength: message?.length 
    });

    if (!clientId || !message) {
      return new Response(
        JSON.stringify({ error: "clientId e message são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Fetch client and verify workspace access
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("name, description, identity_guide, workspace_id")
      .eq("id", clientId)
      .single();

    if (clientError || !client) {
      console.error("[kai-simple-chat] Client not found:", clientError);
      return new Response(
        JSON.stringify({ error: "Cliente não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Verify subscription plan via workspace_subscriptions
    const { data: subscription } = await supabase
      .from("workspace_subscriptions")
      .select(`
        status,
        subscription_plans (
          type
        )
      `)
      .eq("workspace_id", client.workspace_id)
      .single();

    const planType = (subscription?.subscription_plans as any)?.type?.toLowerCase() || "starter";
    console.log("[kai-simple-chat] Plan type:", planType);

    if (!ALLOWED_PLANS.includes(planType)) {
      console.log("[kai-simple-chat] Access denied for plan:", planType);
      return new Response(
        JSON.stringify({ error: "O kAI Chat requer o plano Pro ou superior" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Detect intents
    const needsMetrics = isMetricsQuery(message);
    const isReport = isReportRequest(message);
    const needsWebSearch = isWebSearchQuery(message);
    const isSpecificQuery = isSpecificContentQuery(message);
    const imageGenRequest = isImageGenerationRequest(message);
    const comparisonQuery = isComparisonQuery(message);
    const contentCreation = detectContentCreation(message, history);
    const planningIntent = detectPlanningIntent(message, history);

    // 4. Extract date range and metric focus from message
    const dateRange = extractDateRange(message);
    const metricFocus = detectMetricFocus(message);

    console.log("[kai-simple-chat] Intent detection:", { 
      needsMetrics, 
      isReport, 
      needsWebSearch, 
      isSpecificQuery,
      isImageGeneration: imageGenRequest.isRequest,
      isComparison: comparisonQuery.isComparison,
      isContentCreation: contentCreation.isContentCreation,
      detectedFormat: contentCreation.detectedFormat,
      isPlanningRequest: planningIntent.isPlanning,
      planningAction: planningIntent.action,
      planningQuantity: planningIntent.quantity,
      planningPlatform: planningIntent.platform,
      planningMissingInfo: planningIntent.missingInfo,
      dateRange,
      metricFocus 
    });

    // 5. Handle Image Generation Request
    if (imageGenRequest.isRequest) {
      console.log("[kai-simple-chat] Processing image generation request");
      
      const imageResult = await generateImage(imageGenRequest.prompt, client.name);
      
      if (imageResult.error) {
        return new Response(
          JSON.stringify({ error: imageResult.error }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Return image with SSE format
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          const imageResponse = {
            choices: [{
              delta: {
                content: imageResult.text || "Imagem gerada com sucesso! 🎨",
                image: imageResult.imageData,
              }
            }],
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(imageResponse)}\n\n`));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });
      
      return new Response(stream, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
      });
    }

    // 5.5 Handle Planning Card Creation Request
    if (planningIntent.isPlanning) {
      console.log("[kai-simple-chat] Processing planning request:", planningIntent);
      
      // If missing required info, ask for it via AI response
      if (planningIntent.missingInfo.length > 0 && !planningIntent.sourceUrl && !planningIntent.topic) {
        // Generate a response asking for missing info
        const missingInfoPrompt = buildPlanningQuestionPrompt(planningIntent, client.name);
        
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            const response = {
              choices: [{ delta: { content: missingInfoPrompt } }],
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(response)}\n\n`));
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          },
        });
        
        return new Response(stream, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
        });
      }
      
      // All required info available - execute planning
      try {
        const cards = await generatePlanningCards(
          supabase,
          client,
          clientId,
          client.workspace_id,
          user.id,
          planningIntent,
          authHeader
        );
        
        // Build success message
        const successMessage = buildPlanningSuccessMessage(cards, planningIntent);
        
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            const response = {
              choices: [{ delta: { content: successMessage } }],
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(response)}\n\n`));
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          },
        });
        
        return new Response(stream, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
        });
      } catch (planningError) {
        console.error("[kai-simple-chat] Planning error:", planningError);
        const errorMessage = planningError instanceof Error ? planningError.message : "Erro ao criar cards";
        
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            const response = {
              choices: [{ delta: { content: `❌ **Erro ao criar cards:** ${errorMessage}\n\nPor favor, tente novamente.` } }],
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(response)}\n\n`));
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          },
        });
        
        return new Response(stream, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
        });
      }
    }

    // 6. Fetch additional context based on intent
    let metricsContext = "";
    let comparisonContext = "";
    let topPerformersContext = "";
    let formatRulesContext = "";
    let libraryExamplesContext = "";
    let referenceExamplesContext = "";
    
    if (comparisonQuery.isComparison && comparisonQuery.period1 && comparisonQuery.period2) {
      // Fetch comparison context
      comparisonContext = await fetchComparisonContext(
        supabase, 
        clientId, 
        comparisonQuery.period1, 
        comparisonQuery.period2,
        comparisonQuery.period1Label,
        comparisonQuery.period2Label
      );
    } else if (needsMetrics || isReport || isSpecificQuery) {
      metricsContext = await fetchMetricsContext(supabase, clientId, dateRange, metricFocus, isSpecificQuery);
    }
    
    // Fetch content creation context (library examples, references, top performers, format rules)
    if (contentCreation.isContentCreation) {
      console.log("[kai-simple-chat] Content creation detected, fetching context for format:", contentCreation.detectedFormat);
      
      // Fetch all context in parallel for better performance
      const [libraryResult, referenceResult, topPostsResult, formatDocResult] = await Promise.all([
        // 1. Library examples (same format as requested)
        fetchLibraryExamples(supabase, clientId, contentCreation.detectedFormat, 5),
        
        // 2. Reference examples (inspiration)
        fetchReferenceExamples(supabase, clientId, contentCreation.detectedFormat, 3),
        
        // 3. Top performers from Instagram (metrics reference)
        supabase
          .from("instagram_posts")
          .select("caption, post_type, engagement_rate, likes, full_content")
          .eq("client_id", clientId)
          .order("engagement_rate", { ascending: false })
          .limit(5),
        
        // 4. Format rules if specific format detected
        contentCreation.detectedFormat
          ? supabase
              .from("kai_documentation")
              .select("content, checklist")
              .eq("doc_type", "format")
              .eq("doc_key", FORMAT_KEY_MAP[contentCreation.detectedFormat] || contentCreation.detectedFormat)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      
      // Assign results
      libraryExamplesContext = libraryResult;
      referenceExamplesContext = referenceResult;
      
      // Build top performers context
      const topPosts = topPostsResult.data || [];
      if (topPosts.length > 0) {
        topPerformersContext = `\n## 📊 Top Performers Instagram (métricas de referência)\n`;
        topPosts.forEach((post: any, i: number) => {
          const content = post.full_content || post.caption || "";
          topPerformersContext += `\n### Post #${i + 1} (${post.post_type || 'post'}) - ${(post.engagement_rate || 0).toFixed(2)}% engajamento\n`;
          topPerformersContext += `${content.substring(0, 400)}${content.length > 400 ? '...' : ''}\n`;
        });
      }
      
      // Build format rules context - DO NOT include checklist (internal use only)
      if (formatDocResult.data) {
        formatRulesContext = `\n## 📋 Regras do Formato: ${contentCreation.detectedFormat?.toUpperCase()}\n${formatDocResult.data.content}\n`;
        // Note: checklist is intentionally NOT included - it's for internal AI validation only
      }
      
      console.log("[kai-simple-chat] Content creation context loaded:", {
        hasLibraryExamples: !!libraryExamplesContext,
        libraryLength: libraryExamplesContext.length,
        hasReferenceExamples: !!referenceExamplesContext,
        referenceLength: referenceExamplesContext.length,
        topPostsCount: topPosts.length,
        hasFormatRules: !!formatRulesContext,
      });
    }
    
    const [webSearchResult, citedContent] = await Promise.all([
      needsWebSearch ? performWebSearch(message, authHeader) : Promise.resolve(null),
      fetchCitedContent(supabase, citations),
    ]);

    // 7. Build system prompt (lean and focused)
    const identityGuide = client.identity_guide 
      ? client.identity_guide.substring(0, MAX_IDENTITY_GUIDE_LENGTH) 
      : "";

    let systemPrompt = `# REGRAS ABSOLUTAS DE ENTREGA (LEIA PRIMEIRO)

⛔ PROIBIDO INCLUIR NA RESPOSTA:
- "Checklist:", "Observações:", "Notas:", "Dicas:"
- Comentários como "Aqui está...", "Segue...", "Criei para você..."
- Emojis de validação (✅❌)
- Hashtags
- Meta-texto explicando o que você fez

✅ ENTREGUE APENAS: O conteúdo final pronto para publicação.

---

Você é o kAI, um assistente especializado em criação de conteúdo e análise de performance para marcas e criadores.

## Cliente: ${client.name}
${client.description ? `Descrição: ${client.description}` : ""}

${identityGuide ? `## Guia de Identidade\n${identityGuide}` : ""}`;

    // Add comparison context if available
    if (comparisonContext) {
      systemPrompt += `\n${comparisonContext}`;
    }
    
    // Add metrics context if available
    if (metricsContext) {
      systemPrompt += `\n${metricsContext}`;
    }

    // Add web search results if available
    if (webSearchResult) {
      systemPrompt += `\n${webSearchResult}`;
    }

    // Add cited content (manual @mentions - highest priority)
    if (citedContent) {
      systemPrompt += `\n## Materiais Citados pelo Usuário (PRIORIDADE MÁXIMA)\n${citedContent}`;
    }

    // Add library examples context for content creation (auto-fetched)
    if (libraryExamplesContext) {
      systemPrompt += `\n${libraryExamplesContext}`;
    }

    // Add reference examples context for content creation (auto-fetched)
    if (referenceExamplesContext) {
      systemPrompt += `\n${referenceExamplesContext}`;
    }

    // Add top performers context for content creation
    if (topPerformersContext) {
      systemPrompt += `\n${topPerformersContext}`;
    }

    // Add format rules context for content creation
    if (formatRulesContext) {
      systemPrompt += `\n${formatRulesContext}`;
    }

    // Add specific instructions based on intent
    if (contentCreation.isContentCreation) {
      systemPrompt += `

## 🎯 INSTRUÇÕES PARA CRIAÇÃO DE CONTEÚDO
Você está criando conteúdo para o cliente. SIGA RIGOROSAMENTE a ordem de prioridade:

### PRIORIDADE 1: Materiais Citados
Se o usuário citou materiais específicos (@mentions), USE-OS como base principal.

### PRIORIDADE 2: Exemplos da Biblioteca de Conteúdo
REPLIQUE exatamente a estrutura, tom e estilo dos exemplos da biblioteca acima. 
Eles representam o padrão aprovado do cliente.

### PRIORIDADE 3: Referências Salvas
Use as referências como inspiração, mas ADAPTE ao estilo próprio do cliente.

### PRIORIDADE 4: Top Performers Instagram
Use como referência de métricas e abordagens que funcionam.

### REGRAS OBRIGATÓRIAS:
1. **Tom de voz**: EXATAMENTE como definido no Guia de Identidade
2. **Estrutura**: IGUAL aos exemplos da biblioteca (se disponíveis)
3. **Regras do formato**: Siga as regras específicas do formato
4. **Emojis**: ZERO emojis no corpo do texto (apenas CTA final se necessário)
5. **Linguagem**: Verbos de ação, números específicos, fatos concretos
6. **PROIBIDO**: "Entenda", "Aprenda", "Descubra como", "Você sabia que", frases genéricas
7. **USE**: "Você está perdendo", "O segredo é", "Faça isso agora", linguagem direta

### ⚠️ FORMATO DE ENTREGA (CRÍTICO):
ENTREGUE APENAS o conteúdo final. NÃO inclua:
- Checklists de validação
- Seções de "Observações" ou "Notas"
- Explicações sobre o que você fez
- Comentários como "Segue...", "Aqui está...", "Criei para você..."
- Hashtags (são consideradas spam)
- Emojis de checklist (✅❌)

Sua resposta deve conter SOMENTE o conteúdo pronto para publicação.`;
    } else if (comparisonQuery.isComparison) {
      systemPrompt += `

## Instruções para Análise Comparativa
O usuário quer comparar dois períodos. Sua análise deve:
1. **Destacar as principais diferenças** entre os períodos
2. **Identificar tendências** (crescimento/queda) com percentuais
3. **Apontar possíveis causas** das variações observadas
4. **Sugerir ações** baseadas nos insights

Use tabelas markdown para organizar a comparação. Use emojis: 📈 para crescimento, 📉 para queda, ➡️ para estável.`;
    } else if (isReport) {
      systemPrompt += `

## Instruções Especiais para Relatório
O usuário solicitou um relatório de performance. Gere um relatório estruturado com:
1. **Resumo Executivo** (2-3 parágrafos)
2. **Métricas Principais** (use tabelas markdown se possível)
3. **Análise de Tendências** 
4. **Insights e Oportunidades**
5. **Recomendações de Conteúdo** (3-5 ideias específicas)

Use emojis para destacar pontos positivos (📈) e áreas de atenção (⚠️).`;
    } else if (isSpecificQuery) {
      systemPrompt += `

## Instruções para Análise de Conteúdo Específico
O usuário quer informações específicas sobre posts ou conteúdos.
- Use os dados detalhados fornecidos acima para responder com precisão
- Cite números exatos (likes, engajamento, datas)
- Se perguntarem "por que" um post foi bem, analise:
  1. Tema e timing do conteúdo
  2. Estrutura e formato (carrossel, reels, imagem)
  3. Copywriting e gatilhos usados na legenda
  4. Comparação com a média do período
  5. Padrões de engajamento (comments vs likes ratio)
- Ofereça insights acionáveis para replicar o sucesso`;
    } else if (needsMetrics) {
      systemPrompt += `

## Instruções para Análise de Métricas
- Analise os dados disponíveis de forma clara e objetiva
- Identifique padrões e tendências
- Ofereça insights acionáveis
- Se os dados forem insuficientes, seja transparente sobre as limitações`;
    } else {
      systemPrompt += `

## Instruções Gerais
- Sempre siga o tom de voz e estilo do cliente definidos no guia de identidade
- Crie conteúdo original, autêntico e relevante para a audiência do cliente
- Seja direto, prático e objetivo nas respostas
- Se um formato foi citado, siga rigorosamente as regras específicas dele
- Use as referências citadas como base e inspiração quando disponíveis
- Mantenha consistência com a identidade da marca em todas as respostas`;
    }

    // 7. Build messages array - limit history to prevent context overflow
    const limitedHistory = (history || []).slice(-MAX_HISTORY_MESSAGES);
    const apiMessages = [
      { role: "system", content: systemPrompt },
      ...limitedHistory.map(h => ({ role: h.role, content: h.content })),
      { role: "user", content: message },
    ];

    console.log("[kai-simple-chat] Context built:", {
      systemPromptLength: systemPrompt.length,
      historyMessages: limitedHistory.length,
      hasMetricsContext: !!metricsContext,
      hasWebSearch: !!webSearchResult,
      hasCitedContent: !!citedContent,
      hasLibraryExamples: !!libraryExamplesContext,
      libraryExamplesLength: libraryExamplesContext.length,
      hasReferenceExamples: !!referenceExamplesContext,
      referenceExamplesLength: referenceExamplesContext.length,
      hasTopPerformers: !!topPerformersContext,
      hasFormatRules: !!formatRulesContext,
      isContentCreation: contentCreation.isContentCreation,
      detectedFormat: contentCreation.detectedFormat,
    });

    // 8. Call Google Gemini API directly
    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_AI_STUDIO_API_KEY");
    if (!GOOGLE_API_KEY) {
      console.error("[kai-simple-chat] GOOGLE_AI_STUDIO_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Chave de API do Google não configurada. Configure GOOGLE_AI_STUDIO_API_KEY." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[kai-simple-chat] Using Google Gemini API directly");

    // Build Gemini-compatible messages (merge system prompt into first user message)
    // Support for multimodal (images) via inline_data
    const geminiContents = [];
    let systemContent = "";
    let isFirstUserMessage = true;
    
    for (const msg of apiMessages) {
      if (msg.role === "system") {
        systemContent = msg.content;
      } else if (msg.role === "user") {
        // If there's a system prompt, prepend it to first user message
        const userContent = systemContent 
          ? `${systemContent}\n\n---\n\n${msg.content}`
          : msg.content;
        
        // Build parts array with text and optional images
        const parts: any[] = [{ text: userContent }];
        
        // Add images to the first user message if provided
        if (isFirstUserMessage && imageUrls && imageUrls.length > 0) {
          for (const imageUrl of imageUrls) {
            try {
              // Fetch image and convert to base64
              const imageResponse = await fetch(imageUrl);
              if (imageResponse.ok) {
                const imageBuffer = await imageResponse.arrayBuffer();
                const base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));
                const mimeType = imageResponse.headers.get("content-type") || "image/jpeg";
                
                parts.push({
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Image,
                  }
                });
                console.log("[kai-simple-chat] Added image to request:", { mimeType, size: imageBuffer.byteLength });
              }
            } catch (imgErr) {
              console.error("[kai-simple-chat] Error fetching image:", imgErr);
            }
          }
        }
        
        geminiContents.push({
          role: "user",
          parts,
        });
        systemContent = ""; // Clear after first use
        isFirstUserMessage = false;
      } else if (msg.role === "assistant") {
        geminiContents.push({
          role: "model",
          parts: [{ text: msg.content }],
        });
      }
    }

    // Call Gemini with streaming
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?key=${GOOGLE_API_KEY}&alt=sse`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: geminiContents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4096,
          },
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("[kai-simple-chat] Gemini error:", geminiResponse.status, errorText);
      
      if (geminiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Muitas requisições. Aguarde um momento e tente novamente." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (geminiResponse.status === 400) {
        return new Response(
          JSON.stringify({ error: "Mensagem muito longa ou formato inválido." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Erro ao gerar resposta. Tente novamente." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Transform Gemini SSE to OpenAI format
    const reader = geminiResponse.body?.getReader();
    if (!reader) {
      return new Response(
        JSON.stringify({ error: "Resposta vazia do servidor." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const decoder = new TextDecoder();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n");

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6).trim();
              if (!data) continue;

              try {
                const parsed = JSON.parse(data);
                const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) {
                  const openAIFormat = {
                    choices: [{ delta: { content: text } }],
                  };
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(openAIFormat)}\n\n`));
                }
              } catch {
                // Ignore parse errors for incomplete chunks
              }
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (e) {
          console.error("[kai-simple-chat] Stream error:", e);
          controller.error(e);
        }
      },
    });

    console.log("[kai-simple-chat] Streaming response started");
    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });

  } catch (error) {
    console.error("[kai-simple-chat] Unhandled error:", error);
    
    // Provide user-friendly error message
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    const isTimeout = errorMessage.includes("timeout") || errorMessage.includes("TIMEOUT");
    
    return new Response(
      JSON.stringify({ 
        error: isTimeout 
          ? "A requisição expirou. Tente novamente com uma mensagem mais curta."
          : "Erro interno. Por favor, tente novamente."
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ============================================
// HELPER: Fetch cited content
// ============================================

async function fetchCitedContent(
  supabase: any,
  citations?: Citation[]
): Promise<string> {
  if (!citations || citations.length === 0) return "";

  // Process citations in parallel for better performance
  const citationPromises = citations.map(async (citation) => {
    if (citation.type === "content") {
      const { data } = await supabase
        .from("client_content_library")
        .select("title, content, content_type, created_at")
        .eq("id", citation.id)
        .single();
      
      if (data) {
        return {
          type: "content",
          title: data.title,
          content: data.content,
          contentType: data.content_type,
          createdAt: data.created_at,
        };
      }
    } else if (citation.type === "reference") {
      const { data } = await supabase
        .from("client_reference_library")
        .select("title, content, reference_type, created_at")
        .eq("id", citation.id)
        .single();
      
      if (data) {
        return {
          type: "reference",
          title: data.title,
          content: data.content,
          contentType: data.reference_type,
          createdAt: data.created_at,
        };
      }
    } else if (citation.type === "format") {
      const { data } = await supabase
        .from("kai_documentation")
        .select("content, checklist")
        .eq("doc_type", "format")
        .eq("doc_key", citation.title.toLowerCase())
        .single();
      
      if (data) {
        return {
          type: "format",
          title: citation.title,
          content: data.content,
          checklist: data.checklist,
        };
      }
    }
    return null;
  });

  const citationResults = (await Promise.all(citationPromises)).filter(Boolean) as any[];
  
  // Sort by recency (most recent first) and build content
  citationResults.sort((a, b) => {
    if (a?.createdAt && b?.createdAt) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    return 0;
  });

  let citedContent = "";
  for (const cit of citationResults) {
    if (!cit) continue;
    
    if (cit.type === "format") {
      citedContent += `\n### Regras do formato ${cit.title}:\n${cit.content}\n`;
      if (cit.checklist) {
        citedContent += `\nChecklist:\n${JSON.stringify(cit.checklist)}\n`;
      }
    } else {
      const label = cit.type === "content" ? "Referência" : "Referência externa";
      citedContent += `\n### ${label}: ${cit.title} (${cit.contentType})\n${cit.content}\n`;
    }
    
    // Stop if we've exceeded the limit
    if (citedContent.length >= MAX_CITED_CONTENT_LENGTH) {
      citedContent = citedContent.substring(0, MAX_CITED_CONTENT_LENGTH) + "\n[...conteúdo truncado]";
      break;
    }
  }

  return citedContent;
}
