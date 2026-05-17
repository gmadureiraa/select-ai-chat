// Migrated from supabase/functions/kai-simple-chat/index.ts (FULL — 2264 lines).
// Node port: SSE via res.write, Neon pg in place of supabase, Gemini direct API.
// Stream protocol preserved: OpenAI-style `data: {"choices":[{"delta":{"content":"..."}}]}\n\n`
// followed by `data: [DONE]\n\n`. Tool-calling mode (useTools=true) uses runToolLoop
// from api/_lib/kai-chat-tools.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';
import { tryAuth } from '../_lib/auth.js';
import { query, queryOne } from '../_lib/db.js';
import { assertClientAccess } from '../_lib/access.js';
import { logAIUsage, estimateTokens } from '../_lib/shared/ai-usage.js';
import { generateEmbedding, toVectorLiteral } from '../_lib/shared/embeddings.js';
import {
  CONTENT_TYPE_MAP,
  CONTENT_FORMAT_KEYWORDS,
} from '../_lib/shared/format-constants.js';
import { getFormatRules } from '../_lib/shared/format-rules.js';
import { loadAndBuildFormatPrompt } from '../_lib/shared/format-standards.js';
import {
  ToolRegistry,
  runToolLoop,
  createKAIEmitter,
  echoTool,
  webSearchTool,
  delegateToSubAgentTool,
  createContentTool,
  createViralCarouselTool,
  editContentTool,
  listPendingApprovalsTool,
  getClientContextTool,
  searchLibraryTool,
  publishNowTool,
  scheduleForTool,
  connectAccountTool,
  getMetricsTool,
  createTeamTaskTool,
  saveToLibraryTool,
  createAutomationTool,
  listAutomationsTool,
  toggleAutomationTool,
  updateClientTool,
  searchRefsTool,
  listClientsTool,
  createClientTool,
  addToPlanningTool,
  getPostTranscriptionTool,
  getPlanningItemTool,
  getRecentPerformanceTool,
  // READ agregadores (2026-05-16)
  getWorkspaceMembersTool,
  getBrandAssetsTool,
  getVoiceProfileTool,
  getIntegrationsStatusTool,
  getAuditLogTool,
  getReferencesTool,
  getWorkflowsTool,
  getNotificationsTool,
  getRecentActivityTool,
  getUIStateTool,
  // WRITE / EDIT (2026-05-16)
  editTaskTool,
  updateWorkflowTool,
  addWorkspaceMemberTool,
  removeWorkspaceMemberTool,
  updateMemberRoleTool,
  updateBrandAssetsTool,
  updateVoiceProfileTool,
  addReferenceTool,
  editReferenceTool,
  updateClientSettingsTool,
  // DELETE (2026-05-16)
  deleteContentTool,
  deleteTaskTool,
  deletePlanningItemTool,
  deleteReferenceTool,
  deleteAutomationTool,
  type ToolExecutionContext,
} from '../_lib/kai-chat-tools/index.js';

// ============================================
// CONSTANTS
// ============================================
const MAX_IDENTITY_GUIDE_LENGTH = 8000;
const MAX_CITED_CONTENT_LENGTH = 12000;
const MAX_HISTORY_MESSAGES = 15;
const MAX_METRICS_CONTEXT_LENGTH = 8000;
const MAX_LIBRARY_EXAMPLE_LENGTH = 1500;
const MAX_REFERENCE_LENGTH = 1000;

// ============================================
// TYPES
// ============================================
interface Citation {
  id: string;
  type: 'content' | 'reference' | 'format';
  title: string;
}

interface HistoryMessage {
  role: 'user' | 'assistant';
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
  internalServiceAuth?: boolean;
  userId?: string;
  stream?: boolean;
  useTools?: boolean;
  forceTool?: { name: string; args: Record<string, unknown> };
}

interface UserInstructions {
  skipImages: boolean;
  useOnlyUrl: boolean;
  noEmojis: boolean;
  useCoverImage: boolean;
}

interface DateRange {
  start: string;
  end: string;
}

type MetricFocus = 'likes' | 'engagement' | 'reach' | 'comments' | 'saves' | 'shares';

interface ComparisonResult {
  isComparison: boolean;
  period1: DateRange | null;
  period2: DateRange | null;
  period1Label: string;
  period2Label: string;
}

interface ImageGenerationResult {
  isRequest: boolean;
  prompt: string;
}

interface PlanningIntent {
  isPlanning: boolean;
  action: 'create' | 'schedule' | 'distribute' | null;
  quantity: number;
  platform: string | null;
  specificDate: string | null;
  sourceUrl: string | null;
  topic: string | null;
  missingInfo: string[];
  isFollowUp?: boolean;
  analyzeFirst?: boolean;
  analyzeSource?: 'youtube' | 'instagram' | 'linkedin' | 'all';
}

interface ContentCreationResult {
  isContentCreation: boolean;
  detectedFormat: string | null;
}

// ============================================
// USER INSTRUCTIONS
// ============================================
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
  if (instructions.skipImages)
    lines.push('⛔ INSTRUÇÃO DO USUÁRIO (PRIORIDADE MÁXIMA): NÃO inclua nem sugira imagens. Gere APENAS texto.');
  if (instructions.noEmojis)
    lines.push('⛔ INSTRUÇÃO DO USUÁRIO (PRIORIDADE MÁXIMA): ZERO emojis no conteúdo. Nem mesmo no CTA final.');
  if (instructions.useOnlyUrl)
    lines.push('⛔ INSTRUÇÃO DO USUÁRIO (PRIORIDADE MÁXIMA): Use APENAS a URL do conteúdo, sem imagem.');
  if (instructions.useCoverImage)
    lines.push('⛔ INSTRUÇÃO DO USUÁRIO (PRIORIDADE MÁXIMA): Use apenas a imagem de capa, sem outras imagens.');
  return lines.length > 0 ? `\n${lines.join('\n')}\n` : '';
}

// ============================================
// INTENT DETECTION
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
  return patterns.some((p) => p.test(message));
}

function isReportRequest(message: string): boolean {
  const patterns = [
    /gerar?\s+relat[oó]rio/i, /criar?\s+relat[oó]rio/i, /fazer?\s+relat[oó]rio/i,
    /an[aá]lise\s+completa/i, /report\s+completo/i,
    /relat[oó]rio\s+de\s+performance/i, /relat[oó]rio\s+de\s+m[eé]tricas/i,
    /resumo\s+de\s+performance/i, /overview\s+completo/i,
  ];
  return patterns.some((p) => p.test(message));
}

function isWebSearchQuery(message: string): boolean {
  const patterns = [
    /pesquise?\s+(sobre|por)/i, /busque?\s+(sobre|por)/i, /procure?\s+(sobre|por)/i,
    /o\s+que\s+[eé]/i, /quem\s+[eé]/i, /not[ií]cias\s+(sobre|de)/i,
    /tend[eê]ncias?\s+(de|em|sobre)/i, /atualiza[cç][oõ]es?\s+(sobre|de)/i,
    /me\s+conte\s+sobre/i, /me\s+fale\s+sobre/i,
  ];
  return patterns.some((p) => p.test(message));
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
  return patterns.some((p) => p.test(message));
}

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
  return patterns.some((p) => p.test(message));
}

function getPlatformEmoji(platform: string): string {
  const emojis: Record<string, string> = {
    instagram: '📸', twitter: '🐦', linkedin: '💼',
    youtube: '🎬', newsletter: '📧', tiktok: '🎵',
  };
  return emojis[platform?.toLowerCase()] || '📱';
}

function detectPlanningIntentFromContext(
  message: string,
  history?: HistoryMessage[],
): PlanningIntent | null {
  if (!history || history.length === 0) return null;
  const lastAssistant = history.filter((h) => h.role === 'assistant').pop();
  if (!lastAssistant) return null;

  const wasPlanningQuestion =
    lastAssistant.content.includes('Para qual plataforma') ||
    lastAssistant.content.includes('Para qual data') ||
    lastAssistant.content.includes('Sobre qual tema') ||
    lastAssistant.content.includes('qual rede social') ||
    lastAssistant.content.includes('quando você gostaria');

  if (!wasPlanningQuestion) return null;

  const lowerMessage = message.toLowerCase().trim();
  const result: PlanningIntent = {
    isPlanning: true, action: 'create', quantity: 1,
    platform: null, specificDate: null, sourceUrl: null,
    topic: null, missingInfo: [], isFollowUp: true,
  };

  const platforms: Record<string, string> = {
    instagram: 'instagram', insta: 'instagram', twitter: 'twitter',
    x: 'twitter', linkedin: 'linkedin', youtube: 'youtube',
    newsletter: 'newsletter', tiktok: 'tiktok',
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

  if (!result.isPlanning) {
    for (const pattern of analyzeAndPlanPatterns) {
      if (pattern.test(lowerMessage)) {
        result.isPlanning = true;
        result.analyzeFirst = true;
        break;
      }
    }
  }

  if (result.isPlanning && !result.analyzeFirst) {
    const hasAnalyzeKeywords = /analis[ea]|com\s+base|baseado|melhores?|top\s+\d*\s*(conte[uú]dos?|v[ií]deos?|posts?)|performance|m[eé]tricas?/i.test(lowerMessage);
    if (hasAnalyzeKeywords) result.analyzeFirst = true;
  }

  if (result.analyzeFirst) {
    if (/youtube|v[ií]deos?/i.test(lowerMessage)) result.analyzeSource = 'youtube';
    else if (/instagram|insta|posts?\s+do\s+insta/i.test(lowerMessage)) result.analyzeSource = 'instagram';
    else if (/linkedin/i.test(lowerMessage)) result.analyzeSource = 'linkedin';
    else result.analyzeSource = 'all';
  }

  if (!result.isPlanning) return result;

  if (/distribu(ir|a)|ao\s+longo|semana/i.test(lowerMessage)) result.action = 'distribute';
  else if (/agendar|programar|para\s+(o\s+)?(dia|data)/i.test(lowerMessage)) result.action = 'schedule';
  else result.action = 'create';

  const quantityMatch = lowerMessage.match(/(\d+)\s*(cards?|posts?|tweets?|conte[uú]dos?|carross[eé]is?|reels?)/i);
  if (quantityMatch) result.quantity = parseInt(quantityMatch[1]);

  const platforms: Record<string, string> = {
    instagram: 'instagram', insta: 'instagram', twitter: 'twitter',
    x: 'twitter', tweet: 'twitter', linkedin: 'linkedin',
    youtube: 'youtube', newsletter: 'newsletter', tiktok: 'tiktok',
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
    domingo: 0, segunda: 1, terça: 2, terca: 2,
    quarta: 3, quinta: 4, sexta: 5, sábado: 6, sabado: 6,
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

  if (!result.platform) result.missingInfo.push('plataforma');
  if (!result.specificDate && result.action === 'schedule') result.missingInfo.push('data');

  return result;
}

const contentFormats = CONTENT_FORMAT_KEYWORDS;

function detectImplicitFormat(message: string, history?: HistoryMessage[]): string | null {
  if (!history || history.length === 0) return null;
  const recentHistory = history.slice(-5);
  for (const msg of recentHistory.reverse()) {
    const content = msg.content.toLowerCase();
    for (const [format, keywords] of Object.entries(contentFormats)) {
      if (keywords.some((k) => content.includes(k))) return format;
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

  const hasCreationIntent = creationPatterns.some((p) => p.test(lowerMessage));
  if (!hasCreationIntent) return { isContentCreation: false, detectedFormat: null };

  for (const [format, keywords] of Object.entries(contentFormats)) {
    if (keywords.some((k) => lowerMessage.includes(k))) return { isContentCreation: true, detectedFormat: format };
  }

  if (/conte[uú]do|conteudo|texto|copy/i.test(lowerMessage)) {
    const implicitFormat = detectImplicitFormat(message, history);
    return { isContentCreation: true, detectedFormat: implicitFormat };
  }

  return { isContentCreation: false, detectedFormat: null };
}

function isImageGenerationRequest(message: string): ImageGenerationResult {
  const patterns = [
    /gera(r|ndo)?\s*(uma?)?\s*imagem/i, /cria(r|ndo)?\s*(uma?)?\s*imagem/i,
    /@imagem\s*/i, /fazer?\s*(uma?)?\s*(arte|visual|imagem)/i,
    /crie?\s*(uma?)?\s*foto/i, /desenhar?\s*(uma?)?/i, /ilustra[cç][aã]o/i,
  ];
  for (const pattern of patterns) {
    if (pattern.test(message)) {
      const prompt = message.replace(pattern, '').replace(/^[\s:,]+/, '').trim() || message;
      return { isRequest: true, prompt };
    }
  }
  return { isRequest: false, prompt: '' };
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
      let period1Str = '', period2Str = '';
      if (pattern.source.includes('entre')) { period1Str = match[1]; period2Str = match[2]; }
      else if (pattern.source.includes('compare')) { period1Str = match[1]; period2Str = match[3]; }
      else if (pattern.source.includes('compara')) { period1Str = match[1]; period2Str = match[3]; }
      else { period1Str = match[1]; period2Str = match[2]; }

      const period1 = extractDateRangeFromText(period1Str);
      const period2 = extractDateRangeFromText(period2Str);
      if (period1 && period2) {
        return { isComparison: true, period1, period2, period1Label: period1Str.trim(), period2Label: period2Str.trim() };
      }
    }
  }
  return { isComparison: false, period1: null, period2: null, period1Label: '', period2Label: '' };
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

function formatDateBR(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

// ============================================
// CONTEXT FETCHING (Neon SQL)
// ============================================
async function fetchLibraryExamples(
  clientId: string,
  contentType: string | null,
  limit: number = 5,
): Promise<string> {
  const dbContentType = contentType ? CONTENT_TYPE_MAP[contentType] : null;
  let examples: any[] = [];

  if (dbContentType) {
    const favoriteExamples = await query<any>(
      `SELECT id, title, content, content_type, is_favorite, metadata, created_at
         FROM client_content_library
        WHERE client_id = $1 AND content_type = $2 AND is_favorite = true
        ORDER BY created_at DESC LIMIT 3`,
      [clientId, dbContentType],
    );
    if (favoriteExamples.length > 0) examples = favoriteExamples;
  }

  if (examples.length < 3) {
    const existingIds = examples.map((e) => e.id);
    const idFilter = existingIds.length > 0 ? ' AND id <> ALL($2::uuid[])' : '';
    const params: any[] = [clientId];
    if (existingIds.length > 0) params.push(existingIds);
    const moreFavorites = await query<any>(
      `SELECT id, title, content, content_type, is_favorite, metadata, created_at
         FROM client_content_library
        WHERE client_id = $1 AND is_favorite = true${idFilter}
        ORDER BY created_at DESC LIMIT $${params.length + 1}`,
      [...params, 3 - examples.length],
    );
    if (moreFavorites.length > 0) examples = [...examples, ...moreFavorites];
  }

  if (examples.length < limit && dbContentType) {
    const existingIds = examples.map((e) => e.id);
    const idFilter = existingIds.length > 0 ? ' AND id <> ALL($3::uuid[])' : '';
    const params: any[] = [clientId, dbContentType];
    if (existingIds.length > 0) params.push(existingIds);
    const recentExamples = await query<any>(
      `SELECT id, title, content, content_type, is_favorite, metadata, created_at
         FROM client_content_library
        WHERE client_id = $1 AND content_type = $2${idFilter}
        ORDER BY created_at DESC LIMIT $${params.length + 1}`,
      [...params, limit - examples.length],
    );
    if (recentExamples.length > 0) examples = [...examples, ...recentExamples];
  }

  if (examples.length < 2) {
    const existingIds = examples.map((e) => e.id);
    const idFilter = existingIds.length > 0 ? ' AND id <> ALL($2::uuid[])' : '';
    const params: any[] = [clientId];
    if (existingIds.length > 0) params.push(existingIds);
    const fallbackExamples = await query<any>(
      `SELECT id, title, content, content_type, is_favorite, metadata, created_at
         FROM client_content_library
        WHERE client_id = $1${idFilter}
        ORDER BY created_at DESC LIMIT 3`,
      params,
    );
    if (fallbackExamples.length > 0) examples = [...examples, ...fallbackExamples];
  }

  if (examples.length === 0) return '';

  examples = await enrichWithMetrics(clientId, examples);

  let context = `\n## 📚 Exemplos da Biblioteca de Conteúdo (SIGA ESTE ESTILO E ESTRUTURA)\n`;
  context += `*Estes são conteúdos reais do cliente. REPLIQUE o tom, estrutura e abordagem.*\n`;

  examples.forEach((ex: any, i: number) => {
    const favIcon = ex.is_favorite ? '⭐ ' : '';
    const metricsLabel = ex.engagement_rate
      ? ` [📈 ${ex.engagement_rate.toFixed(2)}% engajamento]`
      : ex.likes ? ` [${ex.likes} likes]` : '';
    const truncatedContent = ex.content?.substring(0, MAX_LIBRARY_EXAMPLE_LENGTH) || '';
    const ellipsis = ex.content?.length > MAX_LIBRARY_EXAMPLE_LENGTH ? '...' : '';
    context += `\n### ${favIcon}Exemplo ${i + 1}: ${ex.title} (${ex.content_type})${metricsLabel}\n`;
    context += `${truncatedContent}${ellipsis}\n`;
  });

  return context;
}

async function enrichWithMetrics(clientId: string, examples: any[]): Promise<any[]> {
  if (examples.length === 0) return examples;

  const instaPosts = await query<any>(
    `SELECT caption, full_content, engagement_rate, likes, posted_at
       FROM instagram_posts
      WHERE client_id = $1
      ORDER BY engagement_rate DESC NULLS LAST
      LIMIT 30`,
    [clientId],
  );

  if (instaPosts.length === 0) return examples;

  return examples.map((ex) => {
    const exTitle = (ex.title || '').toLowerCase().substring(0, 40);
    const exContent = (ex.content || '').toLowerCase().substring(0, 100);

    const matchingPost = instaPosts.find((p: any) => {
      const caption = (p.caption || '').toLowerCase();
      const fullContent = (p.full_content || '').toLowerCase();
      if (exTitle.length > 10 && (caption.includes(exTitle) || fullContent.includes(exTitle))) return true;
      if (exContent.length > 30) {
        const contentSample = exContent.substring(0, 50);
        if (caption.includes(contentSample) || fullContent.includes(contentSample)) return true;
      }
      return false;
    });

    return matchingPost
      ? { ...ex, engagement_rate: matchingPost.engagement_rate, likes: matchingPost.likes }
      : ex;
  });
}

async function fetchReferenceExamples(
  clientId: string,
  referenceType: string | null,
  limit: number = 3,
): Promise<string> {
  const dbReferenceType = referenceType ? CONTENT_TYPE_MAP[referenceType] : null;

  let refs: any[];
  if (dbReferenceType) {
    refs = await query<any>(
      `SELECT title, content, reference_type, source_url
         FROM client_reference_library
        WHERE client_id = $1 AND reference_type = $2
        ORDER BY created_at DESC LIMIT $3`,
      [clientId, dbReferenceType, limit],
    );
  } else {
    refs = await query<any>(
      `SELECT title, content, reference_type, source_url
         FROM client_reference_library
        WHERE client_id = $1
        ORDER BY created_at DESC LIMIT $2`,
      [clientId, limit],
    );
  }

  if (refs.length === 0) {
    if (dbReferenceType) {
      const fallbackRefs = await query<any>(
        `SELECT title, content, reference_type, source_url
           FROM client_reference_library
          WHERE client_id = $1
          ORDER BY created_at DESC LIMIT 2`,
        [clientId],
      );
      if (fallbackRefs.length > 0) {
        let context = `\n## 🎯 Referências Salvas (inspiração e benchmarks)\n`;
        fallbackRefs.forEach((ref: any, i: number) => {
          const truncatedContent = ref.content?.substring(0, MAX_REFERENCE_LENGTH) || '';
          context += `\n### Referência ${i + 1}: ${ref.title}\n${truncatedContent}\n`;
          if (ref.source_url) context += `Fonte: ${ref.source_url}\n`;
        });
        return context;
      }
    }
    return '';
  }

  let context = `\n## 🎯 Referências do Cliente (inspiração e benchmarks)\n`;
  refs.forEach((ref: any, i: number) => {
    const truncatedContent = ref.content?.substring(0, MAX_REFERENCE_LENGTH) || '';
    context += `\n### Referência ${i + 1}: ${ref.title} (${ref.reference_type})\n${truncatedContent}\n`;
    if (ref.source_url) context += `Fonte: ${ref.source_url}\n`;
  });
  return context;
}

async function fetchMetricsContext(
  clientId: string,
  dateRange?: DateRange | null,
  metricFocus?: MetricFocus,
  isSpecificQuery?: boolean,
): Promise<string> {
  const queryStart = dateRange?.start || (() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  })();
  const queryEnd = dateRange?.end || new Date().toISOString().split('T')[0];

  const orderColumn =
    metricFocus === 'engagement' ? 'engagement_rate' :
    metricFocus === 'reach' ? 'reach' :
    metricFocus === 'comments' ? 'comments' :
    metricFocus === 'saves' ? 'saves' :
    metricFocus === 'shares' ? 'shares' : 'likes';

  const postsLimit = isSpecificQuery ? 10 : 20;
  const queryEndTs = `${queryEnd}T23:59:59Z`;

  const [metrics, instaPosts, twitterData, linkedinPosts, youtubeVideos] = await Promise.all([
    query<any>(
      `SELECT * FROM platform_metrics
        WHERE client_id = $1 AND metric_date >= $2 AND metric_date <= $3
        ORDER BY metric_date DESC LIMIT 60`,
      [clientId, queryStart, queryEnd],
    ),
    query<any>(
      `SELECT id, caption, full_content, video_transcript, likes, comments, saves, shares,
              reach, impressions, engagement_rate, posted_at, post_type, permalink
         FROM instagram_posts
        WHERE client_id = $1 AND posted_at >= $2 AND posted_at <= $3
        ORDER BY ${orderColumn} DESC NULLS LAST LIMIT $4`,
      [clientId, queryStart, queryEndTs, postsLimit],
    ),
    query<any>(
      `SELECT tweet_text, tweet_metrics, tweet_created_at, author_username, status
         FROM engagement_opportunities
        WHERE client_id = $1
        ORDER BY created_at DESC LIMIT 10`,
      [clientId],
    ),
    query<any>(
      `SELECT id, content, full_content, likes, comments, shares, impressions,
              engagement_rate, posted_at, post_url
         FROM linkedin_posts
        WHERE client_id = $1 AND posted_at >= $2 AND posted_at <= $3
        ORDER BY likes DESC NULLS LAST LIMIT $4`,
      [clientId, queryStart, queryEndTs, postsLimit],
    ),
    query<any>(
      `SELECT id, title, total_views, likes, comments, published_at, duration_seconds,
              impressions, click_rate, subscribers_gained, watch_hours, transcript
         FROM youtube_videos
        WHERE client_id = $1
        ORDER BY total_views DESC NULLS LAST LIMIT $2`,
      [clientId, postsLimit],
    ),
  ]).catch((e) => {
    console.error('[fetchMetricsContext] error:', e);
    return [[], [], [], [], []];
  });

  if (
    metrics.length === 0 && instaPosts.length === 0 &&
    linkedinPosts.length === 0 && youtubeVideos.length === 0
  ) {
    return `\n## Dados de Performance\nNenhum dado encontrado para o período de ${queryStart} a ${queryEnd}.\n`;
  }

  const periodLabel = dateRange
    ? `${formatDateBR(queryStart)} a ${formatDateBR(queryEnd)}`
    : 'Últimos 30 dias';

  let context = `\n## Dados de Performance do Cliente (${periodLabel})\n`;

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
      context += `- Inscritos: ${current.toLocaleString('pt-BR')} (${growth >= 0 ? '+' : ''}${growth.toLocaleString('pt-BR')} no período)\n`;
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

  if (instaPosts.length > 0) {
    const avgLikes = instaPosts.reduce((sum: number, p: any) => sum + (p.likes || 0), 0) / instaPosts.length;
    const avgEngagement = instaPosts.reduce((sum: number, p: any) => sum + (p.engagement_rate || 0), 0) / instaPosts.length;

    context += `\n### Posts do Instagram (${instaPosts.length} posts)\n`;
    context += `**Médias:** ${Math.round(avgLikes).toLocaleString('pt-BR')} likes | ${avgEngagement.toFixed(2)}% eng\n`;

    if (isSpecificQuery) {
      const metricLabel =
        metricFocus === 'engagement' ? 'Engajamento' :
        metricFocus === 'reach' ? 'Alcance' :
        metricFocus === 'comments' ? 'Comentários' :
        metricFocus === 'saves' ? 'Salvamentos' :
        metricFocus === 'shares' ? 'Compartilhamentos' : 'Likes';
      context += `\n**Ranking por ${metricLabel}:**\n`;
      instaPosts.forEach((p: any, i: number) => {
        const metricValue =
          metricFocus === 'engagement' ? p.engagement_rate?.toFixed(2) + '%' :
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
        const caption = p.caption?.substring(0, 80) || 'Sem legenda';
        const postDate = p.posted_at ? formatDateBR(p.posted_at.split('T')[0]) : '';
        context += `${i + 1}. ${caption}${p.caption?.length > 80 ? '...' : ''}\n`;
        context += `   📊 ${(p.likes || 0).toLocaleString('pt-BR')} likes | ${p.engagement_rate?.toFixed(2) || 0}% eng | ${postDate}\n`;
      });
    }
  }

  if (linkedinPosts.length > 0) {
    const avgLikes = linkedinPosts.reduce((sum: number, p: any) => sum + (p.likes || 0), 0) / linkedinPosts.length;
    context += `\n### Posts do LinkedIn (${linkedinPosts.length} posts)\n`;
    context += `**Média:** ${Math.round(avgLikes).toLocaleString('pt-BR')} likes\n`;
    context += `\n**Top 5:**\n`;
    linkedinPosts.slice(0, 5).forEach((p: any, i: number) => {
      const content = (p.full_content || p.content || '').substring(0, 80);
      const postDate = p.posted_at ? formatDateBR(p.posted_at.split('T')[0]) : '';
      context += `${i + 1}. ${content}${content.length >= 80 ? '...' : ''}\n`;
      context += `   📊 ${(p.likes || 0).toLocaleString('pt-BR')} likes | ${p.comments || 0} comments | ${p.engagement_rate?.toFixed(2) || 0}% eng | ${postDate}\n`;
    });
  }

  if (twitterData.length > 0) {
    context += `\n### Twitter/X - Oportunidades de Engajamento Recentes (${twitterData.length})\n`;
    twitterData.slice(0, 5).forEach((t: any, i: number) => {
      context += `${i + 1}. @${t.author_username}: ${t.tweet_text?.substring(0, 100) || ''}${t.tweet_text?.length > 100 ? '...' : ''}\n`;
      context += `   Status: ${t.status || 'pending'}\n`;
    });
  }

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

async function fetchComparisonContext(
  clientId: string,
  period1: DateRange,
  period2: DateRange,
  period1Label: string,
  period2Label: string,
): Promise<string> {
  const [posts1, posts2, li1, li2] = await Promise.all([
    query<any>(
      `SELECT likes, comments, saves, shares, reach, impressions, engagement_rate
         FROM instagram_posts
        WHERE client_id = $1 AND posted_at >= $2 AND posted_at <= $3`,
      [clientId, period1.start, `${period1.end}T23:59:59Z`],
    ),
    query<any>(
      `SELECT likes, comments, saves, shares, reach, impressions, engagement_rate
         FROM instagram_posts
        WHERE client_id = $1 AND posted_at >= $2 AND posted_at <= $3`,
      [clientId, period2.start, `${period2.end}T23:59:59Z`],
    ),
    query<any>(
      `SELECT likes, comments, shares, impressions, engagement_rate
         FROM linkedin_posts
        WHERE client_id = $1 AND posted_at >= $2 AND posted_at <= $3`,
      [clientId, period1.start, `${period1.end}T23:59:59Z`],
    ),
    query<any>(
      `SELECT likes, comments, shares, impressions, engagement_rate
         FROM linkedin_posts
        WHERE client_id = $1 AND posted_at >= $2 AND posted_at <= $3`,
      [clientId, period2.start, `${period2.end}T23:59:59Z`],
    ),
  ]).catch((e) => {
    console.error('[fetchComparisonContext] error:', e);
    return [[], [], [], []];
  });

  const calcAggregates = (posts: any[]) => {
    if (posts.length === 0) return { posts: 0, likes: 0, comments: 0, saves: 0, shares: 0, reach: 0, engagement: 0 };
    return {
      posts: posts.length,
      likes: posts.reduce((s, p) => s + (p.likes || 0), 0),
      comments: posts.reduce((s, p) => s + (p.comments || 0), 0),
      saves: posts.reduce((s, p) => s + (p.saves || 0), 0),
      shares: posts.reduce((s, p) => s + (p.shares || 0), 0),
      reach: posts.reduce((s, p) => s + (p.reach || 0), 0),
      engagement: posts.reduce((s, p) => s + (p.engagement_rate || 0), 0) / posts.length,
    };
  };

  const calcChange = (val1: number, val2: number): string => {
    if (val2 === 0) return val1 > 0 ? '+100%' : '0%';
    const change = ((val1 - val2) / val2) * 100;
    return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
  };
  const changeEmoji = (val1: number, val2: number): string =>
    val1 > val2 ? '📈' : val1 < val2 ? '📉' : '➡️';

  let context = `\n## Comparativo: ${period1Label} vs ${period2Label}\n`;

  const iAgg1 = calcAggregates(posts1);
  const iAgg2 = calcAggregates(posts2);
  if (iAgg1.posts > 0 || iAgg2.posts > 0) {
    context += `\n### Instagram\n| Métrica | ${period1Label} | ${period2Label} | Variação |\n|---------|---|---|---|\n`;
    context += `| Posts | ${iAgg1.posts} | ${iAgg2.posts} | ${calcChange(iAgg1.posts, iAgg2.posts)} ${changeEmoji(iAgg1.posts, iAgg2.posts)} |\n`;
    context += `| Likes | ${iAgg1.likes.toLocaleString('pt-BR')} | ${iAgg2.likes.toLocaleString('pt-BR')} | ${calcChange(iAgg1.likes, iAgg2.likes)} ${changeEmoji(iAgg1.likes, iAgg2.likes)} |\n`;
    context += `| Engajamento | ${iAgg1.engagement.toFixed(2)}% | ${iAgg2.engagement.toFixed(2)}% | ${calcChange(iAgg1.engagement, iAgg2.engagement)} ${changeEmoji(iAgg1.engagement, iAgg2.engagement)} |\n`;
  }

  const lAgg1 = calcAggregates(li1);
  const lAgg2 = calcAggregates(li2);
  if (lAgg1.posts > 0 || lAgg2.posts > 0) {
    context += `\n### LinkedIn\n| Métrica | ${period1Label} | ${period2Label} | Variação |\n|---------|---|---|---|\n`;
    context += `| Posts | ${lAgg1.posts} | ${lAgg2.posts} | ${calcChange(lAgg1.posts, lAgg2.posts)} |\n`;
    context += `| Likes | ${lAgg1.likes.toLocaleString('pt-BR')} | ${lAgg2.likes.toLocaleString('pt-BR')} | ${calcChange(lAgg1.likes, lAgg2.likes)} |\n`;
  }

  return context;
}

async function performWebSearch(query: string): Promise<string | null> {
  const GROK_API_KEY = process.env.GROK_API_KEY;
  if (!GROK_API_KEY) return null;
  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${GROK_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'grok-beta',
        messages: [
          { role: 'system', content: 'Você é um assistente de pesquisa. Forneça informações atualizadas, precisas e bem fundamentadas. Seja conciso e objetivo.' },
          { role: 'user', content: query },
        ],
        temperature: 0.7,
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const result = data.choices?.[0]?.message?.content;
    return result ? `\n## Informações da Pesquisa Web\n${result}\n` : null;
  } catch {
    return null;
  }
}

async function generateImage(
  prompt: string,
  clientName: string,
): Promise<{ imageData?: string; text?: string; error?: string }> {
  const GOOGLE_API_KEY = process.env.GOOGLE_AI_STUDIO_API_KEY;
  if (!GOOGLE_API_KEY) return { error: 'GOOGLE_AI_STUDIO_API_KEY não configurada' };
  try {
    const enhancedPrompt = `Create a professional, high-quality image for ${clientName}. The image should be: ${prompt} Style: Modern, clean, professional. No text or watermarks.`;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: enhancedPrompt }] }],
          generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
        }),
      },
    );
    if (!response.ok) {
      const errText = await response.text();
      console.error('[kai-simple-chat] Gemini image error:', response.status, errText);
      return { error: 'Erro ao gerar imagem. Tente novamente.' };
    }
    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    let imageData: string | undefined;
    let text = '';
    for (const p of parts) {
      if (p.inlineData?.data) {
        const mime = p.inlineData.mimeType || 'image/png';
        imageData = `data:${mime};base64,${p.inlineData.data}`;
      } else if (p.text) {
        text += p.text;
      }
    }
    if (!imageData) return { error: 'Não foi possível gerar a imagem.' };
    return { imageData, text: text || 'Imagem gerada! 🎨' };
  } catch (e) {
    console.error('[kai-simple-chat] Image gen exception:', e);
    return { error: 'Erro ao gerar imagem. Tente novamente.' };
  }
}

// ============================================
// PLANNING HELPERS
// ============================================
function buildPlanningQuestionPrompt(intent: PlanningIntent, clientName: string): string {
  const questions: string[] = [];
  if (!intent.platform) questions.push('📱 **Para qual plataforma?** (Instagram, Twitter, LinkedIn, YouTube, Newsletter, TikTok)');
  if (!intent.specificDate && intent.action === 'schedule') questions.push('📅 **Para qual data?**');
  if (!intent.topic && !intent.sourceUrl) questions.push('📝 **Sobre qual tema ou assunto?**');
  let response = `Vou criar ${intent.quantity > 1 ? `${intent.quantity} cards` : 'o card'} no planejamento para **${clientName}**! ✨\n\nPreciso de algumas informações:\n\n`;
  response += questions.join('\n\n');
  response += '\n\n*Responda com as informações que faltam para eu criar os cards.*';
  return response;
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

async function generatePlanningCards(
  client: any,
  clientId: string,
  workspaceId: string,
  userId: string,
  intent: PlanningIntent,
  internalBaseUrl: string,
  accessToken: string,
  userInstructions?: UserInstructions,
): Promise<any[]> {
  const GOOGLE_API_KEY = process.env.GOOGLE_AI_STUDIO_API_KEY;

  if (!workspaceId) throw new Error('Cliente não está associado a um workspace');

  const columns = await query<{ id: string }>(
    `SELECT id FROM kanban_columns WHERE workspace_id = $1 ORDER BY position ASC LIMIT 1`,
    [workspaceId],
  );
  if (columns.length === 0) throw new Error('Nenhuma coluna de planejamento configurada.');
  const columnId = columns[0].id;
  const cards: any[] = [];

  let dates: string[] = [];
  if (intent.action === 'distribute') dates = distributeAcrossWeek(intent.quantity);
  else if (intent.specificDate) dates = Array(intent.quantity).fill(intent.specificDate);

  let urlContext = '';
  if (intent.sourceUrl) {
    try {
      if (intent.sourceUrl.includes('youtube.com') || intent.sourceUrl.includes('youtu.be')) {
        const r = await fetch(`${internalBaseUrl}/api/extract-youtube`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ url: intent.sourceUrl }),
        });
        if (r.ok) {
          const ytData: any = await r.json().catch(() => ({}));
          if (ytData?.transcript) {
            urlContext = `Título: ${ytData.title || ''}\nTranscrição: ${ytData.transcript.substring(0, 3000)}`;
          }
        }
      } else {
        const r = await fetch(`${internalBaseUrl}/api/firecrawl-scrape`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ url: intent.sourceUrl }),
        });
        if (r.ok) {
          const scrapeData: any = await r.json().catch(() => ({}));
          if (scrapeData?.data?.markdown) {
            urlContext = scrapeData.data.markdown.substring(0, 3000);
          }
        }
      }
    } catch (e) {
      console.warn('[generatePlanningCards] urlContext fetch failed:', e);
    }
  }

  let metricsAnalysisContext = '';
  if (intent.analyzeFirst) {
    const fetchPromises: Promise<any>[] = [];

    if (intent.analyzeSource === 'youtube' || intent.analyzeSource === 'all') {
      fetchPromises.push(
        query<any>(
          `SELECT title, total_views, likes, comments, published_at, duration_seconds,
                  click_rate, subscribers_gained, watch_hours, transcript
             FROM youtube_videos
            WHERE client_id = $1
            ORDER BY total_views DESC NULLS LAST LIMIT 30`,
          [clientId],
        ).then((data) => ({ platform: 'youtube', data: data || [] })),
      );
    }
    if (intent.analyzeSource === 'instagram' || intent.analyzeSource === 'all') {
      fetchPromises.push(
        query<any>(
          `SELECT caption, full_content, likes, comments, saves, shares, reach,
                  engagement_rate, posted_at, post_type
             FROM instagram_posts
            WHERE client_id = $1
            ORDER BY engagement_rate DESC NULLS LAST LIMIT 30`,
          [clientId],
        ).then((data) => ({ platform: 'instagram', data: data || [] })),
      );
    }
    if (intent.analyzeSource === 'linkedin' || intent.analyzeSource === 'all') {
      fetchPromises.push(
        query<any>(
          `SELECT content, full_content, likes, comments, shares, impressions,
                  engagement_rate, posted_at
             FROM linkedin_posts
            WHERE client_id = $1
            ORDER BY likes DESC NULLS LAST LIMIT 30`,
          [clientId],
        ).then((data) => ({ platform: 'linkedin', data: data || [] })),
      );
    }

    const results = await Promise.all(fetchPromises);

    for (const result of results) {
      if (result.data.length === 0) continue;

      if (result.platform === 'youtube') {
        metricsAnalysisContext += `\n## Top ${result.data.length} Vídeos do YouTube (por views)\n`;
        result.data.forEach((v: any, i: number) => {
          const pubDate = v.published_at ? v.published_at.split('T')[0] : '';
          const duration = v.duration_seconds ? `${Math.floor(v.duration_seconds / 60)}min` : '';
          metricsAnalysisContext += `${i + 1}. "${v.title}" — ${(v.total_views || 0).toLocaleString('pt-BR')} views | ${(v.likes || 0).toLocaleString('pt-BR')} likes | ${v.comments || 0} comments | CTR: ${(v.click_rate || 0).toFixed(2)}% | ${duration} | ${pubDate}\n`;
          if (v.transcript && i < 5) metricsAnalysisContext += `   Resumo: ${v.transcript.substring(0, 200)}...\n`;
        });
      } else if (result.platform === 'instagram') {
        metricsAnalysisContext += `\n## Top ${result.data.length} Posts do Instagram (por engajamento)\n`;
        result.data.forEach((p: any, i: number) => {
          const caption = (p.full_content || p.caption || '').substring(0, 120);
          metricsAnalysisContext += `${i + 1}. ${caption}${caption.length >= 120 ? '...' : ''} — ${p.engagement_rate?.toFixed(2) || 0}% eng | ${(p.likes || 0).toLocaleString('pt-BR')} likes | Tipo: ${p.post_type || 'post'}\n`;
        });
      } else if (result.platform === 'linkedin') {
        metricsAnalysisContext += `\n## Top ${result.data.length} Posts do LinkedIn (por likes)\n`;
        result.data.forEach((p: any, i: number) => {
          const content = (p.full_content || p.content || '').substring(0, 120);
          metricsAnalysisContext += `${i + 1}. ${content}${content.length >= 120 ? '...' : ''} — ${(p.likes || 0).toLocaleString('pt-BR')} likes | ${p.comments || 0} comments\n`;
        });
      }
    }
  }

  if (GOOGLE_API_KEY && (intent.topic || urlContext || intent.analyzeFirst)) {
    const platformInstructions: Record<string, string> = {
      instagram: 'Posts para Instagram: hook forte, máximo 2200 chars, poucos emojis, estrutura clara',
      twitter: 'Tweets: MÁXIMO 280 caracteres, ZERO emojis no corpo, ZERO hashtags, gancho forte',
      linkedin: 'Posts LinkedIn: profissionais, storytelling, insights',
      youtube: 'Títulos/descrições para YouTube: SEO otimizado, títulos atrativos com hook claro',
      newsletter: 'Títulos para newsletter: valor claro, CTA forte',
      tiktok: 'Ideias para TikTok: trends, ganchos virais',
    };

    let userConstraints = '';
    if (userInstructions?.skipImages) userConstraints += '\n⛔ NÃO inclua imagens. Apenas texto.';
    if (userInstructions?.noEmojis) userConstraints += '\n⛔ ZERO emojis.';

    let analysisInstructions = '';
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
${client.identity_guide ? `\nGuia de Identidade:\n${client.identity_guide.substring(0, 1500)}` : ''}
${urlContext ? `\n## Conteúdo de Referência:\n${urlContext}` : ''}
${analysisInstructions}
${userConstraints}

TAREFA: Gere ${intent.quantity} conteúdo(s) COMPLETO(S) para ${intent.platform || 'redes sociais'}.
${intent.topic ? `Tema: ${intent.topic}` : ''}
${platformInstructions[intent.platform || 'instagram'] || ''}

Responda APENAS com JSON: { "cards": [{ "title": "título curto", "description": "CONTEÚDO COMPLETO com tópicos detalhados" }] }`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.8, maxOutputTokens: 4096 },
          }),
        },
      );

      if (response.ok) {
        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const jsonMatch = text.match(/\{[\s\S]*"cards"[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const generatedCards = parsed.cards || [];
          for (let i = 0; i < Math.min(generatedCards.length, intent.quantity); i++) {
            const genCard = generatedCards[i];
            try {
              const inserted = await query<any>(
                `INSERT INTO planning_items
                  (title, description, content, client_id, workspace_id, column_id,
                   scheduled_at, platform, status, created_by)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'todo', $9)
                 RETURNING *`,
                [
                  genCard.title, genCard.title, genCard.description,
                  clientId, workspaceId, columnId,
                  dates[i] || null, intent.platform, userId,
                ],
              );
              if (inserted[0]) cards.push(inserted[0]);
            } catch (e) {
              console.error('[generatePlanningCards] insert failed:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('[kai-simple-chat] AI generation error:', error);
    }
  }

  if (cards.length === 0) {
    for (let i = 0; i < intent.quantity; i++) {
      try {
        const inserted = await query<any>(
          `INSERT INTO planning_items
            (title, description, content, client_id, workspace_id, column_id,
             scheduled_at, platform, status, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'todo', $9)
           RETURNING *`,
          [
            intent.topic || `Card ${i + 1}`,
            intent.topic || `Card ${i + 1}`,
            intent.sourceUrl ? `Referência: ${intent.sourceUrl}` : '',
            clientId, workspaceId, columnId,
            dates[i] || intent.specificDate || null,
            intent.platform, userId,
          ],
        );
        if (inserted[0]) cards.push(inserted[0]);
      } catch (e) {
        console.error('[generatePlanningCards] fallback insert failed:', e);
      }
    }
  }

  if (cards.length === 0) throw new Error('Não foi possível criar nenhum card');
  return cards;
}

function buildPlanningSuccessMessage(cards: any[], intent: PlanningIntent): string {
  const count = cards.length;
  const platformLabel = intent.platform ? ` para **${intent.platform.charAt(0).toUpperCase() + intent.platform.slice(1)}**` : '';
  let message = `✅ **${count} ${count === 1 ? 'card criado' : 'cards criados'}${platformLabel}!**\n\n`;
  if (intent.analyzeFirst) {
    const sourceLabel =
      intent.analyzeSource === 'youtube' ? 'vídeos do YouTube' :
      intent.analyzeSource === 'instagram' ? 'posts do Instagram' :
      intent.analyzeSource === 'linkedin' ? 'posts do LinkedIn' :
      'conteúdos de todas as plataformas';
    message += `📊 **Baseado na análise dos melhores ${sourceLabel}** do cliente\n\n`;
  }
  if (intent.sourceUrl) message += `📎 Baseado em: ${intent.sourceUrl}\n\n`;
  message += '📋 **Cards adicionados ao planejamento:**\n\n';
  for (let i = 0; i < Math.min(cards.length, 10); i++) {
    const card = cards[i];
    const dateStr = card.scheduled_at ? ` | 📅 ${formatDateBR(card.scheduled_at.split('T')[0])}` : '';
    const platformIcon = card.platform ? ` | ${getPlatformEmoji(card.platform)}` : '';
    message += `${i + 1}. **${card.title}**${platformIcon}${dateStr}\n`;
  }
  if (cards.length > 10) message += `\n*...e mais ${cards.length - 10} cards*\n`;
  message += '\n---\n💡 Acesse **Planejamento** para editar ou reagendar\n';
  return message;
}

async function fetchPlanningContext(clientId: string, workspaceId: string): Promise<string> {
  const now = new Date();
  const weekFromNow = new Date(); weekFromNow.setDate(weekFromNow.getDate() + 7);

  const [pending, scheduled, overdue] = await Promise.all([
    query<any>(
      `SELECT id, title, platform, status, scheduled_at, content_type, priority
         FROM planning_items
        WHERE client_id = $1 AND workspace_id = $2 AND status = ANY($3::text[])
        ORDER BY scheduled_at ASC NULLS LAST LIMIT 20`,
      [clientId, workspaceId, ['todo', 'draft', 'review']],
    ),
    query<any>(
      `SELECT id, title, platform, status, scheduled_at, content_type
         FROM planning_items
        WHERE client_id = $1 AND workspace_id = $2 AND status = 'scheduled'
          AND scheduled_at >= $3 AND scheduled_at <= $4
        ORDER BY scheduled_at ASC LIMIT 15`,
      [clientId, workspaceId, now.toISOString(), weekFromNow.toISOString()],
    ),
    query<any>(
      `SELECT id, title, platform, status, scheduled_at
         FROM planning_items
        WHERE client_id = $1 AND workspace_id = $2 AND status = ANY($3::text[])
          AND scheduled_at < $4
        ORDER BY scheduled_at ASC LIMIT 10`,
      [clientId, workspaceId, ['todo', 'draft', 'review', 'scheduled'], now.toISOString()],
    ),
  ]).catch((e) => {
    console.error('[fetchPlanningContext] error:', e);
    return [[], [], []];
  });

  if (pending.length === 0 && scheduled.length === 0 && overdue.length === 0) {
    return '\n## 📋 Planejamento\nNenhum item no planejamento deste cliente no momento.\n';
  }

  let context = '\n## 📋 Status do Planejamento\n';

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

async function fetchVoiceAndGuidelines(clientId: string): Promise<string> {
  const client = await queryOne<any>(
    `SELECT voice_profile, content_guidelines FROM clients WHERE id = $1`,
    [clientId],
  );

  let context = '';
  if (client?.voice_profile) {
    const vp = typeof client.voice_profile === 'string'
      ? client.voice_profile
      : JSON.stringify(client.voice_profile);
    context += `\n## 🎤 Perfil de Voz do Cliente\n${vp.substring(0, 3000)}\n`;
  }

  if (client?.content_guidelines) {
    context += `\n## 📏 Diretrizes de Conteúdo\n${client.content_guidelines.substring(0, 3000)}\n`;
  }

  return context;
}

async function fetchKnowledgeContext(workspaceId: string, queryText: string): Promise<string> {
  // Semantic search em global_knowledge.embedding (vector(1536),
  // OpenAI text-embedding-3-small). Fallback ILIKE em global_knowledge se
  // a função RPC ou embedding falharem; segundo fallback em knowledge_base
  // (tabela seed do Madureira agent — mantida pra compat).
  try {
    let results: any[] = [];
    let semanticOk = false;

    // 1. Embedding via OpenAI text-embedding-3-small (1536 dims, alinha com schema).
    if (process.env.OPENAI_API_KEY) {
      try {
        const embedding = await generateEmbedding(queryText);
        results = await query<any>(
          `SELECT title, content, summary, source_url
             FROM search_knowledge_semantic($1::vector, $2::uuid, 3, 0.5)`,
          [toVectorLiteral(embedding), workspaceId],
        );
        semanticOk = true;
      } catch (e) {
        console.warn('[kai-simple-chat] semantic search failed, falling back to ILIKE:', e);
      }
    }

    // 2. Fallback ILIKE em global_knowledge (caso semantic falhe ou sem OpenAI key).
    if (!semanticOk || !results || results.length === 0) {
      const tokens = queryText
        .split(/\s+/)
        .filter((t) => t.length > 3)
        .slice(0, 3);
      if (tokens.length > 0) {
        const orClauses = tokens.map((_, i) => `(title ILIKE $${i + 2} OR content ILIKE $${i + 2})`).join(' OR ');
        const params: any[] = [workspaceId, ...tokens.map((t) => `%${t}%`)];
        try {
          results = await query<any>(
            `SELECT title, content, summary, source_url
               FROM global_knowledge
              WHERE workspace_id = $1 AND (${orClauses})
              LIMIT 3`,
            params,
          );
        } catch {
          // 3. Último fallback: knowledge_base (tabela seed do Madureira agent).
          try {
            results = await query<any>(
              `SELECT title, content, summary, source_url
                 FROM knowledge_base
                WHERE workspace_id = $1 AND (${orClauses})
                LIMIT 3`,
              params,
            );
          } catch {
            return '';
          }
        }
      }
    }

    if (!results || results.length === 0) return '';

    let context = '\n## 🧠 Base de Conhecimento do Workspace\n';
    results.forEach((r: any) => {
      context += `\n### ${r.title}\n`;
      context += `${(r.content || r.summary || '').substring(0, 1000)}\n`;
      if (r.source_url) context += `Fonte: ${r.source_url}\n`;
    });
    return context;
  } catch (err) {
    console.error('[kai-simple-chat] Knowledge search error:', err);
    return '';
  }
}

async function fetchDocumentsAndWebsites(clientId: string): Promise<string> {
  const [docs, websites] = await Promise.all([
    query<any>(
      `SELECT name, extracted_content
         FROM client_documents
        WHERE client_id = $1 AND extracted_content IS NOT NULL
        ORDER BY created_at DESC LIMIT 3`,
      [clientId],
    ),
    query<any>(
      `SELECT url, scraped_markdown
         FROM client_websites
        WHERE client_id = $1 AND scraped_markdown IS NOT NULL
        ORDER BY last_scraped_at DESC LIMIT 2`,
      [clientId],
    ),
  ]).catch((e) => {
    console.error('[fetchDocumentsAndWebsites] error:', e);
    return [[], []];
  });

  let context = '';
  if (docs.length > 0) {
    context += '\n## 📄 Documentos do Cliente\n';
    docs.forEach((doc: any) => {
      context += `\n### ${doc.name}\n${(doc.extracted_content || '').substring(0, 1500)}\n`;
    });
  }
  if (websites.length > 0) {
    context += '\n## 🌐 Conteúdo dos Sites do Cliente\n';
    websites.forEach((site: any) => {
      context += `\n### ${site.url}\n${(site.scraped_markdown || '').substring(0, 1500)}\n`;
    });
  }

  return context;
}

async function fetchCitedContent(citations?: Citation[]): Promise<string> {
  if (!citations || citations.length === 0) return '';

  const citationPromises = citations.map(async (citation) => {
    try {
      if (citation.type === 'content') {
        const data = await queryOne<any>(
          `SELECT title, content, content_type, created_at
             FROM client_content_library WHERE id = $1`,
          [citation.id],
        );
        if (data) return { type: 'content', title: data.title, content: data.content, contentType: data.content_type, createdAt: data.created_at };
      } else if (citation.type === 'reference') {
        const data = await queryOne<any>(
          `SELECT title, content, reference_type, created_at
             FROM client_reference_library WHERE id = $1`,
          [citation.id],
        );
        if (data) return { type: 'reference', title: data.title, content: data.content, contentType: data.reference_type, createdAt: data.created_at };
      } else if (citation.type === 'format') {
        const data = await queryOne<any>(
          `SELECT content, checklist FROM kai_documentation
            WHERE doc_type = 'format' AND doc_key = $1`,
          [citation.title.toLowerCase()],
        );
        if (data) return { type: 'format', title: citation.title, content: data.content, checklist: data.checklist };
      }
    } catch (e) {
      console.warn('[fetchCitedContent] citation fetch failed:', e);
    }
    return null;
  });

  const citationResults = (await Promise.all(citationPromises)).filter(Boolean) as any[];
  citationResults.sort((a, b) => {
    if (a?.createdAt && b?.createdAt) return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return 0;
  });

  let citedContent = '';
  for (const cit of citationResults) {
    if (!cit) continue;
    if (cit.type === 'format') {
      citedContent += `\n### Regras do formato ${cit.title}:\n${cit.content}\n`;
      if (cit.checklist) citedContent += `\nChecklist:\n${JSON.stringify(cit.checklist)}\n`;
    } else {
      const label = cit.type === 'content' ? 'Referência' : 'Referência externa';
      citedContent += `\n### ${label}: ${cit.title} (${cit.contentType})\n${cit.content}\n`;
    }
    if (citedContent.length >= MAX_CITED_CONTENT_LENGTH) {
      citedContent = citedContent.substring(0, MAX_CITED_CONTENT_LENGTH) + '\n[...conteúdo truncado]';
      break;
    }
  }
  return citedContent;
}

// ============================================
// SSE STREAM HELPERS (Node)
// ============================================
function setSseHeaders(res: VercelResponse) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  // Enable CORS on streaming responses too.
  applyCors(res);
}

function streamSimpleMessage(res: VercelResponse, content: string) {
  setSseHeaders(res);
  res.write(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`);
  res.write('data: [DONE]\n\n');
  res.end();
}

function streamSimpleMessageWithImage(res: VercelResponse, content: string, image: string) {
  setSseHeaders(res);
  res.write(`data: ${JSON.stringify({ choices: [{ delta: { content, image } }] })}\n\n`);
  res.write('data: [DONE]\n\n');
  res.end();
}

function getInternalBaseUrl(req: VercelRequest): string {
  if (process.env.INTERNAL_API_BASE_URL) {
    return process.env.INTERNAL_API_BASE_URL.replace(/\/$/, '');
  }
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
  const host = req.headers.host;
  if (host) return `${proto}://${host}`;
  return 'https://kai-2-topaz.vercel.app';
}

// Image fetcher → base64 (for inline image messages to Gemini)
// Limite inline do Gemini é ~20MB por request total. Pra arquivos maiores
// usar Files API (não implementado — fica como fallback no futuro).
const INLINE_IMAGE_MAX_BYTES = 18 * 1024 * 1024;

async function fetchImageAsBase64(url: string): Promise<{ mimeType: string; data: string } | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) {
      console.warn(`[kai-simple-chat] fetchImage HTTP ${r.status}: ${url.slice(0, 100)}`);
      return null;
    }
    const mime = r.headers.get('content-type') || 'image/jpeg';
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.byteLength > INLINE_IMAGE_MAX_BYTES) {
      console.warn(
        `[kai-simple-chat] image excede limite inline (${(buf.byteLength / 1024 / 1024).toFixed(1)}MB > 18MB): ${url.slice(0, 100)} — pulando`,
      );
      return null;
    }
    return { mimeType: mime, data: buf.toString('base64') };
  } catch (e) {
    console.error('[kai-simple-chat] Failed to fetch image:', url, e);
    return null;
  }
}

// ============================================
// MAIN HANDLER
// ============================================
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res);
  if (req.method !== 'POST') {
    return jsonError(res, 405, 'Method not allowed');
  }

  try {
    const body = (req.body && typeof req.body === 'object'
      ? req.body
      : (req.body ? JSON.parse(req.body) : {})) as RequestBody;

    const authHeader = (req.headers.authorization || (req.headers as any).Authorization) as string | undefined;
    let userId: string;

    if (body.internalServiceAuth && body.userId) {
      // Internal service auth: aceita Bearer com SUPABASE_SERVICE_ROLE_KEY (compat
      // com bot Telegram que ainda usa o nome antigo) OU INTERNAL_SERVICE_TOKEN.
      const expectedKey =
        process.env.INTERNAL_SERVICE_TOKEN ||
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        '';
      const expectedAuth = expectedKey ? `Bearer ${expectedKey}` : '';
      if (!expectedAuth || authHeader !== expectedAuth) {
        return jsonError(res, 401, 'Unauthorized internal call');
      }
      userId = body.userId;
    } else {
      const user = await tryAuth(req);
      if (!user) {
        return jsonError(res, 401, 'Não autorizado');
      }
      userId = user.id;
    }

    const shouldStream = body.stream !== false;
    const {
      message,
      clientId,
      imageUrls,
      citations,
      history,
      materialContext,
      materialTitle,
    } = body;

    // Defesa contra IDOR: a menos que seja chamada interna do bot (que já passou
    // pelo expected auth), validamos que o user logado pertence ao workspace do client.
    if (clientId && !body.internalServiceAuth) {
      await assertClientAccess(userId, clientId);
    }

    console.log('[kai-simple-chat] Request:', {
      userId, clientId,
      internalServiceAuth: !!body.internalServiceAuth,
      stream: shouldStream,
      imageUrlsCount: imageUrls?.length,
      citationsCount: citations?.length,
      historyCount: history?.length,
      messageLength: message?.length,
    });

    if (!clientId || !message) {
      return jsonError(res, 400, 'clientId e message são obrigatórios');
    }

    // 1. Fetch client
    const client = await queryOne<any>(
      `SELECT name, description, identity_guide, workspace_id, voice_profile, content_guidelines
         FROM clients WHERE id = $1`,
      [clientId],
    );
    if (!client) return jsonError(res, 404, 'Cliente não encontrado');

    // Lazy mode flag — quando true, pula intent regex pesado, fetches eager
    // e early returns (image/planning), deixando as 26 tools cuidarem.
    // Reduz prompt de ~30-40k chars pra ~3-5k chars (50-70% menos tokens).
    const toolsMode = !!body.useTools && shouldStream;

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

    console.log('[kai-simple-chat] Intent detection:', {
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

    const internalBaseUrl = getInternalBaseUrl(req);
    const accessToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : '';

    // Decode optional `x-kai-ui-state` header (base64-JSON) injetado pelo front
    // — snapshot da UI no momento do envio. Exposto pra `getUIState` tool via
    // `ctx.uiState`. Falhas silenciosas: header ausente / inválido = null.
    let uiState: Record<string, unknown> | null = null;
    try {
      const rawHeader = req.headers['x-kai-ui-state'];
      const headerStr = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
      if (typeof headerStr === 'string' && headerStr.length > 0 && headerStr.length <= 12_000) {
        const decoded = Buffer.from(headerStr, 'base64').toString('utf-8');
        const parsed = JSON.parse(decoded);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          uiState = parsed as Record<string, unknown>;
          console.log(
            `[kai-simple-chat] uiState received — keys=${Object.keys(uiState).length}`,
          );
        }
      }
    } catch (err) {
      console.warn(
        '[kai-simple-chat] failed to decode x-kai-ui-state header:',
        err instanceof Error ? err.message : err,
      );
    }

    // 3. Image Generation (legado — em toolsMode vira generateImage tool futura)
    if (imageGenRequest.isRequest && !toolsMode) {
      const imageResult = await generateImage(imageGenRequest.prompt, client.name);
      if (imageResult.error) {
        return jsonError(res, 500, imageResult.error);
      }
      return streamSimpleMessageWithImage(
        res,
        imageResult.text || '',
        imageResult.imageData || '',
      );
    }

    // 4. Planning Card Creation (legado — em toolsMode usar addToPlanning tool)
    if (planningIntent.isPlanning && !toolsMode) {
      if (
        planningIntent.missingInfo.length > 0 &&
        !planningIntent.sourceUrl &&
        !planningIntent.topic &&
        !planningIntent.analyzeFirst
      ) {
        const missingInfoPrompt = buildPlanningQuestionPrompt(planningIntent, client.name);
        return streamSimpleMessage(res, missingInfoPrompt);
      }

      try {
        const cards = await generatePlanningCards(
          client, clientId, client.workspace_id, userId,
          planningIntent, internalBaseUrl, accessToken, userInstructions,
        );
        const successMessage = buildPlanningSuccessMessage(cards, planningIntent);
        return streamSimpleMessage(res, successMessage);
      } catch (planningError) {
        const errorMessage = planningError instanceof Error ? planningError.message : 'Erro ao criar cards';
        return streamSimpleMessage(res, `❌ **Erro:** ${errorMessage}`);
      }
    }

    // 5. Fetch all context in parallel (modo eager — pulado em toolsMode)
    let metricsContext = '';
    let comparisonContext = '';
    let topPerformersContext = '';
    let formatRulesContext = '';
    let libraryExamplesContext = '';
    let referenceExamplesContext = '';
    let planningContext = '';
    let voiceGuidelinesContext = '';
    let knowledgeContext = '';
    let docsWebsitesContext = '';

    const contextPromises: Promise<void>[] = [];

    // Em toolsMode, as 26 tools (getClientContext/getMetrics/searchLibrary/searchRefs/etc)
    // cuidam do contexto sob demanda — pulamos os fetches eager pra economizar tokens.
    if (!toolsMode) {

    if (comparisonQuery.isComparison && comparisonQuery.period1 && comparisonQuery.period2) {
      contextPromises.push(
        fetchComparisonContext(
          clientId,
          comparisonQuery.period1,
          comparisonQuery.period2,
          comparisonQuery.period1Label,
          comparisonQuery.period2Label,
        ).then((r) => { comparisonContext = r; }),
      );
    } else if (needsMetrics || isReport || isSpecificQuery) {
      contextPromises.push(
        fetchMetricsContext(clientId, dateRange, metricFocus, isSpecificQuery)
          .then((r) => { metricsContext = r; }),
      );
    }

    if (needsPlanningRead) {
      contextPromises.push(
        fetchPlanningContext(clientId, client.workspace_id)
          .then((r) => { planningContext = r; }),
      );
    }

    if (contentCreation.isContentCreation) {
      contextPromises.push(
        fetchVoiceAndGuidelines(clientId).then((r) => { voiceGuidelinesContext = r; }),
      );
    }

    if (!contentCreation.isContentCreation && !needsMetrics && !planningIntent.isPlanning) {
      contextPromises.push(
        fetchKnowledgeContext(client.workspace_id, message).then((r) => { knowledgeContext = r; }),
      );
    }

    contextPromises.push(
      fetchDocumentsAndWebsites(clientId).then((r) => { docsWebsitesContext = r; }),
    );

    if (contentCreation.isContentCreation) {
      contextPromises.push(
        Promise.all([
          fetchLibraryExamples(clientId, contentCreation.detectedFormat, 5),
          fetchReferenceExamples(clientId, contentCreation.detectedFormat, 3),
          query<any>(
            `SELECT caption, post_type, engagement_rate, likes, full_content
               FROM instagram_posts
              WHERE client_id = $1
              ORDER BY engagement_rate DESC NULLS LAST LIMIT 5`,
            [clientId],
          ),
          Promise.resolve(contentCreation.detectedFormat ? getFormatRules(contentCreation.detectedFormat) : null),
        ]).then(([libraryResult, referenceResult, topPosts, formatDocResult]) => {
          libraryExamplesContext = libraryResult;
          referenceExamplesContext = referenceResult;
          if (topPosts && topPosts.length > 0) {
            topPerformersContext = `\n## 📊 Top Performers Instagram\n`;
            topPosts.forEach((post: any, i: number) => {
              const content = post.full_content || post.caption || '';
              topPerformersContext += `\n### Post #${i + 1} (${post.post_type || 'post'}) - ${(post.engagement_rate || 0).toFixed(2)}% eng\n`;
              topPerformersContext += `${content.substring(0, 400)}${content.length > 400 ? '...' : ''}\n`;
            });
          }
          if (formatDocResult) {
            formatRulesContext = `\n## 📋 Regras do Formato: ${contentCreation.detectedFormat?.toUpperCase()}\n${formatDocResult}\n`;
          }
        }),
      );
    }

    } // end if (!toolsMode)

    const [webSearchResult, citedContent] = await Promise.all([
      !toolsMode && needsWebSearch ? performWebSearch(message) : Promise.resolve(null),
      toolsMode ? Promise.resolve('') : fetchCitedContent(citations),
      ...contextPromises.map((p) => p),
    ]);

    // 6. Build system prompt
    const identityGuide = client.identity_guide?.substring(0, MAX_IDENTITY_GUIDE_LENGTH) || '';
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
${client.description ? `Descrição: ${client.description}` : ''}

${identityGuide ? `## Guia de Identidade\n${identityGuide}` : ''}`;

    if (voiceGuidelinesContext) systemPrompt += voiceGuidelinesContext;
    else {
      const vp = client.voice_profile;
      if (vp) {
        const vpStr = typeof vp === 'string' ? vp : JSON.stringify(vp);
        systemPrompt += `\n## 🎤 Perfil de Voz\n${vpStr.substring(0, 2000)}\n`;
      }
      if (client.content_guidelines) {
        systemPrompt += `\n## 📏 Diretrizes\n${client.content_guidelines.substring(0, 2000)}\n`;
      }
    }

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

    // Camada 1+2 (format_specs × client_format_standards) — enriquecimento opcional.
    // Só dispara quando (a) é criação de conteúdo, (b) há clientId, (c) formato foi
    // detectado. Se a tabela não existir (migration 0040 ainda não rodada) ou se não
    // houver row pra esse par, retorna "" e o fluxo segue normal.
    if (contentCreation.isContentCreation && clientId && contentCreation.detectedFormat) {
      const fmtStandardBlock = await loadAndBuildFormatPrompt(
        clientId,
        contentCreation.detectedFormat,
      );
      if (fmtStandardBlock) systemPrompt += fmtStandardBlock;
    }

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
- ENTREGUE APENAS o conteúdo final, sem explicações

### FORMATO DE OUTPUT (CRÍTICO):
- NÃO repita o título dentro do corpo.
- NÃO rotule seções com **Hook:**, **Gancho:**, **Corpo:**, **Title:**, # Título — entregue o tweet/post/carrossel exatamente como ele seria postado direto na plataforma.
- Comece pelo conteúdo final (primeira linha = primeira linha do post). Sem cabeçalhos, sem labels, sem prefixos meta.`;
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

    // 6.5 LAZY MODE OVERRIDE — prompt mínimo + heurísticas de roteamento de tools
    // Substitui o systemPrompt eager por uma versão enxuta (~3-5k chars)
    // que ensina o Gemini quando chamar cada uma das 26 tools registradas.
    if (toolsMode) {
      systemPrompt = `# REGRAS ABSOLUTAS DE ENTREGA
${userInstructionsPrompt}
⛔ PROIBIDO: emojis decorativos no corpo (💡🔥✨🚀💰📈💼🎯), hashtags no LinkedIn, frases tipo "Aqui está", "Segue", "Criei pra você", checklists de validação (✅❌), meta-texto explicando o que você fez.
✅ ENTREGUE: ações via tools + texto direto, conciso, no tom do cliente.

---

Você é o **kAI**, copiloto operacional do KAI 2.0 — criação de conteúdo, análise de performance, gestão de planejamento e workflow de marca.

## Cliente em foco
**${client.name}**${client.description ? `\n${client.description}` : ''}

## Regra de ouro — ACREDITE NAS TOOLS PRIMEIRO
Você NÃO tem o histórico, métricas, briefing nem rascunhos do cliente carregados de cara. A ÚNICA forma confiável de obter qualquer dado factual é chamar uma tool. Não invente, não chute. Se não souber, **chama tool**.

## Modo agentic — você tem 26 ferramentas
SEMPRE prefira buscar dados via tool em vez de adivinhar ou perguntar redundantemente.

### Heurísticas de roteamento (quando chamar cada tool):
- "quem é esse cliente?", "qual o tom?", "guidelines", "perfil de voz" → \`getClientContext\`
- "performance dessa semana", "como tá hoje", "como foi ontem" (curto/recente) → \`getRecentPerformance\`
- "performance 30/90d", "melhor post histórico", "comparativo", "deep dive" → \`getMetrics\`
- "esse rascunho", "esse post", "o último card", "o que eu acabei de criar" → \`getPlanningItem\` (latest=true) ANTES de editar/agendar/publicar
- "transcreva esse post", "o que o reel diz", "o que tem no carrossel" → \`getPostTranscription\` (com postId)
- "tem ref de X?", "buscar inspiração", "exemplos do feed" → \`searchRefs\` (refs externas) ou \`searchLibrary\` (conteúdo próprio)
- "criar carrossel/reel/post/tweet/thread/newsletter" → \`createContent\` (texto puro) ou \`createViralCarousel\` (carrossel com slides + imagens)
  ⚠️ \`createContent\` PRECISA de \`platform\` EXPLÍCITO ('linkedin'|'twitter'|'instagram'|'youtube'|'newsletter'|'tiktok') E \`format\` ('post'|'thread'|'carousel'|'reel'|'short'|'long'|'newsletter'|'blog'). Se o usuário não falou plataforma, PERGUNTA antes — NÃO assuma instagram.
- "agendar pra X", "marcar pra publicação", "scheduled" → \`scheduleFor\`
- "publicar agora", "manda" → \`publishNow\`
- "conectar Instagram/Twitter/LinkedIn/YouTube" → \`connectAccount\`
- "novo cliente", "criar cliente" → \`createClient\`
- "outros clientes do workspace", "lista todos" → \`listClients\`
- "atualizar tom/info/social do cliente" → \`updateClient\`
- "tarefa interna", "TODO admin", "agenda reunião" → \`createTeamTask\` (NÃO usar pra posts — usa createContent)
- "automação recorrente", "auto gerar diário", "rotina" → \`createAutomation\` / \`listAutomations\` / \`toggleAutomation\`
- "salva isso", "guarda essa ref" → \`saveToLibrary\`
- "engenharia reversa de reel", "adapta esse reel" + URL Instagram → diga ao usuário pra abrir https://reels.kaleidos.com.br (app standalone, saiu do KAI em 2026-05-16)
- "monitora no radar", "rastrear contas", "brief de tendências" → diga ao usuário pra abrir https://radar.kaleidos.com.br (app standalone, saiu do KAI em 2026-05-16)
- "joga no planejamento", "põe pra revisar" → \`addToPlanning\`
- "aprovações pendentes", "o que tá pra revisar" → \`listPendingApprovals\`
- "edita esse rascunho/card" → \`getPlanningItem\` (recupera ID + content) → \`editContent\`

### Heurísticas de roteamento (LEITURA DE CONTEXTO COMPLETO — 2026-05-16):
- "quem tem acesso?", "membros do workspace", "owner/admin/viewer" → \`getWorkspaceMembers\`
- "qual o tom?", "voice profile", "use/avoid", "pillars" → \`getVoiceProfile\` (mais específico que getClientContext)
- "cor primária", "logo", "tipografia", "paleta", "refs visuais" → \`getBrandAssets\`
- "tá conectado IG/LinkedIn/Metricool?", "integrações faltando" → \`getIntegrationsStatus\`
- "lista todas refs", "quantas refs", "filtra refs por tipo" → \`getReferences\` (vs searchRefs que é por palavra-chave)
- "ai workflows", "automações avançadas com cron" → \`getWorkflows\` (NÃO confunde com listAutomations que é planning_automations simples)
- "minhas notificações", "tem novidade pra mim?" → \`getNotifications\`
- "o que aconteceu essa semana?", "feed de atividade", "movimento do workspace" → \`getRecentActivity\` (7d default)
- "auditoria", "quem acessou X" — APENAS owner/admin → \`getAuditLog\`
- **PRONOMES CONTEXTUAIS** ("esse", "essa aba", "esse mês", "esse item") sem ID → \`getUIState\` PRIMEIRO pra resolver. Se \`available: false\`, pede pro user esclarecer.

### Heurísticas de roteamento (WRITE / EDIT — 2026-05-16):
- "muda status/prazo/título da task X" → \`editTask\`
- "muda cron/prompt/config do workflow Y" → \`updateWorkflow\` (ai_workflows). Pra planning_automations use \`toggleAutomation\`
- "convida fulano@x", "adiciona membro" → \`addWorkspaceMember\` (cria invite)
- "promove pra admin", "rebaixa pra member" → \`updateMemberRole\` (só owner pode)
- "muda cor primária pra X", "atualiza logo", "troca fonte" → \`updateBrandAssets\` (merge raso por padrão)
- "muda tom pra informal", "adiciona pilar X", "atualiza persona" → \`updateVoiceProfile\` (merge raso)
- "adiciona essa ref", "salva como inspiração" → \`addReference\` (alias semântico)
- "edita essa ref", "muda título/nota/tags" → \`editReference\`
- "salva como minha preferência X=Y" → \`updateClientSettings\` (client_preferences key/value)

### Heurísticas de roteamento (DELETE — 2026-05-16, destrutivos):
- "deleta esse carrossel/post/rascunho" → \`deleteContent\`
- "remove esse card do kanban/planejamento" → \`deletePlanningItem\` (mesmo handler, framing diferente)
- "deleta tarefa X" → \`deleteTask\`
- "remove ref da library" → \`deleteReference\`
- "apaga automação Y" → \`deleteAutomation\` (sugira \`toggleAutomation\` se for só pausar)
- "remove fulano do workspace" → \`removeWorkspaceMember\`

### REGRAS DE APROVAÇÃO (TODAS as tools destrutivas):
Toda chamada inicial a \`delete*\` ou \`removeWorkspaceMember\` retorna
\`requires_approval: true\` + card com status \`pending_approval\`. O usuário
clica no botão na UI e a UI re-chama a MESMA tool com \`approved: true\` no
payload — só então a deleção acontece. NÃO chame com \`approved: true\` no
primeiro turno, mesmo se o user "já confirmou" no texto: a UI precisa
mostrar o card de confirmação primeiro.

Quando o resultado vier como \`{ status: 'pending_user_approval', action: ... }\`,
NÃO tente chamar de novo. Apenas responda em texto curto, ex: "Te mostrei a
confirmação no modal — clica em Confirmar pra eu seguir." Quando o usuário
confirma, o re-call vem como nova mensagem do user (forceTool) — você não
precisa fazer nada.

REGRA EXTRA pra \`deleteContent\` / \`deletePlanningItem\`: se o item já tem
\`status = 'published'\` ou \`published_at != NULL\`, o backend exige \`force: true\`
adicional. O card de confirmação já injeta isso automaticamente.

### Princípios operacionais:
1. **Falta dado do cliente?** → \`getClientContext\` PRIMEIRO. Não adivinhe brand voice ou guidelines.
2. **Vai editar/agendar/publicar um post mencionado vagamente** ("esse post", "o último") → \`getPlanningItem\` com latest=true ANTES da ação, pra resolver o ID real.
3. **Vai criar conteúdo do zero?** → \`createContent\` já carrega contexto completo + few-shot examples do cliente automaticamente. NÃO precisa chamar \`getClientContext\` ou \`searchLibrary\` ANTES (redundante, gasta tokens). Só chama esses dois se o user pediu explicitamente "quem é o cliente?" ou "busca refs sobre X" ANTES de criar.
   - **Sempre confirme platform + format se ambíguo.** "cria um post" não basta — pergunta "Instagram, LinkedIn, Twitter?" antes de chamar a tool.
   - **Briefing rico = output melhor.** Passa pro briefing TUDO que o user falou (tema, ângulo, CTA, dados, referências). NÃO resuma.
   - **Após gerar:** o card já mostra o conteúdo. Sua resposta = 1 frase curta tipo "Rascunho pronto, dá uma olhada." NÃO reescreva o conteúdo no chat.
4. **Recebeu URL de Reel/Post Instagram?** → \`saveToLibrary\` pra arquivar; pra adaptar reel, aponte pra https://reels.kaleidos.com.br (app standalone).
5. **Múltiplas ações?** → encadeie tools em sequência (ex: \`createContent\` → \`addToPlanning\` → \`scheduleFor\`).
6. **Após executar tool de ação** (publish/schedule/create/automation) → 1 frase curta de confirmação. Sem checklist, sem "feito ✅", sem reescrever o que a tool já mostrou.
7. **NÃO invente** dados de cliente, métricas, refs ou histórico. Se não tem via tool, BUSCA primeiro. Se a tool falhar, só aí pergunte ao usuário.`;
    }

    // 7. History windowing
    const fullHistory = history || [];
    let contextSummaryBlock = '';
    let recentHistory: HistoryMessage[] = [];

    if (fullHistory.length > 10) {
      const olderMessages = fullHistory.slice(0, -5);
      recentHistory = fullHistory.slice(-5);
      const olderSummary = olderMessages.map((m) =>
        `${m.role === 'user' ? 'Usuário' : 'Assistente'}: ${m.content.substring(0, 200)}`,
      ).join('\n');
      contextSummaryBlock = `\n## Resumo da Conversa Anterior\n${olderSummary.substring(0, 2000)}\n`;
    } else {
      recentHistory = fullHistory.slice(-MAX_HISTORY_MESSAGES);
    }
    if (contextSummaryBlock) systemPrompt += contextSummaryBlock;

    // Save last_format_used (fire & forget)
    if (contentCreation.isContentCreation && contentCreation.detectedFormat) {
      const conversationId = body.conversationId;
      if (conversationId) {
        query(
          `UPDATE kai_chat_conversations SET last_format_used = $1 WHERE id = $2`,
          [contentCreation.detectedFormat, conversationId],
        ).catch(() => {});
      }
    }

    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...recentHistory.map((h) => ({ role: h.role, content: h.content })),
      { role: 'user', content: message },
    ];

    console.log('[kai-simple-chat] Context built:', {
      systemPromptLength: systemPrompt.length,
      historyMessages: recentHistory.length,
      hasMetrics: !!metricsContext, hasPlanning: !!planningContext,
      hasVoice: !!voiceGuidelinesContext, hasKnowledge: !!knowledgeContext,
      hasDocs: !!docsWebsitesContext, hasLibrary: !!libraryExamplesContext,
    });

    // 8. Call Gemini
    const GOOGLE_API_KEY = process.env.GOOGLE_AI_STUDIO_API_KEY;
    if (!GOOGLE_API_KEY) {
      return jsonError(res, 500, 'GOOGLE_AI_STUDIO_API_KEY não configurada');
    }

    // Build Gemini contents (system → systemInstruction, attach images on current user msg)
    let systemInstructionText = '';
    const geminiContents: any[] = [];

    for (const msg of apiMessages) {
      if (msg.role === 'system') {
        systemInstructionText += (systemInstructionText ? '\n\n' : '') + msg.content;
        continue;
      }
      const role = msg.role === 'assistant' ? 'model' : 'user';
      const parts: any[] = [];

      if (msg.role === 'user' && imageUrls && imageUrls.length > 0 && msg.content === message) {
        if (msg.content) parts.push({ text: msg.content });
        for (const url of imageUrls) {
          const img = await fetchImageAsBase64(url);
          if (img) parts.push({ inlineData: img });
        }
      } else {
        parts.push({ text: msg.content });
      }

      if (geminiContents.length > 0 && geminiContents[geminiContents.length - 1].role === role) {
        geminiContents[geminiContents.length - 1].parts.push(...parts);
      } else {
        geminiContents.push({ role, parts });
      }
    }

    const geminiModel = 'gemini-2.5-flash';

    // ─────────────────────────────────────────────
    // TOOL-CALLING MODE
    // ─────────────────────────────────────────────
    if (body.useTools && shouldStream) {
      console.log('[kai-simple-chat] 🔧 tool-calling mode ON — using runToolLoop');

      if (body.forceTool?.name) {
        const argsJson = JSON.stringify(body.forceTool.args ?? {}, null, 2);
        systemInstructionText += `\n\n⚙️ AÇÃO DIRETA DO USUÁRIO: chame imediatamente a ferramenta \`${body.forceTool.name}\` com os argumentos exatos abaixo, sem pedir confirmação (o usuário já confirmou clicando no botão):\n${argsJson}\n\nApós executar, dê um breve feedback em texto (1 frase) do que foi feito.`;
        console.log(`[kai-simple-chat] 🔧 forceTool ativo: ${body.forceTool.name} args=${argsJson.slice(0, 200)}`);
      }

      const registry = new ToolRegistry();
      registry.register(echoTool);
      registry.register(webSearchTool);
      registry.register(delegateToSubAgentTool);
      registry.register(createContentTool);
      registry.register(createViralCarouselTool);
      registry.register(editContentTool);
      registry.register(listPendingApprovalsTool);
      registry.register(getClientContextTool);
      registry.register(searchLibraryTool);
      registry.register(publishNowTool);
      registry.register(scheduleForTool);
      registry.register(connectAccountTool);
      registry.register(getMetricsTool);
      // 2026-05-16: analyzeViralReelTool + createRadarBriefTool removidos
      // (Reels/Radar Viral viraram apps standalone, handlers deletados).
      registry.register(createTeamTaskTool);
      registry.register(saveToLibraryTool);
      registry.register(createAutomationTool);
      registry.register(listAutomationsTool);
      registry.register(toggleAutomationTool);
      registry.register(updateClientTool);
      registry.register(searchRefsTool);
      registry.register(listClientsTool);
      registry.register(createClientTool);
      registry.register(addToPlanningTool);
      registry.register(getPostTranscriptionTool);
      registry.register(getPlanningItemTool);
      registry.register(getRecentPerformanceTool);

      // READ agregadores (2026-05-16) — workspace/brand/voice/integrações/auditoria/refs/workflows/notif/atividade/UI state.
      registry.register(getWorkspaceMembersTool);
      registry.register(getBrandAssetsTool);
      registry.register(getVoiceProfileTool);
      registry.register(getIntegrationsStatusTool);
      registry.register(getAuditLogTool);
      registry.register(getReferencesTool);
      registry.register(getWorkflowsTool);
      registry.register(getNotificationsTool);
      registry.register(getRecentActivityTool);
      registry.register(getUIStateTool);

      // WRITE / EDIT (2026-05-16) — controle pleno tasks/workflows/members/brand/voice/refs.
      registry.register(editTaskTool);
      registry.register(updateWorkflowTool);
      registry.register(addWorkspaceMemberTool);
      registry.register(removeWorkspaceMemberTool);
      registry.register(updateMemberRoleTool);
      registry.register(updateBrandAssetsTool);
      registry.register(updateVoiceProfileTool);
      registry.register(addReferenceTool);
      registry.register(editReferenceTool);
      registry.register(updateClientSettingsTool);

      // DELETE (2026-05-16) — TODAS exigem `approved: true` (approval flow).
      // Primeira chamada retorna card pending_approval; UI re-chama com approved=true.
      registry.register(deleteContentTool);
      registry.register(deleteTaskTool);
      registry.register(deletePlanningItemTool);
      registry.register(deleteReferenceTool);
      registry.register(deleteAutomationTool);

      setSseHeaders(res);
      const emit = createKAIEmitter(res);

      const toolCtx: ToolExecutionContext = {
        clientId,
        userId,
        conversationId: body.conversationId,
        emit,
        accessToken,
        internalBaseUrl,
        isInternalCall: !!body.internalServiceAuth,
        uiState,
      };

      try {
        const { finalText, toolCalls, cacheStats, toolTraces, llmLatencyMs, toolLatencyMs } =
          await runToolLoop({
            apiKey: GOOGLE_API_KEY,
            model: geminiModel,
            orchestratorModel: 'gemini-2.5-pro',
            systemInstruction: systemInstructionText,
            contents: geminiContents,
            registry,
            emit,
            ctx: toolCtx,
          });
        const errorCount = toolTraces.filter((t) => t.status === 'error').length;
        console.log(
          `[kai-simple-chat] 🔧 tool-loop done — ${toolCalls.length} tool calls (${errorCount} err), ${finalText.length} chars, llm=${llmLatencyMs}ms tool=${toolLatencyMs}ms, cache hits=${cacheStats.hits}/creates=${cacheStats.creates}/bypassed=${cacheStats.bypassed}`,
        );
        const inputTokens = estimateTokens(JSON.stringify(geminiContents));
        const outputTokens = estimateTokens(finalText);
        await logAIUsage(
          userId,
          `google/${geminiModel}`,
          'kai-simple-chat-tools',
          inputTokens,
          outputTokens,
          {
            client_id: clientId,
            tool_calls: toolCalls.length,
            cache_hits: cacheStats.hits,
            cache_creates: cacheStats.creates,
            cache_bypassed: cacheStats.bypassed,
            // Tracing fields — agregados rápidos no metadata pra dashboard
            // calcular médias sem ler tabela separada. tool_traces compacto
            // (name, durationMs, status) por chamada — útil pra debug pontual.
            llm_latency_ms: llmLatencyMs,
            tool_latency_ms: toolLatencyMs,
            tool_errors: errorCount,
            tool_traces: toolTraces.map((t) => ({
              n: t.name,
              ms: t.durationMs,
              s: t.status,
              ...(t.errorMessage ? { e: t.errorMessage.slice(0, 120) } : {}),
            })),
          },
        ).catch(() => {});
      } catch (err) {
        console.error('[kai-simple-chat] runToolLoop error:', err);
        emit.error(err instanceof Error ? err.message : String(err));
      } finally {
        emit.done();
        if (!res.writableEnded) res.end();
      }
      return;
    }

    // ─────────────────────────────────────────────
    // NORMAL (non-tool) MODE
    // ─────────────────────────────────────────────
    const geminiBody: any = {
      contents: geminiContents,
      generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
    };
    if (systemInstructionText) {
      geminiBody.systemInstruction = { parts: [{ text: systemInstructionText }] };
    }

    const geminiEndpoint = shouldStream ? 'streamGenerateContent' : 'generateContent';
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:${geminiEndpoint}?key=${GOOGLE_API_KEY}${shouldStream ? '&alt=sse' : ''}`;

    const gatewayResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    });

    if (!gatewayResponse.ok) {
      const errorText = await gatewayResponse.text();
      console.error('[kai-simple-chat] Gemini error:', gatewayResponse.status, errorText);
      if (gatewayResponse.status === 429) {
        return jsonError(res, 429, 'Muitas requisições. Aguarde um momento.');
      }
      if (gatewayResponse.status === 403) {
        return jsonError(res, 403, 'Chave da API Google sem permissão ou cota esgotada.');
      }
      return jsonError(res, 500, 'Erro ao gerar resposta.');
    }

    if (!shouldStream) {
      const data = await gatewayResponse.json();
      const content = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const inputTokens = data?.usageMetadata?.promptTokenCount || estimateTokens(JSON.stringify(geminiContents));
      const outputTokens = data?.usageMetadata?.candidatesTokenCount || estimateTokens(content);
      await logAIUsage(
        userId,
        `google/${geminiModel}`,
        'kai-simple-chat',
        inputTokens,
        outputTokens,
        { client_id: clientId },
      ).catch(() => {});
      return res.status(200).json({ content });
    }

    // Streaming: translate Gemini SSE → OpenAI-style SSE
    const inputTokens = estimateTokens(JSON.stringify(geminiContents));
    setSseHeaders(res);
    if (!gatewayResponse.body) {
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    const reader = gatewayResponse.body.getReader();
    const decoder = new TextDecoder();
    let outputText = '';
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (buffer.trim().startsWith('data: ')) {
            try {
              const json = JSON.parse(buffer.slice(6).trim());
              const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                outputText += text;
                res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`);
              }
            } catch {}
          }
          res.write('data: [DONE]\n\n');
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, newlineIdx).trim();
          buffer = buffer.slice(newlineIdx + 1);
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (!payload) continue;
          try {
            const json = JSON.parse(payload);
            const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              outputText += text;
              res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`);
            }
          } catch {
            // partial JSON — put back and wait for more
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }
    } catch (e) {
      console.error('[kai-simple-chat] stream loop error:', e);
    } finally {
      if (!res.writableEnded) res.end();
      const outputTokens = estimateTokens(outputText);
      await logAIUsage(
        userId,
        `google/${geminiModel}`,
        'kai-simple-chat',
        inputTokens,
        outputTokens,
        { client_id: clientId },
      ).catch(() => {});
    }
  } catch (error: any) {
    console.error('[kai-simple-chat] Unhandled error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    const isTimeout = errorMessage.includes('timeout');
    if (!res.writableEnded) {
      jsonError(res, 500, isTimeout ? 'Requisição expirou. Tente novamente.' : 'Erro interno.');
    }
  }
}
