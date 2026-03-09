import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { 
  FORMAT_KEY_MAP,
  CONTENT_TYPE_MAP,
  CONTENT_FORMAT_KEYWORDS,
  detectFormatFromKeywords 
} from "../_shared/format-constants.ts";
import { getFormatRules } from "../_shared/format-rules.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Constantes
const MAX_IDENTITY_GUIDE_LENGTH = 8000;
const MAX_CITED_CONTENT_LENGTH = 12000;
const MAX_HISTORY_MESSAGES = 15;
const MAX_METRICS_CONTEXT_LENGTH = 8000;

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
  materialContext?: string;
  materialTitle?: string;
  conversationId?: string;
}

// User instructions that override default behaviors
interface UserInstructions {
  skipImages: boolean;
  useOnlyUrl: boolean;
  noEmojis: boolean;
  useCoverImage: boolean;
}

/**
 * Detect explicit user instructions that should override default behaviors
 */
function detectUserInstructions(message: string): UserInstructions {
  const lowerMessage = message.toLowerCase();
  
  return {
    skipImages: /sem\s*(imagens?|m[ií]dia)|apenas\s*texto|s[oó]\s*texto|n[aã]o\s*use\s*imagem/i.test(lowerMessage),
    useOnlyUrl: /s[oó]\s*(a\s*)?url|apenas\s*(a\s*)?(url|link)|somente\s*(a\s*)?(url|link)/i.test(lowerMessage),
    noEmojis: /sem\s*emoji|zero\s*emoji|n[aã]o\s*use\s*emoji|nenhum\s*emoji/i.test(lowerMessage),
    useCoverImage: /(usar?|com|inclua?)\s*capa|apenas\s*(a\s*)?capa|só\s*(a\s*)?capa/i.test(lowerMessage),
  };
}

function buildUserInstructionsPrompt(instructions: UserInstructions): string {
  const lines: string[] = [];
  if (instructions.skipImages) lines.push("⛔ INSTRUÇÃO DO USUÁRIO (PRIORIDADE MÁXIMA): NÃO inclua nem sugira imagens. Gere APENAS texto.");
  if (instructions.noEmojis) lines.push("⛔ INSTRUÇÃO DO USUÁRIO (PRIORIDADE MÁXIMA): ZERO emojis no conteúdo. Nem mesmo no CTA final.");
  if (instructions.useOnlyUrl) lines.push("⛔ INSTRUÇÃO DO USUÁRIO (PRIORIDADE MÁXIMA): Use APENAS a URL do conteúdo, sem imagem.");
  if (instructions.useCoverImage) lines.push("⛔ INSTRUÇÃO DO USUÁRIO (PRIORIDADE MÁXIMA): Use apenas a imagem de capa, sem outras imagens.");
  return lines.length > 0 ? `\n${lines.join("\n")}\n` : "";
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
    /m[eé]trica/i, /performance/i, /estat[ií]stica/i, /engajamento/i,
    /seguidores/i, /crescimento/i, /alcance/i, /impress[oõ]es/i,
    /visualiza[cç][oõ]es/i, /likes/i, /curtidas?/i, /coment[aá]rios/i,
    /compartilhamentos/i, /views/i, /inscritos/i, /subscribers/i,
    /analytics/i, /relat[oó]rio/i, /report/i, /dados\s+(do|da|de)/i,
    /como\s+(est[aá]|foi|anda)/i, /resultado/i, /melhor\s+post/i,
    /top\s*\d*/i, /ranking/i, /m[eé]dia\s+(de|do|da)/i,
    /total\s+(de|do|da)/i, /quantos?/i, /instagram/i,
    /youtube/i, /linkedin/i, /twitter/i,
  ];
  return patterns.some(p => p.test(message));
}

function isReportRequest(message: string): boolean {
  const patterns = [
    /gerar?\s+relat[oó]rio/i, /criar?\s+relat[oó]rio/i, /fazer?\s+relat[oó]rio/i,
    /an[aá]lise\s+completa/i, /report\s+completo/i,
    /relat[oó]rio\s+de\s+performance/i, /relat[oó]rio\s+de\s+m[eé]tricas/i,
    /resumo\s+de\s+performance/i, /overview\s+completo/i,
  ];
  return patterns.some(p => p.test(message));
}

function isWebSearchQuery(message: string): boolean {
  const patterns = [
    /pesquise?\s+(sobre|por)/i, /busque?\s+(sobre|por)/i, /procure?\s+(sobre|por)/i,
    /o\s+que\s+[eé]/i, /quem\s+[eé]/i, /not[ií]cias\s+(sobre|de)/i,
    /tend[eê]ncias?\s+(de|em|sobre)/i, /atualiza[cç][oõ]es?\s+(sobre|de)/i,
    /me\s+conte\s+sobre/i, /me\s+fale\s+sobre/i,
  ];
  return patterns.some(p => p.test(message));
}

function isSpecificContentQuery(message: string): boolean {
  const patterns = [
    /qual\s+(foi\s+)?(o\s+)?(melhor|pior|maior|menor)/i,
    /qual\s+([eé]|a)\s+m[eé]dia/i,
    /post\s+(com\s+)?(mais|menos)/i, /top\s*\d*/i, /ranking/i,
    /conte[uú]do\s+que\s+(mais|menos)/i, /melhor(es)?\s+post/i,
    /pior(es)?\s+post/i, /post\s+mais\s+curtido/i,
    /maior\s+engajamento/i,
    /mais\s+(likes|curtidas?|coment[aá]rios|compartilhamentos|saves|alcance)/i,
    /quantos?\s+(likes|curtidas?|posts|coment[aá]rios)/i,
    /m[eé]dia\s+(de|do|da)\s+(likes|curtidas?|coment[aá]rios|engajamento)/i,
    /por\s*que\s+(esse|este|aquele)\s+post/i,
    /analise?\s+(esse|este|o)\s+post/i,
  ];
  return patterns.some(p => p.test(message));
}

// ============================================
// PLANNING INTENT DETECTION
// ============================================

function isPlanningReadQuery(message: string): boolean {
  const patterns = [
    /o\s+que\s+(temos?|tem)\s+(agendado|programado|planejado|pendente)/i,
    /planejamento\s+(da|desta|dessa)\s+semana/i,
    /planejamento\s+(do|deste|desse)\s+mês/i,
    /quais?\s+(posts?|conte[uú]dos?)\s+(est[aã]o|temos?)\s+(agendados?|programados?|pendentes?)/i,
    /quantos?\s+(posts?|cards?|conte[uú]dos?)\s+(temos?|tem|est[aã]o)/i,
    /o\s+que\s+(falta|precisa)\s+(publicar|postar)/i,
    /mostre?\s+(o\s+)?planejamento/i,
    /cards?\s+(pendentes?|agendados?|atrasados?)/i,
    /o\s+que\s+est[aá]\s+(atrasado|pendente|agendado)/i,
    /pr[oó]xim(os?|as?)\s+(posts?|publica[cç][oõ]es?)/i,
    /calend[aá]rio\s+(de|do)\s+conte[uú]do/i,
  ];
  return patterns.some(p => p.test(message));
}

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
  analyzeFirst?: boolean;
  analyzeSource?: "youtube" | "instagram" | "linkedin" | "all";
}

function getPlatformEmoji(platform: string): string {
  const emojis: Record<string, string> = {
    instagram: "📸", twitter: "🐦", linkedin: "💼",
    youtube: "🎬", newsletter: "📧", tiktok: "🎵",
  };
  return emojis[platform?.toLowerCase()] || "📱";
}

function detectPlanningIntentFromContext(message: string, history?: HistoryMessage[]): PlanningIntent | null {
  if (!history || history.length === 0) return null;
  const lastAssistant = history.filter(h => h.role === "assistant").pop();
  if (!lastAssistant) return null;
  
  const wasPlanningQuestion = 
    lastAssistant.content.includes("Para qual plataforma") ||
    lastAssistant.content.includes("Para qual data") ||
    lastAssistant.content.includes("Sobre qual tema") ||
    lastAssistant.content.includes("qual rede social") ||
    lastAssistant.content.includes("quando você gostaria");
  
  if (!wasPlanningQuestion) return null;
  
  const lowerMessage = message.toLowerCase().trim();
  const result: PlanningIntent = {
    isPlanning: true, action: "create", quantity: 1,
    platform: null, specificDate: null, sourceUrl: null,
    topic: null, missingInfo: [], isFollowUp: true,
  };
  
  const platforms: Record<string, string> = {
    'instagram': 'instagram', 'insta': 'instagram', 'twitter': 'twitter',
    'x': 'twitter', 'linkedin': 'linkedin', 'youtube': 'youtube',
    'newsletter': 'newsletter', 'tiktok': 'tiktok',
  };
  
  for (const [keyword, platform] of Object.entries(platforms)) {
    if (lowerMessage.includes(keyword)) { result.platform = platform; break; }
  }
  
  const dateMatch = lowerMessage.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{4}))?/);
  if (dateMatch) {
    const day = dateMatch[1].padStart(2, '0');
    const month = dateMatch[2].padStart(2, '0');
    const year = dateMatch[3] || new Date().getFullYear().toString();
    result.specificDate = `${year}-${month}-${day}`;
  } else if (/amanh[ãa]/i.test(lowerMessage)) {
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    result.specificDate = tomorrow.toISOString().split('T')[0];
  } else if (/hoje/i.test(lowerMessage)) {
    result.specificDate = new Date().toISOString().split('T')[0];
  }
  
  let topic = message
    .replace(/instagram|twitter|linkedin|youtube|tiktok|newsletter/gi, '')
    .replace(/\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{4})?/g, '')
    .replace(/amanh[ãa]|hoje/gi, '')
    .replace(/sobre|para|no|na/gi, '')
    .trim();
  if (topic.length > 3) result.topic = topic;
  
  if (result.platform || result.specificDate || result.topic) return result;
  return null;
}

function detectPlanningIntent(message: string, history?: HistoryMessage[]): PlanningIntent {
  const contextIntent = detectPlanningIntentFromContext(message, history);
  if (contextIntent) return contextIntent;
  
  const lowerMessage = message.toLowerCase();
  const result: PlanningIntent = {
    isPlanning: false, action: null, quantity: 1,
    platform: null, specificDate: null, sourceUrl: null,
    topic: null, missingInfo: [],
  };
  
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

  // Composite patterns: analyze metrics THEN create cards
  const analyzeAndPlanPatterns = [
    /analis[ea].*(?:e\s+)?(?:cri[ea]|sub[ea]|coloca|adiciona|gera|monta).*(?:planejamento|cards?|temas?)/i,
    /(?:com\s+base|baseado)\s+(?:nos?|nas?)\s+(?:melhores?|top|dados).*(?:cri[ea]|sub[ea]|gera|monta).*(?:planejamento|cards?|temas?)/i,
    /(?:cri[ea]|gera|monta|sub[ea]).*(?:temas?|cards?|conte[uú]dos?).*(?:com\s+base|baseado|a\s+partir).*(?:an[aá]lise|melhores?|performance|m[eé]tricas?)/i,
    /(?:sugir[ea]|proponha).*temas?.*(?:e\s+)?(?:adiciona|suba|coloca).*planejamento/i,
    /analis[ea].*(?:melhores?|top).*(?:conte[uú]dos?|v[ií]deos?|posts?).*(?:e\s+)?(?:cri[ea]|gera).*(?:novos?|temas?|cards?)/i,
  ];
  
  for (const pattern of planningPatterns) {
    if (pattern.test(lowerMessage)) { result.isPlanning = true; break; }
  }

  // Check composite analyze+plan patterns
  if (!result.isPlanning) {
    for (const pattern of analyzeAndPlanPatterns) {
      if (pattern.test(lowerMessage)) {
        result.isPlanning = true;
        result.analyzeFirst = true;
        break;
      }
    }
  }

  // Detect analyzeFirst even when planning was already detected
  if (result.isPlanning && !result.analyzeFirst) {
    const hasAnalyzeKeywords = /analis[ea]|com\s+base|baseado|melhores?|top\s+\d*\s*(conte[uú]dos?|v[ií]deos?|posts?)|performance|m[eé]tricas?/i.test(lowerMessage);
    if (hasAnalyzeKeywords) result.analyzeFirst = true;
  }

  // Detect analyze source platform
  if (result.analyzeFirst) {
    if (/youtube|v[ií]deos?/i.test(lowerMessage)) result.analyzeSource = "youtube";
    else if (/instagram|insta|posts?\s+do\s+insta/i.test(lowerMessage)) result.analyzeSource = "instagram";
    else if (/linkedin/i.test(lowerMessage)) result.analyzeSource = "linkedin";
    else result.analyzeSource = "all";
  }

  if (!result.isPlanning) return result;
  
  if (/distribu(ir|a)|ao\s+longo|semana/i.test(lowerMessage)) result.action = "distribute";
  else if (/agendar|programar|para\s+(o\s+)?(dia|data)/i.test(lowerMessage)) result.action = "schedule";
  else result.action = "create";
  
  const quantityMatch = lowerMessage.match(/(\d+)\s*(cards?|posts?|tweets?|conte[uú]dos?|carross[eé]is?|reels?)/i);
  if (quantityMatch) result.quantity = parseInt(quantityMatch[1]);
  
  const platforms: Record<string, string> = {
    'instagram': 'instagram', 'insta': 'instagram', 'twitter': 'twitter',
    'x': 'twitter', 'tweet': 'twitter', 'linkedin': 'linkedin',
    'youtube': 'youtube', 'newsletter': 'newsletter', 'tiktok': 'tiktok',
  };
  for (const [keyword, platform] of Object.entries(platforms)) {
    if (lowerMessage.includes(keyword)) { result.platform = platform; break; }
  }
  
  const urlMatch = message.match(/https?:\/\/[^\s]+/);
  if (urlMatch) result.sourceUrl = urlMatch[0];
  
  const dateMatch = lowerMessage.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dateMatch) {
    const [, day, month, year] = dateMatch;
    result.specificDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  if (/amanh[ãa]/i.test(lowerMessage)) {
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    result.specificDate = tomorrow.toISOString().split('T')[0];
  } else if (/hoje/i.test(lowerMessage)) {
    result.specificDate = new Date().toISOString().split('T')[0];
  }
  
  const weekdays: Record<string, number> = {
    'domingo': 0, 'segunda': 1, 'terça': 2, 'terca': 2,
    'quarta': 3, 'quinta': 4, 'sexta': 5, 'sábado': 6, 'sabado': 6
  };
  for (const [day, num] of Object.entries(weekdays)) {
    if (lowerMessage.includes(day)) {
      const now = new Date();
      let daysToAdd = num - now.getDay();
      if (daysToAdd <= 0) daysToAdd += 7;
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + daysToAdd);
      result.specificDate = targetDate.toISOString().split('T')[0];
      break;
    }
  }
  
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
  if (topic.length > 10) result.topic = topic;
  
  if (!result.platform) result.missingInfo.push("plataforma");
  if (!result.specificDate && result.action === "schedule") result.missingInfo.push("data");
  
  return result;
}

// ============================================
// CONTENT CREATION DETECTION
// ============================================

const contentFormats = CONTENT_FORMAT_KEYWORDS;

interface ContentCreationResult {
  isContentCreation: boolean;
  detectedFormat: string | null;
}

function detectImplicitFormat(message: string, history?: HistoryMessage[]): string | null {
  if (!history || history.length === 0) return null;
  const recentHistory = history.slice(-5);
  for (const msg of recentHistory.reverse()) {
    const content = msg.content.toLowerCase();
    for (const [format, keywords] of Object.entries(contentFormats)) {
      if (keywords.some(k => content.includes(k))) return format;
    }
  }
  return null;
}

function detectContentCreation(message: string, history?: HistoryMessage[]): ContentCreationResult {
  const lowerMessage = message.toLowerCase();
  const creationPatterns = [
    /cri(e|ar|a|ando)/i, /fa(ça|zer|z|zendo)/i, /gere?(ar)?/i,
    /escrev(a|er|endo)/i, /elabor(e|ar|ando)/i, /mont(e|ar|ando)/i,
    /produz(a|ir|indo)/i, /desenvolv(a|er|endo)/i, /prepara?(r)?/i,
  ];
  
  const hasCreationIntent = creationPatterns.some(p => p.test(lowerMessage));
  if (!hasCreationIntent) return { isContentCreation: false, detectedFormat: null };
  
  for (const [format, keywords] of Object.entries(contentFormats)) {
    if (keywords.some(k => lowerMessage.includes(k))) return { isContentCreation: true, detectedFormat: format };
  }
  
  if (/conte[uú]do|conteudo|texto|copy/i.test(lowerMessage)) {
    const implicitFormat = detectImplicitFormat(message, history);
    return { isContentCreation: true, detectedFormat: implicitFormat };
  }
  
  return { isContentCreation: false, detectedFormat: null };
}

// ============================================
// AUTOMATIC CONTEXT FETCHING
// ============================================

const MAX_LIBRARY_EXAMPLE_LENGTH = 1500;
const MAX_REFERENCE_LENGTH = 1000;

async function fetchLibraryExamples(
  supabase: any, clientId: string, contentType: string | null, limit: number = 5
): Promise<string> {
  const dbContentType = contentType ? CONTENT_TYPE_MAP[contentType] : null;
  let examples: any[] = [];
  
  if (dbContentType) {
    const { data: favoriteExamples } = await supabase
      .from("client_content_library")
      .select("id, title, content, content_type, is_favorite, metadata, created_at")
      .eq("client_id", clientId).eq("content_type", dbContentType).eq("is_favorite", true)
      .order("created_at", { ascending: false }).limit(3);
    if (favoriteExamples?.length > 0) examples = favoriteExamples;
  }
  
  if (examples.length < 3) {
    const existingIds = examples.map(e => e.id);
    let query = supabase.from("client_content_library")
      .select("id, title, content, content_type, is_favorite, metadata, created_at")
      .eq("client_id", clientId).eq("is_favorite", true)
      .order("created_at", { ascending: false }).limit(3 - examples.length);
    if (existingIds.length > 0) query = query.not("id", "in", `(${existingIds.join(",")})`);
    const { data: moreFavorites } = await query;
    if (moreFavorites?.length > 0) examples = [...examples, ...moreFavorites];
  }
  
  if (examples.length < limit && dbContentType) {
    const existingIds = examples.map(e => e.id);
    let query = supabase.from("client_content_library")
      .select("id, title, content, content_type, is_favorite, metadata, created_at")
      .eq("client_id", clientId).eq("content_type", dbContentType)
      .order("created_at", { ascending: false }).limit(limit - examples.length);
    if (existingIds.length > 0) query = query.not("id", "in", `(${existingIds.join(",")})`);
    const { data: recentExamples } = await query;
    if (recentExamples?.length > 0) examples = [...examples, ...recentExamples];
  }
  
  if (examples.length < 2) {
    const existingIds = examples.map(e => e.id);
    let query = supabase.from("client_content_library")
      .select("id, title, content, content_type, is_favorite, metadata, created_at")
      .eq("client_id", clientId).order("created_at", { ascending: false }).limit(3);
    if (existingIds.length > 0) query = query.not("id", "in", `(${existingIds.join(",")})`);
    const { data: fallbackExamples } = await query;
    if (fallbackExamples?.length > 0) examples = [...examples, ...fallbackExamples];
  }
  
  if (examples.length === 0) return "";
  
  examples = await enrichWithMetrics(supabase, clientId, examples);
  
  let context = `\n## 📚 Exemplos da Biblioteca de Conteúdo (SIGA ESTE ESTILO E ESTRUTURA)\n`;
  context += `*Estes são conteúdos reais do cliente. REPLIQUE o tom, estrutura e abordagem.*\n`;
  
  examples.forEach((ex: any, i: number) => {
    const favIcon = ex.is_favorite ? "⭐ " : "";
    const metricsLabel = ex.engagement_rate 
      ? ` [📈 ${ex.engagement_rate.toFixed(2)}% engajamento]`
      : ex.likes ? ` [${ex.likes} likes]` : "";
    const truncatedContent = ex.content?.substring(0, MAX_LIBRARY_EXAMPLE_LENGTH) || "";
    const ellipsis = ex.content?.length > MAX_LIBRARY_EXAMPLE_LENGTH ? "..." : "";
    context += `\n### ${favIcon}Exemplo ${i + 1}: ${ex.title} (${ex.content_type})${metricsLabel}\n`;
    context += `${truncatedContent}${ellipsis}\n`;
  });
  
  return context;
}

async function enrichWithMetrics(supabase: any, clientId: string, examples: any[]): Promise<any[]> {
  if (examples.length === 0) return examples;
  
  const { data: instaPosts } = await supabase
    .from("instagram_posts")
    .select("caption, full_content, engagement_rate, likes, posted_at")
    .eq("client_id", clientId)
    .order("engagement_rate", { ascending: false, nullsFirst: false })
    .limit(30);
  
  if (!instaPosts || instaPosts.length === 0) return examples;
  
  return examples.map(ex => {
    const exTitle = (ex.title || "").toLowerCase().substring(0, 40);
    const exContent = (ex.content || "").toLowerCase().substring(0, 100);
    
    const matchingPost = instaPosts.find((p: any) => {
      const caption = (p.caption || "").toLowerCase();
      const fullContent = (p.full_content || "").toLowerCase();
      if (exTitle.length > 10 && (caption.includes(exTitle) || fullContent.includes(exTitle))) return true;
      if (exContent.length > 30) {
        const contentSample = exContent.substring(0, 50);
        if (caption.includes(contentSample) || fullContent.includes(contentSample)) return true;
      }
      return false;
    });
    
    return matchingPost ? { ...ex, engagement_rate: matchingPost.engagement_rate, likes: matchingPost.likes } : ex;
  });
}

async function fetchReferenceExamples(
  supabase: any, clientId: string, referenceType: string | null, limit: number = 3
): Promise<string> {
  const dbReferenceType = referenceType ? CONTENT_TYPE_MAP[referenceType] : null;
  
  let query = supabase.from("client_reference_library")
    .select("title, content, reference_type, source_url")
    .eq("client_id", clientId).order("created_at", { ascending: false });
  if (dbReferenceType) query = query.eq("reference_type", dbReferenceType);
  
  const { data: refs, error } = await query.limit(limit);
  
  if (error || !refs || refs.length === 0) {
    if (dbReferenceType) {
      const { data: fallbackRefs } = await supabase.from("client_reference_library")
        .select("title, content, reference_type, source_url")
        .eq("client_id", clientId).order("created_at", { ascending: false }).limit(2);
      if (fallbackRefs?.length > 0) {
        let context = `\n## 🎯 Referências Salvas (inspiração e benchmarks)\n`;
        fallbackRefs.forEach((ref: any, i: number) => {
          const truncatedContent = ref.content?.substring(0, MAX_REFERENCE_LENGTH) || "";
          context += `\n### Referência ${i + 1}: ${ref.title}\n${truncatedContent}\n`;
          if (ref.source_url) context += `Fonte: ${ref.source_url}\n`;
        });
        return context;
      }
    }
    return "";
  }
  
  let context = `\n## 🎯 Referências do Cliente (inspiração e benchmarks)\n`;
  refs.forEach((ref: any, i: number) => {
    const truncatedContent = ref.content?.substring(0, MAX_REFERENCE_LENGTH) || "";
    context += `\n### Referência ${i + 1}: ${ref.title} (${ref.reference_type})\n${truncatedContent}\n`;
    if (ref.source_url) context += `Fonte: ${ref.source_url}\n`;
  });
  return context;
}

// ============================================
// IMAGE GENERATION DETECTION
// ============================================

interface ImageGenerationResult { isRequest: boolean; prompt: string; }

function isImageGenerationRequest(message: string): ImageGenerationResult {
  const patterns = [
    /gera(r|ndo)?\s*(uma?)?\s*imagem/i, /cria(r|ndo)?\s*(uma?)?\s*imagem/i,
    /@imagem\s*/i, /fazer?\s*(uma?)?\s*(arte|visual|imagem)/i,
    /crie?\s*(uma?)?\s*foto/i, /desenhar?\s*(uma?)?/i, /ilustra[cç][aã]o/i,
  ];
  for (const pattern of patterns) {
    if (pattern.test(message)) {
      const prompt = message.replace(pattern, "").replace(/^[\s:,]+/, "").trim() || message;
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
  period1: DateRange | null; period2: DateRange | null;
  period1Label: string; period2Label: string;
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
      let period1Str = "", period2Str = "";
      if (pattern.source.includes("entre")) { period1Str = match[1]; period2Str = match[2]; }
      else if (pattern.source.includes("compare")) { period1Str = match[1]; period2Str = match[3]; }
      else if (pattern.source.includes("compara")) { period1Str = match[1]; period2Str = match[3]; }
      else { period1Str = match[1]; period2Str = match[2]; }
      
      const period1 = extractDateRangeFromText(period1Str);
      const period2 = extractDateRangeFromText(period2Str);
      if (period1 && period2) {
        return { isComparison: true, period1, period2, period1Label: period1Str.trim(), period2Label: period2Str.trim() };
      }
    }
  }
  return { isComparison: false, period1: null, period2: null, period1Label: "", period2Label: "" };
}

const MONTH_MAP: Record<string, number> = {
  janeiro: 0, jan: 0, fevereiro: 1, fev: 1, março: 2, marco: 2, mar: 2,
  abril: 3, abr: 3, maio: 4, mai: 4, junho: 5, jun: 5, julho: 6, jul: 6,
  agosto: 7, ago: 7, setembro: 8, set: 8, outubro: 9, out: 9,
  novembro: 10, nov: 10, dezembro: 11, dez: 11,
};

function extractDateRangeFromText(text: string): DateRange | null {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  
  for (const [monthName, monthNum] of Object.entries(MONTH_MAP)) {
    if (text.toLowerCase().includes(monthName)) {
      const yearMatch = text.match(/20(2[4-9]|3[0-9])/);
      const year = yearMatch ? parseInt(yearMatch[0]) : (monthNum > currentMonth ? currentYear - 1 : currentYear);
      const start = new Date(year, monthNum, 1);
      const end = new Date(year, monthNum + 1, 0);
      return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
    }
  }
  
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

function extractDateRange(message: string): DateRange | null {
  const lowerMessage = message.toLowerCase();
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  const monthYearPattern = /(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\s*(de\s*|\/)?(\d{4})/i;
  const monthYearMatch = lowerMessage.match(monthYearPattern);
  if (monthYearMatch) {
    const month = MONTH_MAP[monthYearMatch[1].toLowerCase()];
    const year = parseInt(monthYearMatch[3]);
    if (month !== undefined) {
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0);
      return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
    }
  }

  const monthOnlyPattern = /\b(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\b/i;
  const monthOnlyMatch = lowerMessage.match(monthOnlyPattern);
  if (monthOnlyMatch && !monthYearMatch) {
    const month = MONTH_MAP[monthOnlyMatch[1].toLowerCase()];
    if (month !== undefined) {
      const year = month > currentMonth ? currentYear - 1 : currentYear;
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0);
      return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
    }
  }

  if (/mês\s+passado|último\s+mês|mes\s+passado/i.test(lowerMessage)) {
    const start = new Date(currentYear, currentMonth - 1, 1);
    const end = new Date(currentYear, currentMonth, 0);
    return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
  }
  if (/este\s+mês|esse\s+mês|mês\s+atual/i.test(lowerMessage)) {
    const start = new Date(currentYear, currentMonth, 1);
    const end = new Date(currentYear, currentMonth + 1, 0);
    return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
  }
  if (/últim(os|as)\s+(\d+)\s*(dias|semanas)/i.test(lowerMessage)) {
    const match = lowerMessage.match(/últim(os|as)\s+(\d+)\s*(dias|semanas)/i);
    if (match) {
      const num = parseInt(match[2]);
      const daysBack = match[3].toLowerCase() === 'semanas' ? num * 7 : num;
      const start = new Date(); start.setDate(start.getDate() - daysBack);
      return { start: start.toISOString().split('T')[0], end: currentDate.toISOString().split('T')[0] };
    }
  }
  const yearPattern = /\b(em\s+)?20(2[4-9]|3[0-9])\b/;
  const yearMatch = lowerMessage.match(yearPattern);
  if (yearMatch && !monthYearMatch) {
    const year = parseInt(yearMatch[0].replace(/em\s+/, ''));
    return { start: `${year}-01-01`, end: `${year}-12-31` };
  }
  return null;
}

function detectMetricFocus(message: string): MetricFocus {
  const lowerMessage = message.toLowerCase();
  if (/engajamento|engagement|taxa\s+de\s+engajamento/i.test(lowerMessage)) return 'engagement';
  if (/alcance|reach/i.test(lowerMessage)) return 'reach';
  if (/coment[aá]rios?|comments?/i.test(lowerMessage)) return 'comments';
  if (/saves?|salvos?|salvamentos?/i.test(lowerMessage)) return 'saves';
  if (/compartilhamentos?|shares?/i.test(lowerMessage)) return 'shares';
  return 'likes';
}

// ============================================
// DETECT PLATFORM FROM MESSAGE
// ============================================

function detectPlatformFromMessage(message: string): string | null {
  const lowerMessage = message.toLowerCase();
  if (/twitter|tweet|x\s|no\sx\b/i.test(lowerMessage)) return 'twitter';
  if (/linkedin/i.test(lowerMessage)) return 'linkedin';
  if (/youtube/i.test(lowerMessage)) return 'youtube';
  if (/instagram|insta/i.test(lowerMessage)) return 'instagram';
  return null;
}

// ============================================
// MULTI-PLATFORM METRICS CONTEXT BUILDER
// ============================================

async function fetchMetricsContext(
  supabase: any, clientId: string,
  dateRange?: DateRange | null, metricFocus?: MetricFocus, isSpecificQuery?: boolean
): Promise<string> {
  const queryStart = dateRange?.start || (() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  })();
  const queryEnd = dateRange?.end || new Date().toISOString().split("T")[0];

  const orderColumn = metricFocus === 'engagement' ? 'engagement_rate' :
                      metricFocus === 'reach' ? 'reach' :
                      metricFocus === 'comments' ? 'comments' :
                      metricFocus === 'saves' ? 'saves' :
                      metricFocus === 'shares' ? 'shares' : 'likes';

  const postsLimit = isSpecificQuery ? 10 : 20;

  // Fetch all platforms in parallel
  const [metricsResult, instaResult, twitterResult, linkedinResult, youtubeResult] = await Promise.all([
    supabase.from("platform_metrics").select("*")
      .eq("client_id", clientId)
      .gte("metric_date", queryStart).lte("metric_date", queryEnd)
      .order("metric_date", { ascending: false }).limit(60),
    supabase.from("instagram_posts")
      .select("id, caption, full_content, video_transcript, likes, comments, saves, shares, reach, impressions, engagement_rate, posted_at, post_type, permalink")
      .eq("client_id", clientId)
      .gte("posted_at", queryStart).lte("posted_at", queryEnd + "T23:59:59Z")
      .order(orderColumn, { ascending: false, nullsFirst: false }).limit(postsLimit),
    supabase.from("linkedin_posts")
      .select("id, content, full_content, likes, comments, shares, impressions, engagement_rate, posted_at, post_url")
      .eq("client_id", clientId)
      .gte("posted_at", queryStart).lte("posted_at", queryEnd + "T23:59:59Z")
      .order("likes", { ascending: false, nullsFirst: false }).limit(postsLimit),
    // Note: twitter_posts table may not exist yet, handle gracefully
    supabase.from("engagement_opportunities")
      .select("tweet_text, tweet_metrics, tweet_created_at, author_username, status")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false }).limit(10),
    supabase.from("youtube_videos")
      .select("id, title, total_views, likes, comments, published_at, duration_seconds, impressions, click_rate, subscribers_gained, watch_hours, transcript")
      .eq("client_id", clientId)
      .order("total_views", { ascending: false, nullsFirst: false }).limit(postsLimit),
  ]);

  const metrics: any[] = metricsResult.data || [];
  const instaPosts: any[] = instaResult.data || [];
  const linkedinPosts: any[] = linkedinResult.data || [];
  const twitterData: any[] = twitterResult.data || [];
  const youtubeVideos: any[] = youtubeResult.data || [];

  if (metrics.length === 0 && instaPosts.length === 0 && linkedinPosts.length === 0 && youtubeVideos.length === 0) {
    return `\n## Dados de Performance\nNenhum dado encontrado para o período de ${queryStart} a ${queryEnd}.\n`;
  }

  const periodLabel = dateRange 
    ? `${formatDateBR(queryStart)} a ${formatDateBR(queryEnd)}`
    : "Últimos 30 dias";

  let context = `\n## Dados de Performance do Cliente (${periodLabel})\n`;

  // Platform metrics summary
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

  // Instagram posts
  if (instaPosts.length > 0) {
    const avgLikes = instaPosts.reduce((sum: number, p: any) => sum + (p.likes || 0), 0) / instaPosts.length;
    const avgEngagement = instaPosts.reduce((sum: number, p: any) => sum + (p.engagement_rate || 0), 0) / instaPosts.length;

    context += `\n### Posts do Instagram (${instaPosts.length} posts)\n`;
    context += `**Médias:** ${Math.round(avgLikes).toLocaleString('pt-BR')} likes | ${avgEngagement.toFixed(2)}% eng\n`;

    if (isSpecificQuery) {
      const metricLabel = metricFocus === 'engagement' ? 'Engajamento' :
                         metricFocus === 'reach' ? 'Alcance' :
                         metricFocus === 'comments' ? 'Comentários' :
                         metricFocus === 'saves' ? 'Salvamentos' :
                         metricFocus === 'shares' ? 'Compartilhamentos' : 'Likes';
      context += `\n**Ranking por ${metricLabel}:**\n`;
      instaPosts.forEach((p: any, i: number) => {
        const metricValue = metricFocus === 'engagement' ? p.engagement_rate?.toFixed(2) + '%' :
                           metricFocus === 'reach' ? (p.reach || 0).toLocaleString('pt-BR') :
                           metricFocus === 'comments' ? (p.comments || 0).toString() :
                           metricFocus === 'saves' ? (p.saves || 0).toString() :
                           metricFocus === 'shares' ? (p.shares || 0).toString() :
                           (p.likes || 0).toLocaleString('pt-BR');
        const postDate = p.posted_at ? formatDateBR(p.posted_at.split('T')[0]) : '';
        const fullContent = p.full_content || p.caption || 'Sem legenda';
        const caption = i < 3 ? fullContent : fullContent.substring(0, 100) + (fullContent.length > 100 ? '...' : '');
        context += `\n**#${i + 1} - ${metricValue}** (${postDate})\n`;
        context += `Likes: ${(p.likes || 0).toLocaleString('pt-BR')} | Comments: ${p.comments || 0} | Eng: ${p.engagement_rate?.toFixed(2) || 0}%\n`;
        context += `Conteúdo: ${caption}\n`;
        if (p.video_transcript && i < 3) context += `Transcrição: ${p.video_transcript.substring(0, 500)}\n`;
        if (p.permalink) context += `Link: ${p.permalink}\n`;
      });
    } else {
      context += `\n**Top 5 por Likes:**\n`;
      instaPosts.slice(0, 5).forEach((p: any, i: number) => {
        const caption = p.caption?.substring(0, 80) || "Sem legenda";
        const postDate = p.posted_at ? formatDateBR(p.posted_at.split('T')[0]) : '';
        context += `${i + 1}. ${caption}${p.caption?.length > 80 ? '...' : ''}\n`;
        context += `   📊 ${(p.likes || 0).toLocaleString('pt-BR')} likes | ${p.engagement_rate?.toFixed(2) || 0}% eng | ${postDate}\n`;
      });
    }
  }

  // LinkedIn posts
  if (linkedinPosts.length > 0) {
    const avgLikes = linkedinPosts.reduce((sum: number, p: any) => sum + (p.likes || 0), 0) / linkedinPosts.length;
    context += `\n### Posts do LinkedIn (${linkedinPosts.length} posts)\n`;
    context += `**Média:** ${Math.round(avgLikes).toLocaleString('pt-BR')} likes\n`;
    context += `\n**Top 5:**\n`;
    linkedinPosts.slice(0, 5).forEach((p: any, i: number) => {
      const content = (p.full_content || p.content || "").substring(0, 80);
      const postDate = p.posted_at ? formatDateBR(p.posted_at.split('T')[0]) : '';
      context += `${i + 1}. ${content}${content.length >= 80 ? '...' : ''}\n`;
      context += `   📊 ${(p.likes || 0).toLocaleString('pt-BR')} likes | ${p.comments || 0} comments | ${p.engagement_rate?.toFixed(2) || 0}% eng | ${postDate}\n`;
    });
  }

  // Twitter/X engagement data
  if (twitterData.length > 0) {
    context += `\n### Twitter/X - Oportunidades de Engajamento Recentes (${twitterData.length})\n`;
    twitterData.slice(0, 5).forEach((t: any, i: number) => {
      context += `${i + 1}. @${t.author_username}: ${t.tweet_text?.substring(0, 100) || ''}${t.tweet_text?.length > 100 ? '...' : ''}\n`;
      context += `   Status: ${t.status || 'pending'}\n`;
    });
  }

  // YouTube videos
  if (youtubeVideos.length > 0) {
    const totalViews = youtubeVideos.reduce((sum: number, v: any) => sum + (v.total_views || 0), 0);
    const avgViews = Math.round(totalViews / youtubeVideos.length);
    const totalWatchHours = youtubeVideos.reduce((sum: number, v: any) => sum + (v.watch_hours || 0), 0);

    context += `\n### YouTube (${youtubeVideos.length} vídeos)\n`;
    context += `**Totais:** ${totalViews.toLocaleString('pt-BR')} views | ${totalWatchHours.toFixed(1)}h assistidas\n`;
    context += `**Média:** ${avgViews.toLocaleString('pt-BR')} views/vídeo\n`;

    if (isSpecificQuery) {
      context += `\n**Ranking por Views:**\n`;
      youtubeVideos.forEach((v: any, i: number) => {
        const pubDate = v.published_at ? formatDateBR(v.published_at.split('T')[0]) : '';
        context += `\n**#${i + 1} - ${(v.total_views || 0).toLocaleString('pt-BR')} views** (${pubDate})\n`;
        context += `Título: ${v.title}\n`;
        context += `Likes: ${(v.likes || 0).toLocaleString('pt-BR')} | Comments: ${v.comments || 0} | CTR: ${(v.click_rate || 0).toFixed(2)}%\n`;
        if (v.duration_seconds) context += `Duração: ${Math.floor(v.duration_seconds / 60)}min\n`;
        if (v.subscribers_gained) context += `Inscritos ganhos: +${v.subscribers_gained}\n`;
        if (v.transcript && i < 3) context += `Transcrição: ${v.transcript.substring(0, 400)}\n`;
      });
    } else {
      context += `\n**Top 5 por Views:**\n`;
      youtubeVideos.slice(0, 5).forEach((v: any, i: number) => {
        const pubDate = v.published_at ? formatDateBR(v.published_at.split('T')[0]) : '';
        context += `${i + 1}. ${v.title}\n`;
        context += `   🎬 ${(v.total_views || 0).toLocaleString('pt-BR')} views | ${(v.likes || 0).toLocaleString('pt-BR')} likes | ${pubDate}\n`;
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
// MULTI-PLATFORM COMPARISON
// ============================================

async function fetchComparisonContext(
  supabase: any, clientId: string,
  period1: DateRange, period2: DateRange,
  period1Label: string, period2Label: string
): Promise<string> {
  const [posts1Result, posts2Result, li1Result, li2Result] = await Promise.all([
    supabase.from("instagram_posts")
      .select("likes, comments, saves, shares, reach, impressions, engagement_rate")
      .eq("client_id", clientId).gte("posted_at", period1.start).lte("posted_at", period1.end + "T23:59:59Z"),
    supabase.from("instagram_posts")
      .select("likes, comments, saves, shares, reach, impressions, engagement_rate")
      .eq("client_id", clientId).gte("posted_at", period2.start).lte("posted_at", period2.end + "T23:59:59Z"),
    supabase.from("linkedin_posts")
      .select("likes, comments, shares, impressions, engagement_rate")
      .eq("client_id", clientId).gte("posted_at", period1.start).lte("posted_at", period1.end + "T23:59:59Z"),
    supabase.from("linkedin_posts")
      .select("likes, comments, shares, impressions, engagement_rate")
      .eq("client_id", clientId).gte("posted_at", period2.start).lte("posted_at", period2.end + "T23:59:59Z"),
  ]);

  const calcAggregates = (posts: any[]) => {
    if (posts.length === 0) return { posts: 0, likes: 0, comments: 0, saves: 0, shares: 0, reach: 0, engagement: 0 };
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

  const calcChange = (val1: number, val2: number): string => {
    if (val2 === 0) return val1 > 0 ? "+100%" : "0%";
    const change = ((val1 - val2) / val2) * 100;
    return `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`;
  };
  const changeEmoji = (val1: number, val2: number): string => val1 > val2 ? "📈" : val1 < val2 ? "📉" : "➡️";

  let context = `\n## Comparativo: ${period1Label} vs ${period2Label}\n`;

  // Instagram comparison
  const iAgg1 = calcAggregates(posts1Result.data || []);
  const iAgg2 = calcAggregates(posts2Result.data || []);
  if (iAgg1.posts > 0 || iAgg2.posts > 0) {
    context += `\n### Instagram\n| Métrica | ${period1Label} | ${period2Label} | Variação |\n|---------|---|---|---|\n`;
    context += `| Posts | ${iAgg1.posts} | ${iAgg2.posts} | ${calcChange(iAgg1.posts, iAgg2.posts)} ${changeEmoji(iAgg1.posts, iAgg2.posts)} |\n`;
    context += `| Likes | ${iAgg1.likes.toLocaleString('pt-BR')} | ${iAgg2.likes.toLocaleString('pt-BR')} | ${calcChange(iAgg1.likes, iAgg2.likes)} ${changeEmoji(iAgg1.likes, iAgg2.likes)} |\n`;
    context += `| Engajamento | ${iAgg1.engagement.toFixed(2)}% | ${iAgg2.engagement.toFixed(2)}% | ${calcChange(iAgg1.engagement, iAgg2.engagement)} ${changeEmoji(iAgg1.engagement, iAgg2.engagement)} |\n`;
  }

  // LinkedIn comparison
  const lAgg1 = calcAggregates(li1Result.data || []);
  const lAgg2 = calcAggregates(li2Result.data || []);
  if (lAgg1.posts > 0 || lAgg2.posts > 0) {
    context += `\n### LinkedIn\n| Métrica | ${period1Label} | ${period2Label} | Variação |\n|---------|---|---|---|\n`;
    context += `| Posts | ${lAgg1.posts} | ${lAgg2.posts} | ${calcChange(lAgg1.posts, lAgg2.posts)} |\n`;
    context += `| Likes | ${lAgg1.likes.toLocaleString('pt-BR')} | ${lAgg2.likes.toLocaleString('pt-BR')} | ${calcChange(lAgg1.likes, lAgg2.likes)} |\n`;
  }

  return context;
}

// ============================================
// WEB SEARCH INTEGRATION
// ============================================

async function performWebSearch(query: string, authHeader: string): Promise<string | null> {
  const GROK_API_KEY = Deno.env.get("GROK_API_KEY");
  if (!GROK_API_KEY) return null;
  try {
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${GROK_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "grok-beta",
        messages: [
          { role: "system", content: "Você é um assistente de pesquisa. Forneça informações atualizadas, precisas e bem fundamentadas. Seja conciso e objetivo." },
          { role: "user", content: query },
        ],
        temperature: 0.7,
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const result = data.choices?.[0]?.message?.content;
    return result ? `\n## Informações da Pesquisa Web\n${result}\n` : null;
  } catch { return null; }
}

// ============================================
// IMAGE GENERATION
// ============================================

async function generateImage(prompt: string, clientName: string): Promise<{ imageData?: string; text?: string; error?: string }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return { error: "Chave de API não configurada" };
  try {
    const enhancedPrompt = `Create a professional, high-quality image for ${clientName}. The image should be: ${prompt} Style: Modern, clean, professional. No text or watermarks.`;
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-2.5-flash-image", messages: [{ role: "user", content: enhancedPrompt }], modalities: ["image", "text"] }),
    });
    if (!response.ok) return { error: "Erro ao gerar imagem. Tente novamente." };
    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    const text = data.choices?.[0]?.message?.content || "Imagem gerada! 🎨";
    if (!imageUrl) return { error: "Não foi possível gerar a imagem." };
    return { imageData: imageUrl, text };
  } catch { return { error: "Erro ao gerar imagem. Tente novamente." }; }
}

// ============================================
// PLANNING HELPERS
// ============================================

function buildPlanningQuestionPrompt(intent: PlanningIntent, clientName: string): string {
  const questions: string[] = [];
  if (!intent.platform) questions.push("📱 **Para qual plataforma?** (Instagram, Twitter, LinkedIn, YouTube, Newsletter, TikTok)");
  if (!intent.specificDate && intent.action === "schedule") questions.push("📅 **Para qual data?**");
  if (!intent.topic && !intent.sourceUrl) questions.push("📝 **Sobre qual tema ou assunto?**");
  let response = `Vou criar ${intent.quantity > 1 ? `${intent.quantity} cards` : "o card"} no planejamento para **${clientName}**! ✨\n\nPreciso de algumas informações:\n\n`;
  response += questions.join("\n\n");
  response += "\n\n*Responda com as informações que faltam para eu criar os cards.*";
  return response;
}

async function generatePlanningCards(
  supabase: any, client: any, clientId: string, workspaceId: string,
  userId: string, intent: PlanningIntent, authHeader: string, userInstructions?: UserInstructions
): Promise<any[]> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  if (!workspaceId) throw new Error("Cliente não está associado a um workspace");
  
  const { data: columns, error: columnsError } = await supabase
    .from("kanban_columns").select("id")
    .eq("workspace_id", workspaceId).order("position", { ascending: true }).limit(1);
  if (columnsError || !columns?.length) throw new Error("Nenhuma coluna de planejamento configurada.");
  
  const columnId = columns[0].id;
  const cards: any[] = [];
  
  let dates: string[] = [];
  if (intent.action === "distribute") dates = distributeAcrossWeek(intent.quantity);
  else if (intent.specificDate) dates = Array(intent.quantity).fill(intent.specificDate);
  
  let urlContext = "";
  if (intent.sourceUrl) {
    if (intent.sourceUrl.includes("youtube.com") || intent.sourceUrl.includes("youtu.be")) {
      const { data: ytData } = await supabase.functions.invoke("extract-youtube", { body: { url: intent.sourceUrl } });
      if (ytData?.transcript) urlContext = `Título: ${ytData.title || ''}\nTranscrição: ${ytData.transcript.substring(0, 3000)}`;
    } else {
      const { data: scrapeData } = await supabase.functions.invoke("firecrawl-scrape", { body: { url: intent.sourceUrl } });
      if (scrapeData?.data?.markdown) urlContext = scrapeData.data.markdown.substring(0, 3000);
    }
  }

  // Fetch metrics context when analyzeFirst is enabled
  let metricsAnalysisContext = "";
  if (intent.analyzeFirst) {
    const fetchPromises: Promise<any>[] = [];
    
    if (intent.analyzeSource === "youtube" || intent.analyzeSource === "all") {
      fetchPromises.push(
        supabase.from("youtube_videos")
          .select("title, total_views, likes, comments, published_at, duration_seconds, click_rate, subscribers_gained, watch_hours, transcript")
          .eq("client_id", clientId)
          .order("total_views", { ascending: false, nullsFirst: false }).limit(30)
          .then((r: any) => ({ platform: "youtube", data: r.data || [] }))
      );
    }
    if (intent.analyzeSource === "instagram" || intent.analyzeSource === "all") {
      fetchPromises.push(
        supabase.from("instagram_posts")
          .select("caption, full_content, likes, comments, saves, shares, reach, engagement_rate, posted_at, post_type")
          .eq("client_id", clientId)
          .order("engagement_rate", { ascending: false, nullsFirst: false }).limit(30)
          .then((r: any) => ({ platform: "instagram", data: r.data || [] }))
      );
    }
    if (intent.analyzeSource === "linkedin" || intent.analyzeSource === "all") {
      fetchPromises.push(
        supabase.from("linkedin_posts")
          .select("content, full_content, likes, comments, shares, impressions, engagement_rate, posted_at")
          .eq("client_id", clientId)
          .order("likes", { ascending: false, nullsFirst: false }).limit(30)
          .then((r: any) => ({ platform: "linkedin", data: r.data || [] }))
      );
    }

    const results = await Promise.all(fetchPromises);
    
    for (const result of results) {
      if (result.data.length === 0) continue;
      
      if (result.platform === "youtube") {
        metricsAnalysisContext += `\n## Top ${result.data.length} Vídeos do YouTube (por views)\n`;
        result.data.forEach((v: any, i: number) => {
          const pubDate = v.published_at ? v.published_at.split('T')[0] : '';
          const duration = v.duration_seconds ? `${Math.floor(v.duration_seconds / 60)}min` : '';
          metricsAnalysisContext += `${i + 1}. "${v.title}" — ${(v.total_views || 0).toLocaleString('pt-BR')} views | ${(v.likes || 0).toLocaleString('pt-BR')} likes | ${v.comments || 0} comments | CTR: ${(v.click_rate || 0).toFixed(2)}% | ${duration} | ${pubDate}\n`;
          if (v.transcript && i < 5) metricsAnalysisContext += `   Resumo: ${v.transcript.substring(0, 200)}...\n`;
        });
      } else if (result.platform === "instagram") {
        metricsAnalysisContext += `\n## Top ${result.data.length} Posts do Instagram (por engajamento)\n`;
        result.data.forEach((p: any, i: number) => {
          const caption = (p.full_content || p.caption || "").substring(0, 120);
          metricsAnalysisContext += `${i + 1}. ${caption}${caption.length >= 120 ? '...' : ''} — ${p.engagement_rate?.toFixed(2) || 0}% eng | ${(p.likes || 0).toLocaleString('pt-BR')} likes | Tipo: ${p.post_type || 'post'}\n`;
        });
      } else if (result.platform === "linkedin") {
        metricsAnalysisContext += `\n## Top ${result.data.length} Posts do LinkedIn (por likes)\n`;
        result.data.forEach((p: any, i: number) => {
          const content = (p.full_content || p.content || "").substring(0, 120);
          metricsAnalysisContext += `${i + 1}. ${content}${content.length >= 120 ? '...' : ''} — ${(p.likes || 0).toLocaleString('pt-BR')} likes | ${p.comments || 0} comments\n`;
        });
      }
    }
  }
  
  if (LOVABLE_API_KEY && (intent.topic || urlContext || intent.analyzeFirst)) {
    const platformInstructions: Record<string, string> = {
      instagram: "Posts para Instagram: hook forte, máximo 2200 chars, poucos emojis, estrutura clara",
      twitter: "Tweets: MÁXIMO 280 caracteres, ZERO emojis no corpo, ZERO hashtags, gancho forte",
      linkedin: "Posts LinkedIn: profissionais, storytelling, insights",
      youtube: "Títulos/descrições para YouTube: SEO otimizado, títulos atrativos com hook claro",
      newsletter: "Títulos para newsletter: valor claro, CTA forte",
      tiktok: "Ideias para TikTok: trends, ganchos virais",
    };
    
    let userConstraints = "";
    if (userInstructions?.skipImages) userConstraints += "\n⛔ NÃO inclua imagens. Apenas texto.";
    if (userInstructions?.noEmojis) userConstraints += "\n⛔ ZERO emojis.";

    let analysisInstructions = "";
    if (intent.analyzeFirst && metricsAnalysisContext) {
      analysisInstructions = `
## ANÁLISE DE PERFORMANCE — DADOS REAIS DO CLIENTE
${metricsAnalysisContext}

## INSTRUÇÕES DE ANÁLISE
Com base nos dados acima:
1. Identifique os PADRÕES DE SUCESSO: quais temas, formatos, durações e abordagens geraram mais engajamento
2. Identifique LACUNAS: temas que o público engajou mas foram pouco explorados
3. Gere ${intent.quantity} temas NOVOS e ORIGINAIS inspirados nesses padrões
4. Para cada tema, inclua:
   - Título atrativo e estratégico
   - Descrição com 3-5 tópicos/pontos que devem ser abordados no conteúdo
   - Por que esse tema tem potencial (baseado nos dados)
NÃO repita temas que já existem. Crie variações e evoluções dos melhores.`;
    }
    
    const prompt = `Você é um estrategista de conteúdo para ${client.name}.
${client.identity_guide ? `\nGuia de Identidade:\n${client.identity_guide.substring(0, 1500)}` : ""}
${urlContext ? `\n## Conteúdo de Referência:\n${urlContext}` : ""}
${analysisInstructions}
${userConstraints}

TAREFA: Gere ${intent.quantity} conteúdo(s) COMPLETO(S) para ${intent.platform || "redes sociais"}.
${intent.topic ? `Tema: ${intent.topic}` : ""}
${platformInstructions[intent.platform || "instagram"] || ""}

Responda APENAS com JSON: { "cards": [{ "title": "título curto", "description": "CONTEÚDO COMPLETO com tópicos detalhados" }] }`;

    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const text = data.choices?.[0]?.message?.content || "";
        const jsonMatch = text.match(/\{[\s\S]*"cards"[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const generatedCards = parsed.cards || [];
          for (let i = 0; i < Math.min(generatedCards.length, intent.quantity); i++) {
            const genCard = generatedCards[i];
            const { data: newCard, error } = await supabase.from("planning_items").insert({
              title: genCard.title, description: genCard.title, content: genCard.description,
              client_id: clientId, workspace_id: workspaceId, column_id: columnId,
              scheduled_at: dates[i] || null, platform: intent.platform,
              status: "todo", created_by: userId,
            }).select().single();
            if (!error && newCard) cards.push(newCard);
          }
        }
      }
    } catch (error) {
      console.error("[kai-simple-chat] AI generation error:", error);
    }
  }
  
  if (cards.length === 0) {
    for (let i = 0; i < intent.quantity; i++) {
      const { data: newCard, error } = await supabase.from("planning_items").insert({
        title: intent.topic || `Card ${i + 1}`, description: intent.topic || `Card ${i + 1}`,
        content: intent.sourceUrl ? `Referência: ${intent.sourceUrl}` : "",
        client_id: clientId, workspace_id: workspaceId, column_id: columnId,
        scheduled_at: dates[i] || intent.specificDate || null, platform: intent.platform,
        status: "todo", created_by: userId,
      }).select().single();
      if (!error && newCard) cards.push(newCard);
    }
  }
  
  if (cards.length === 0) throw new Error("Não foi possível criar nenhum card");
  return cards;
}

function distributeAcrossWeek(count: number): string[] {
  const dates: string[] = [];
  const start = new Date();
  const currentDay = start.getDay();
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

function buildPlanningSuccessMessage(cards: any[], intent: PlanningIntent): string {
  const count = cards.length;
  const platformLabel = intent.platform ? ` para **${intent.platform.charAt(0).toUpperCase() + intent.platform.slice(1)}**` : "";
  let message = `✅ **${count} ${count === 1 ? "card criado" : "cards criados"}${platformLabel}!**\n\n`;
  if (intent.analyzeFirst) {
    const sourceLabel = intent.analyzeSource === "youtube" ? "vídeos do YouTube" :
                       intent.analyzeSource === "instagram" ? "posts do Instagram" :
                       intent.analyzeSource === "linkedin" ? "posts do LinkedIn" :
                       "conteúdos de todas as plataformas";
    message += `📊 **Baseado na análise dos melhores ${sourceLabel}** do cliente\n\n`;
  }
  if (intent.sourceUrl) message += `📎 Baseado em: ${intent.sourceUrl}\n\n`;
  message += "📋 **Cards adicionados ao planejamento:**\n\n";
  for (let i = 0; i < Math.min(cards.length, 10); i++) {
    const card = cards[i];
    const dateStr = card.scheduled_at ? ` | 📅 ${formatDateBR(card.scheduled_at.split('T')[0])}` : "";
    const platformIcon = card.platform ? ` | ${getPlatformEmoji(card.platform)}` : "";
    message += `${i + 1}. **${card.title}**${platformIcon}${dateStr}\n`;
  }
  if (cards.length > 10) message += `\n*...e mais ${cards.length - 10} cards*\n`;
  message += "\n---\n💡 Acesse **Planejamento** para editar ou reagendar\n";
  return message;
}

// ============================================
// NEW: PLANNING ITEMS READ
// ============================================

async function fetchPlanningContext(
  supabase: any, clientId: string, workspaceId: string
): Promise<string> {
  const now = new Date();
  const weekFromNow = new Date(); weekFromNow.setDate(weekFromNow.getDate() + 7);
  
  const [pendingResult, scheduledResult, overdueResult] = await Promise.all([
    supabase.from("planning_items")
      .select("id, title, platform, status, scheduled_at, content_type, priority")
      .eq("client_id", clientId).eq("workspace_id", workspaceId)
      .in("status", ["todo", "draft", "review"])
      .order("scheduled_at", { ascending: true, nullsFirst: false }).limit(20),
    supabase.from("planning_items")
      .select("id, title, platform, status, scheduled_at, content_type")
      .eq("client_id", clientId).eq("workspace_id", workspaceId)
      .eq("status", "scheduled")
      .gte("scheduled_at", now.toISOString())
      .lte("scheduled_at", weekFromNow.toISOString())
      .order("scheduled_at", { ascending: true }).limit(15),
    supabase.from("planning_items")
      .select("id, title, platform, status, scheduled_at")
      .eq("client_id", clientId).eq("workspace_id", workspaceId)
      .in("status", ["todo", "draft", "review", "scheduled"])
      .lt("scheduled_at", now.toISOString())
      .order("scheduled_at", { ascending: true }).limit(10),
  ]);

  const pending = pendingResult.data || [];
  const scheduled = scheduledResult.data || [];
  const overdue = overdueResult.data || [];

  if (pending.length === 0 && scheduled.length === 0 && overdue.length === 0) {
    return "\n## 📋 Planejamento\nNenhum item no planejamento deste cliente no momento.\n";
  }

  let context = "\n## 📋 Status do Planejamento\n";

  if (overdue.length > 0) {
    context += `\n### ⚠️ Atrasados (${overdue.length})\n`;
    overdue.forEach((item: any) => {
      const dateStr = item.scheduled_at ? formatDateBR(item.scheduled_at.split('T')[0]) : '';
      context += `- **${item.title}** | ${getPlatformEmoji(item.platform || '')} ${item.platform || 'N/A'} | Deveria: ${dateStr} | Status: ${item.status}\n`;
    });
  }

  if (scheduled.length > 0) {
    context += `\n### 📅 Agendados esta semana (${scheduled.length})\n`;
    scheduled.forEach((item: any) => {
      const dateStr = item.scheduled_at ? formatDateBR(item.scheduled_at.split('T')[0]) : '';
      context += `- **${item.title}** | ${getPlatformEmoji(item.platform || '')} ${item.platform || 'N/A'} | ${dateStr}\n`;
    });
  }

  if (pending.length > 0) {
    context += `\n### 📝 Pendentes (${pending.length})\n`;
    pending.slice(0, 10).forEach((item: any) => {
      const dateStr = item.scheduled_at ? ` | 📅 ${formatDateBR(item.scheduled_at.split('T')[0])}` : '';
      const priority = item.priority ? ` | Prioridade: ${item.priority}` : '';
      context += `- **${item.title}** | ${getPlatformEmoji(item.platform || '')} ${item.platform || 'N/A'}${dateStr}${priority} | Status: ${item.status}\n`;
    });
    if (pending.length > 10) context += `- *...e mais ${pending.length - 10} itens*\n`;
  }

  context += `\n**Resumo:** ${overdue.length} atrasados | ${scheduled.length} agendados | ${pending.length} pendentes\n`;
  return context;
}

// ============================================
// NEW: VOICE PROFILE & CONTENT GUIDELINES
// ============================================

async function fetchVoiceAndGuidelines(
  supabase: any, clientId: string
): Promise<string> {
  const [voiceResult, guidelinesResult] = await Promise.all([
    supabase.from("clients").select("voice_profile, content_guidelines").eq("id", clientId).single(),
    // Also try to get any additional guidelines from the workspace-level
    Promise.resolve(null),
  ]);

  let context = "";
  const client = voiceResult.data;
  
  if (client?.voice_profile) {
    const vp = typeof client.voice_profile === 'string' ? client.voice_profile : JSON.stringify(client.voice_profile);
    context += `\n## 🎤 Perfil de Voz do Cliente\n${vp.substring(0, 3000)}\n`;
  }
  
  if (client?.content_guidelines) {
    context += `\n## 📏 Diretrizes de Conteúdo\n${client.content_guidelines.substring(0, 3000)}\n`;
  }

  return context;
}

// ============================================
// NEW: GLOBAL KNOWLEDGE SEARCH
// ============================================

async function fetchKnowledgeContext(
  supabase: any, workspaceId: string, query: string
): Promise<string> {
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return "";

    // Generate embedding for the query
    const embeddingResponse = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "text-embedding-3-small", input: query, dimensions: 768 }),
    });

    if (!embeddingResponse.ok) return "";
    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.data?.[0]?.embedding;
    if (!queryEmbedding) return "";

    const { data: results, error } = await supabase.rpc("search_knowledge_semantic", {
      query_embedding: queryEmbedding,
      workspace_id_filter: workspaceId,
      match_count: 3,
      similarity_threshold: 0.5
    });

    if (error || !results?.length) return "";

    let context = "\n## 🧠 Base de Conhecimento do Workspace\n";
    results.forEach((r: any, i: number) => {
      context += `\n### ${r.title}\n`;
      context += `${(r.content || r.summary || "").substring(0, 1000)}\n`;
      if (r.source_url) context += `Fonte: ${r.source_url}\n`;
    });
    return context;
  } catch (err) {
    console.error("[kai-simple-chat] Knowledge search error:", err);
    return "";
  }
}

// ============================================
// NEW: DOCUMENTS & WEBSITES CONTEXT
// ============================================

async function fetchDocumentsAndWebsites(
  supabase: any, clientId: string
): Promise<string> {
  const [docsResult, websitesResult] = await Promise.all([
    supabase.from("client_documents")
      .select("name, extracted_content")
      .eq("client_id", clientId)
      .not("extracted_content", "is", null)
      .order("created_at", { ascending: false }).limit(3),
    supabase.from("client_websites")
      .select("url, scraped_markdown")
      .eq("client_id", clientId)
      .not("scraped_markdown", "is", null)
      .order("last_scraped_at", { ascending: false }).limit(2),
  ]);

  let context = "";
  const docs = docsResult.data || [];
  const websites = websitesResult.data || [];

  if (docs.length > 0) {
    context += "\n## 📄 Documentos do Cliente\n";
    docs.forEach((doc: any) => {
      context += `\n### ${doc.name}\n${(doc.extracted_content || "").substring(0, 1500)}\n`;
    });
  }

  if (websites.length > 0) {
    context += "\n## 🌐 Conteúdo dos Sites do Cliente\n";
    websites.forEach((site: any) => {
      context += `\n### ${site.url}\n${(site.scraped_markdown || "").substring(0, 1500)}\n`;
    });
  }

  return context;
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
    const { message, clientId, imageUrls, citations, history, materialContext, materialTitle } = body;

    console.log("[kai-simple-chat] Request:", { 
      userId: user.id, clientId, 
      imageUrlsCount: imageUrls?.length, citationsCount: citations?.length,
      historyCount: history?.length, messageLength: message?.length 
    });

    if (!clientId || !message) {
      return new Response(
        JSON.stringify({ error: "clientId e message são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Fetch client (with voice_profile and content_guidelines)
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("name, description, identity_guide, workspace_id, voice_profile, content_guidelines")
      .eq("id", clientId)
      .single();

    if (clientError || !client) {
      return new Response(
        JSON.stringify({ error: "Cliente não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // NOTE: Plan check REMOVED — this is an internal tool, no plan restrictions

    // 2. Detect intents
    const needsMetrics = isMetricsQuery(message);
    const isReport = isReportRequest(message);
    const needsWebSearch = isWebSearchQuery(message);
    const isSpecificQuery = isSpecificContentQuery(message);
    const imageGenRequest = isImageGenerationRequest(message);
    const comparisonQuery = isComparisonQuery(message);
    const contentCreation = detectContentCreation(message, history);
    const planningIntent = detectPlanningIntent(message, history);
    const needsPlanningRead = isPlanningReadQuery(message);
    const userInstructions = detectUserInstructions(message);

    const dateRange = extractDateRange(message);
    const metricFocus = detectMetricFocus(message);

    console.log("[kai-simple-chat] Intent detection:", { 
      needsMetrics, isReport, needsWebSearch, isSpecificQuery,
      isImageGeneration: imageGenRequest.isRequest,
      isComparison: comparisonQuery.isComparison,
      isContentCreation: contentCreation.isContentCreation,
      isPlanningRequest: planningIntent.isPlanning,
      analyzeFirst: planningIntent.analyzeFirst,
      analyzeSource: planningIntent.analyzeSource,
      needsPlanningRead,
      dateRange, metricFocus,
    });

    // 3. Handle Image Generation
    if (imageGenRequest.isRequest) {
      const imageResult = await generateImage(imageGenRequest.prompt, client.name);
      if (imageResult.error) {
        return new Response(JSON.stringify({ error: imageResult.error }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: imageResult.text, image: imageResult.imageData } }] })}\n\n`));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });
      return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
    }

    // 4. Handle Planning Card Creation
    if (planningIntent.isPlanning) {
      if (planningIntent.missingInfo.length > 0 && !planningIntent.sourceUrl && !planningIntent.topic && !planningIntent.analyzeFirst) {
        const missingInfoPrompt = buildPlanningQuestionPrompt(planningIntent, client.name);
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: missingInfoPrompt } }] })}\n\n`));
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          },
        });
        return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
      }
      
      try {
        const cards = await generatePlanningCards(supabase, client, clientId, client.workspace_id, user.id, planningIntent, authHeader, userInstructions);
        const successMessage = buildPlanningSuccessMessage(cards, planningIntent);
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: successMessage } }] })}\n\n`));
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          },
        });
        return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
      } catch (planningError) {
        const errorMessage = planningError instanceof Error ? planningError.message : "Erro ao criar cards";
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: `❌ **Erro:** ${errorMessage}` } }] })}\n\n`));
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          },
        });
        return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
      }
    }

    // 5. Fetch all context in parallel
    let metricsContext = "";
    let comparisonContext = "";
    let topPerformersContext = "";
    let formatRulesContext = "";
    let libraryExamplesContext = "";
    let referenceExamplesContext = "";
    let planningContext = "";
    let voiceGuidelinesContext = "";
    let knowledgeContext = "";
    let docsWebsitesContext = "";
    
    // Build parallel context fetch promises
    const contextPromises: Promise<void>[] = [];

    // Metrics/comparison
    if (comparisonQuery.isComparison && comparisonQuery.period1 && comparisonQuery.period2) {
      contextPromises.push(
        fetchComparisonContext(supabase, clientId, comparisonQuery.period1, comparisonQuery.period2, comparisonQuery.period1Label, comparisonQuery.period2Label)
          .then(r => { comparisonContext = r; })
      );
    } else if (needsMetrics || isReport || isSpecificQuery) {
      contextPromises.push(
        fetchMetricsContext(supabase, clientId, dateRange, metricFocus, isSpecificQuery)
          .then(r => { metricsContext = r; })
      );
    }

    // Planning read
    if (needsPlanningRead) {
      contextPromises.push(
        fetchPlanningContext(supabase, clientId, client.workspace_id)
          .then(r => { planningContext = r; })
      );
    }

    // Voice profile + content guidelines (always inject for content creation)
    if (contentCreation.isContentCreation) {
      contextPromises.push(
        fetchVoiceAndGuidelines(supabase, clientId)
          .then(r => { voiceGuidelinesContext = r; })
      );
    }

    // Global knowledge (for general questions)
    if (!contentCreation.isContentCreation && !needsMetrics && !planningIntent.isPlanning) {
      contextPromises.push(
        fetchKnowledgeContext(supabase, client.workspace_id, message)
          .then(r => { knowledgeContext = r; })
      );
    }

    // Documents and websites (general context)
    contextPromises.push(
      fetchDocumentsAndWebsites(supabase, clientId)
        .then(r => { docsWebsitesContext = r; })
    );

    // Content creation context
    if (contentCreation.isContentCreation) {
      contextPromises.push(
        Promise.all([
          fetchLibraryExamples(supabase, clientId, contentCreation.detectedFormat, 5),
          fetchReferenceExamples(supabase, clientId, contentCreation.detectedFormat, 3),
          supabase.from("instagram_posts")
            .select("caption, post_type, engagement_rate, likes, full_content")
            .eq("client_id", clientId).order("engagement_rate", { ascending: false }).limit(5),
          Promise.resolve(contentCreation.detectedFormat ? getFormatRules(contentCreation.detectedFormat) : null),
        ]).then(([libraryResult, referenceResult, topPostsResult, formatDocResult]) => {
          libraryExamplesContext = libraryResult;
          referenceExamplesContext = referenceResult;
          const topPosts = topPostsResult.data || [];
          if (topPosts.length > 0) {
            topPerformersContext = `\n## 📊 Top Performers Instagram\n`;
            topPosts.forEach((post: any, i: number) => {
              const content = post.full_content || post.caption || "";
              topPerformersContext += `\n### Post #${i + 1} (${post.post_type || 'post'}) - ${(post.engagement_rate || 0).toFixed(2)}% eng\n`;
              topPerformersContext += `${content.substring(0, 400)}${content.length > 400 ? '...' : ''}\n`;
            });
          }
          if (formatDocResult) {
            formatRulesContext = `\n## 📋 Regras do Formato: ${contentCreation.detectedFormat?.toUpperCase()}\n${formatDocResult}\n`;
          }
        })
      );
    }

    // Web search + cited content
    const [webSearchResult, citedContent] = await Promise.all([
      needsWebSearch ? performWebSearch(message, authHeader) : Promise.resolve(null),
      fetchCitedContent(supabase, citations),
      ...contextPromises.map(p => p),
    ]);

    // 6. Build system prompt
    const identityGuide = client.identity_guide?.substring(0, MAX_IDENTITY_GUIDE_LENGTH) || "";
    const userInstructionsPrompt = buildUserInstructionsPrompt(userInstructions);

    let systemPrompt = `# REGRAS ABSOLUTAS DE ENTREGA (LEIA PRIMEIRO)
${userInstructionsPrompt}
⛔ PROIBIDO INCLUIR NA RESPOSTA:
- "Checklist:", "Observações:", "Notas:", "Dicas:"
- Comentários como "Aqui está...", "Segue...", "Criei para você..."
- Emojis de validação (✅❌)
- Emojis decorativos no corpo do texto (💡🔥✨🚀💰📈💼🎯)
- Hashtags
- Meta-texto explicando o que você fez

✅ ENTREGUE APENAS: O conteúdo final pronto para publicação.

---

Você é o kAI, um assistente especializado em criação de conteúdo e análise de performance para marcas e criadores.

## Cliente: ${client.name}
${client.description ? `Descrição: ${client.description}` : ""}

${identityGuide ? `## Guia de Identidade\n${identityGuide}` : ""}`;

    // Add voice profile and content guidelines
    if (voiceGuidelinesContext) systemPrompt += voiceGuidelinesContext;
    else {
      // Even for non-content-creation, inject voice profile if available
      const vp = client.voice_profile;
      if (vp) {
        const vpStr = typeof vp === 'string' ? vp : JSON.stringify(vp);
        systemPrompt += `\n## 🎤 Perfil de Voz\n${vpStr.substring(0, 2000)}\n`;
      }
      if (client.content_guidelines) {
        systemPrompt += `\n## 📏 Diretrizes\n${client.content_guidelines.substring(0, 2000)}\n`;
      }
    }

    // Add all context blocks
    if (comparisonContext) systemPrompt += `\n${comparisonContext}`;
    if (metricsContext) systemPrompt += `\n${metricsContext}`;
    if (planningContext) systemPrompt += `\n${planningContext}`;
    if (knowledgeContext) systemPrompt += `\n${knowledgeContext}`;
    if (docsWebsitesContext) systemPrompt += `\n${docsWebsitesContext}`;
    if (webSearchResult) systemPrompt += `\n${webSearchResult}`;
    if (citedContent) systemPrompt += `\n## Materiais Citados pelo Usuário (PRIORIDADE MÁXIMA)\n${citedContent}`;
    if (materialContext) systemPrompt += `\n## 📄 Material em Discussão${materialTitle ? ` — ${materialTitle}` : ''} (CONTEXTO PRIMÁRIO)\n${materialContext.substring(0, 12000)}`;
    if (libraryExamplesContext) systemPrompt += `\n${libraryExamplesContext}`;
    if (referenceExamplesContext) systemPrompt += `\n${referenceExamplesContext}`;
    if (topPerformersContext) systemPrompt += `\n${topPerformersContext}`;
    if (formatRulesContext) systemPrompt += `\n${formatRulesContext}`;

    // Add intent-specific instructions
    if (contentCreation.isContentCreation) {
      systemPrompt += `

## 🎯 INSTRUÇÕES PARA CRIAÇÃO DE CONTEÚDO
SIGA RIGOROSAMENTE a ordem de prioridade:
1. **Materiais Citados** (@mentions) → base principal
2. **Exemplos da Biblioteca** → replique estrutura e tom
3. **Referências Salvas** → inspiração adaptada ao estilo do cliente
4. **Top Performers** → referência de métricas
5. **Perfil de Voz** → tom de voz exato

### REGRAS:
- Tom de voz: EXATAMENTE como no Guia de Identidade e Perfil de Voz
- ZERO emojis no corpo do texto
- PROIBIDO: "Entenda", "Aprenda", "Descubra como", frases genéricas
- USE: linguagem direta, verbos de ação, números específicos
- ENTREGUE APENAS o conteúdo final, sem explicações`;
    } else if (comparisonQuery.isComparison) {
      systemPrompt += `\n## Instruções para Análise Comparativa\nDestaque diferenças, tendências, causas e ações. Use tabelas markdown e emojis 📈📉➡️.`;
    } else if (isReport) {
      systemPrompt += `\n## Instruções para Relatório\nGere: 1) Resumo Executivo 2) Métricas 3) Tendências 4) Insights 5) Recomendações`;
    } else if (needsPlanningRead) {
      systemPrompt += `\n## Instruções para Análise de Planejamento\nAnalise os dados do planejamento acima. Destaque itens atrasados, próximos agendamentos e sugestões.`;
    } else if (isSpecificQuery) {
      systemPrompt += `\n## Instruções para Análise Específica\nUse dados detalhados, cite números exatos, analise padrões e ofereça insights acionáveis.`;
    } else if (needsMetrics) {
      systemPrompt += `\n## Instruções para Métricas\nAnalise dados disponíveis, identifique padrões, ofereça insights acionáveis.`;
    } else {
      systemPrompt += `\n## Instruções Gerais\n- Siga tom de voz do cliente\n- Seja direto, prático e objetivo\n- Use referências citadas como base\n- Mantenha consistência com a marca`;
    }

    // 7. Build messages array with context summarization
    const fullHistory = history || [];
    let contextSummaryBlock = "";
    let recentHistory: HistoryMessage[] = [];

    if (fullHistory.length > 10) {
      // Anchored summarization: summarize older messages, keep last 5 intact
      const olderMessages = fullHistory.slice(0, -5);
      recentHistory = fullHistory.slice(-5);
      
      // Build a condensed summary of older messages
      const olderSummary = olderMessages.map(m => 
        `${m.role === 'user' ? 'Usuário' : 'Assistente'}: ${m.content.substring(0, 200)}`
      ).join('\n');
      contextSummaryBlock = `\n## Resumo da Conversa Anterior\n${olderSummary.substring(0, 2000)}\n`;
    } else {
      recentHistory = fullHistory.slice(-MAX_HISTORY_MESSAGES);
    }

    if (contextSummaryBlock) {
      systemPrompt += contextSummaryBlock;
    }

    // Save last_format_used if content was created
    if (contentCreation.isContentCreation && contentCreation.detectedFormat) {
      // Fire and forget — don't block the response
      const conversationId = body.conversationId;
      if (conversationId) {
        supabase.from("kai_chat_conversations")
          .update({ last_format_used: contentCreation.detectedFormat })
          .eq("id", conversationId)
          .then(() => {});
      }
    }

    const apiMessages = [
      { role: "system", content: systemPrompt },
      ...recentHistory.map(h => ({ role: h.role, content: h.content })),
      { role: "user", content: message },
    ];

    console.log("[kai-simple-chat] Context built:", {
      systemPromptLength: systemPrompt.length,
      historyMessages: limitedHistory.length,
      hasMetrics: !!metricsContext, hasPlanning: !!planningContext,
      hasVoice: !!voiceGuidelinesContext, hasKnowledge: !!knowledgeContext,
      hasDocs: !!docsWebsitesContext, hasLibrary: !!libraryExamplesContext,
    });

    // 8. Call Lovable AI Gateway (replacing direct Google API call)
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build messages with image support
    const gatewayMessages: any[] = [];
    for (const msg of apiMessages) {
      if (msg.role === "user" && imageUrls && imageUrls.length > 0 && msg.content === message) {
        // Multimodal message with images
        const contentParts: any[] = [{ type: "text", text: msg.content }];
        for (const imageUrl of imageUrls) {
          contentParts.push({ type: "image_url", image_url: { url: imageUrl } });
        }
        gatewayMessages.push({ role: msg.role, content: contentParts });
      } else {
        gatewayMessages.push({ role: msg.role, content: msg.content });
      }
    }

    const gatewayResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: gatewayMessages,
        stream: true,
      }),
    });

    if (!gatewayResponse.ok) {
      const errorText = await gatewayResponse.text();
      console.error("[kai-simple-chat] Gateway error:", gatewayResponse.status, errorText);
      
      if (gatewayResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Muitas requisições. Aguarde um momento." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (gatewayResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: "Erro ao gerar resposta." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Stream response directly (already in OpenAI SSE format)
    return new Response(gatewayResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });

  } catch (error) {
    console.error("[kai-simple-chat] Unhandled error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    const isTimeout = errorMessage.includes("timeout");
    return new Response(
      JSON.stringify({ error: isTimeout ? "Requisição expirou. Tente novamente." : "Erro interno." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ============================================
// HELPER: Fetch cited content
// ============================================

async function fetchCitedContent(supabase: any, citations?: Citation[]): Promise<string> {
  if (!citations || citations.length === 0) return "";

  const citationPromises = citations.map(async (citation) => {
    if (citation.type === "content") {
      const { data } = await supabase.from("client_content_library")
        .select("title, content, content_type, created_at").eq("id", citation.id).single();
      if (data) return { type: "content", title: data.title, content: data.content, contentType: data.content_type, createdAt: data.created_at };
    } else if (citation.type === "reference") {
      const { data } = await supabase.from("client_reference_library")
        .select("title, content, reference_type, created_at").eq("id", citation.id).single();
      if (data) return { type: "reference", title: data.title, content: data.content, contentType: data.reference_type, createdAt: data.created_at };
    } else if (citation.type === "format") {
      const { data } = await supabase.from("kai_documentation")
        .select("content, checklist").eq("doc_type", "format").eq("doc_key", citation.title.toLowerCase()).single();
      if (data) return { type: "format", title: citation.title, content: data.content, checklist: data.checklist };
    }
    return null;
  });

  const citationResults = (await Promise.all(citationPromises)).filter(Boolean) as any[];
  citationResults.sort((a, b) => {
    if (a?.createdAt && b?.createdAt) return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return 0;
  });

  let citedContent = "";
  for (const cit of citationResults) {
    if (!cit) continue;
    if (cit.type === "format") {
      citedContent += `\n### Regras do formato ${cit.title}:\n${cit.content}\n`;
      if (cit.checklist) citedContent += `\nChecklist:\n${JSON.stringify(cit.checklist)}\n`;
    } else {
      const label = cit.type === "content" ? "Referência" : "Referência externa";
      citedContent += `\n### ${label}: ${cit.title} (${cit.contentType})\n${cit.content}\n`;
    }
    if (citedContent.length >= MAX_CITED_CONTENT_LENGTH) {
      citedContent = citedContent.substring(0, MAX_CITED_CONTENT_LENGTH) + "\n[...conteúdo truncado]";
      break;
    }
  }
  return citedContent;
}
