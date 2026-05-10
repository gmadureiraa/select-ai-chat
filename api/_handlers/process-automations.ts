// Migrated from supabase/functions/process-automations/index.ts (~2400 lines)
//
// Engine that processes scheduled / RSS-driven content automations:
//   1. Iterate active automations (or one specific id for manual test)
//   2. Evaluate trigger (schedule cron-like / RSS new item)
//   3. Build enriched prompt with client context + variation
//   4. Call Gemini directly to generate text content
//   5. Create planning_item row
//   6. Optionally call generate-content-v2 for image
//   7. Optionally publish via late-post
//   8. Notify (in-app + Telegram, best-effort)
//
// Uses Neon (pg) instead of Supabase and Gemini direct (no Lovable Gateway).
// NOTE: deep-research, viral_carousel branch and recursive supabase scraping
// are simplified — they fall back to generic content generation when their
// dependencies (research-newsletter-topic, generate-viral-carousel) are not
// migrated yet.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';
import { getPool, query, queryOne, insertRow } from '../_lib/db.js';
import { tryAuth } from '../_lib/auth.js';
import {
  FORMAT_MAP,
  PLATFORM_MAP,
  CONTENT_TYPE_LABELS,
} from '../_lib/shared/format-constants.js';
import {
  getFullContentContext,
  getStructuredVoice,
} from '../_lib/shared/knowledge-loader.js';
import { selectModelForFormat } from '../_lib/shared/prompt-builder.js';
import {
  detectContentStructure,
  detectOpeningPatterns,
} from '../_lib/shared/quality-rules.js';
import { logAIUsage, estimateTokens } from '../_lib/shared/ai-usage.js';

// =====================================================
// TYPES
// =====================================================
interface ScheduleConfig {
  type?: 'daily' | 'weekly' | 'monthly';
  days?: number[];
  time?: string;
}
interface RSSConfig {
  url?: string;
  last_guid?: string;
  last_checked?: string;
  recent_variation_indices?: number[];
  variation_index?: number;
}
interface PlanningAutomation {
  id: string;
  workspace_id: string;
  client_id: string | null;
  name: string;
  is_active: boolean;
  trigger_type: 'schedule' | 'rss' | 'webhook';
  trigger_config: ScheduleConfig & RSSConfig;
  target_column_id: string | null;
  platform: string | null;
  content_type: string;
  auto_generate_content: boolean;
  prompt_template: string | null;
  auto_publish: boolean;
  auto_generate_image: boolean;
  image_prompt_template: string | null;
  image_style: 'photographic' | 'illustration' | 'minimalist' | 'vibrant' | null;
  image_reference_ids: string[] | null;
  platforms?: string[] | null;
  last_triggered_at: string | null;
  items_created: number;
  created_by: string | null;
}
interface RSSItem {
  title: string;
  link: string;
  description?: string;
  content?: string;
  pubDate?: string;
  guid?: string;
  imageUrl?: string;
  allImages?: string[];
}

// =====================================================
// HELPERS — variation rotation, length modifier
// =====================================================
function selectVariationWithCooldown(
  categories: Array<{ name: string; instruction: string }>,
  triggerConfig: RSSConfig
): { index: number; variation: { name: string; instruction: string }; updatedRecentIndices: number[] } {
  const recentIndices: number[] = triggerConfig.recent_variation_indices || [];
  let available = Array.from({ length: categories.length }, (_, i) => i)
    .filter((i) => !recentIndices.includes(i));
  if (available.length === 0) available = Array.from({ length: categories.length }, (_, i) => i);
  const selectedIndex = available[Math.floor(Math.random() * available.length)];
  const updated = [...recentIndices, selectedIndex].slice(-3);
  return { index: selectedIndex, variation: categories[selectedIndex], updatedRecentIndices: updated };
}

function getLengthModifier(): string {
  const r = Math.random();
  if (r < 0.3) return '\n\n📏 COMPRIMENTO: BREVE. Máximo 2 frases. Brevidade é poder.';
  if (r < 0.7) return '';
  return '\n\n📏 COMPRIMENTO: DETALHADO. Desenvolva com 4-5 frases. Use detalhes concretos.';
}

// Variation categories — abridged copy from original (top 4 each, prevents cold-start repetition)
const GM_VARIATION_CATEGORIES = [
  { name: 'Provocação', instruction: 'Frase curta + ponto + segunda frase explicativa. Sem listas, sem perguntas retóricas.' },
  { name: 'Confissão', instruction: 'Comece com vulnerabilidade. Revele um erro ou mudança de opinião. Tom pessoal.' },
  { name: 'Observação afiada', instruction: 'Observação curta sobre o mercado AGORA. Máximo 2 frases.' },
  { name: 'Micro-storytelling', instruction: 'História em 3 frases: situação → virada → lição. Use detalhes concretos.' },
  { name: 'Dado concreto', instruction: 'Abra com número REAL da sua experiência. Não invente estatísticas.' },
  { name: 'Metáfora', instruction: 'Analogia inesperada para explicar conceito do nicho. Sem clichês.' },
  { name: 'Contrarian rápido', instruction: 'Discorde de algo popular em 1-2 frases sem justificar muito.' },
  { name: 'Pergunta poderosa', instruction: 'UMA pergunta que force reflexão. Sem responder. A pergunta É o tweet.' },
];

const THREADS_VARIATION_CATEGORIES = [
  { name: 'Reflexão Curta', instruction: 'Pensamento contemplativo em 2-3 frases. Não resolva. Deixe em aberto.' },
  { name: 'Insight Rápido', instruction: 'Algo aprendido recentemente em 1-2 frases CURTAS. Direto.' },
  { name: 'Bastidores', instruction: 'Revele algo real dos bastidores. Tom cru e autêntico.' },
  { name: 'Provocação Leve', instruction: 'Questione algo aceito como verdade. Tom amigável mas firme.' },
];

const LINKEDIN_VARIATION_CATEGORIES: Record<string, Array<{ name: string; instruction: string }>> = {
  opinion: [
    { name: 'Contrarian com Dados', instruction: 'Discorde de algo popular usando experiência REAL. NÃO invente números.' },
    { name: 'Análise em Primeira Pessoa', instruction: 'Algo que VIVEU esta semana/mês. Detalhes temporais.' },
    { name: 'Framework Original', instruction: 'Modelo mental SEU. Dê um nome. Explique em 3-4 frases.' },
    { name: 'Lição do Erro', instruction: 'Erro real cometido. Quando, quanto custou, o que aprendeu.' },
  ],
  building_in_public: [
    { name: 'Bastidores Crus', instruction: 'Algo REAL do dia. Tom não-polido, narrativo.' },
    { name: 'Número Aberto', instruction: 'UMA métrica real. Contextualize.' },
    { name: 'Decisão Difícil', instruction: 'Decisão recente que tirou o sono. Aceite ambiguidade.' },
  ],
  case_study: [
    { name: 'Antes e Depois', instruction: 'Resultado REAL. Antes → ação → depois. Use números reais.' },
    { name: 'Erro que Virou Acerto', instruction: 'Algo que deu errado num projeto. Pivô. Resultado pode não ser melhor.' },
  ],
};

// =====================================================
// RSS PARSING
// =====================================================
function extractImagesFromHTML(html: string): string[] {
  const images: string[] = [];
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = imgRegex.exec(html)) !== null) {
    const src = m[1];
    if (src && !src.includes('pixel') && !src.includes('tracking') && !src.includes('icon')) images.push(src);
  }
  const meta = /content=["']([^"']+\.(jpg|jpeg|png|gif|webp)[^"']*)["']/gi;
  while ((m = meta.exec(html)) !== null) {
    if (!images.includes(m[1])) images.push(m[1]);
  }
  return images.slice(0, 10);
}

function parseAtomEntries(text: string): RSSItem[] {
  const items: RSSItem[] = [];
  const entries = text.match(/<entry[\s\S]*?<\/entry>/gi) || [];
  for (const e of entries) {
    const videoId = e.match(/<yt:videoId[^>]*>([\s\S]*?)<\/yt:videoId>/i)?.[1]?.trim() || '';
    const title = e.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || '';
    const published = e.match(/<published[^>]*>([\s\S]*?)<\/published>/i)?.[1]?.trim() || '';
    const updated = e.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i)?.[1]?.trim() || '';
    const description = e.match(/<media:description[^>]*>([\s\S]*?)<\/media:description>/i)?.[1]?.trim() || '';
    const thumbnail = e.match(/<media:thumbnail[^>]*url="([^"]+)"/i)?.[1] || '';
    const link = e.match(/<link[^>]*href="([^"]+)"/i)?.[1] || '';
    const cleanDesc = description.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").substring(0, 500);
    const videoUrl = link || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : '');
    const thumbUrl = thumbnail || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '');
    items.push({
      title, link: videoUrl, description: cleanDesc, content: description,
      pubDate: published || updated,
      guid: videoId ? `yt:video:${videoId}` : videoUrl,
      imageUrl: thumbUrl, allImages: thumbUrl ? [thumbUrl] : [],
    });
  }
  return items;
}

async function parseRSSFeed(url: string): Promise<RSSItem[]> {
  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Kaleidos/1.0)',
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      },
    });
    const text = await r.text();
    if (text.includes('<feed') && text.includes('<entry')) return parseAtomEntries(text);

    const items: RSSItem[] = [];
    const itemMatches = text.match(/<item[\s\S]*?<\/item>/gi) || [];
    for (const ix of itemMatches) {
      const title = ix.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1]?.trim() || '';
      const link = ix.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1]?.trim() || '';
      const description = ix.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)?.[1]?.trim();
      const content =
        ix.match(/<content:encoded[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/content:encoded>/i)?.[1]?.trim()
        || ix.match(/<content[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/content>/i)?.[1]?.trim();
      const pubDate = ix.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim();
      const guid = ix.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i)?.[1]?.trim() || link;

      const allImages: string[] = [];
      const mediaUrl = ix.match(/<media:content[^>]+url=["']([^"']+)["']/i)?.[1];
      if (mediaUrl) allImages.push(mediaUrl);
      const thumbUrl = ix.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i)?.[1];
      if (thumbUrl && !allImages.includes(thumbUrl)) allImages.push(thumbUrl);
      const enclosure = ix.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]+type=["']image/i)?.[1];
      if (enclosure && !allImages.includes(enclosure)) allImages.push(enclosure);
      if (content) for (const img of extractImagesFromHTML(content)) if (!allImages.includes(img)) allImages.push(img);
      if (description) for (const img of extractImagesFromHTML(description)) if (!allImages.includes(img)) allImages.push(img);

      items.push({ title, link, description, content, pubDate, guid, imageUrl: allImages[0], allImages: allImages.slice(0, 8) });
    }
    return items;
  } catch (e) {
    console.error(`[RSS] parse error ${url}:`, e);
    return [];
  }
}

// =====================================================
// TRIGGERS
// =====================================================
function shouldTriggerSchedule(config: ScheduleConfig, lastTriggered: string | null): boolean {
  const now = new Date();
  const today = now.getDay();
  const dayOfMonth = now.getDate();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  if (lastTriggered) {
    const lastDate = new Date(lastTriggered);
    if (lastDate.toDateString() === now.toDateString()) return false;
  }
  if (config.time && currentTime < config.time) return false;
  switch (config.type) {
    case 'daily': return true;
    case 'weekly': return !!config.days?.includes(today);
    case 'monthly': return !!config.days?.includes(dayOfMonth);
    default: return false;
  }
}

async function checkRSSTrigger(config: RSSConfig): Promise<{ shouldTrigger: boolean; data?: RSSItem; newGuid?: string }> {
  if (!config.url) return { shouldTrigger: false };
  const items = await parseRSSFeed(config.url);
  if (items.length === 0) return { shouldTrigger: false };
  items.sort((a, b) => {
    if (!a.pubDate || !b.pubDate) return 0;
    return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime();
  });
  const latest = items[0];
  if (config.last_guid && latest.guid === config.last_guid) return { shouldTrigger: false };
  return { shouldTrigger: true, data: latest, newGuid: latest.guid };
}

// =====================================================
// PROMPT BUILDING
// =====================================================
async function fetchBTCPrice(): Promise<string> {
  try {
    const r = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd,brl&include_24hr_change=true&include_market_cap=true',
      { headers: { Accept: 'application/json' } }
    );
    if (!r.ok) return 'Dados do Bitcoin indisponíveis no momento.';
    const data = await r.json();
    const btc = data.bitcoin;
    const priceUSD = btc.usd?.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    const priceBRL = btc.brl?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const change24h = btc.usd_24h_change?.toFixed(2);
    const dir = parseFloat(change24h) >= 0 ? '📈' : '📉';
    const cap = btc.usd_market_cap ? `$${(btc.usd_market_cap / 1e9).toFixed(1)}B` : 'N/A';
    return `${dir} Bitcoin (BTC)\n- Preço: ${priceUSD} / ${priceBRL}\n- Variação 24h: ${change24h}%\n- Market Cap: ${cap}`;
  } catch {
    return 'Dados do Bitcoin indisponíveis no momento.';
  }
}

async function replaceTemplateVariables(
  template: string,
  data: RSSItem | null,
  automationName: string
): Promise<string> {
  if (!template) return '';
  const hour = new Date().getHours();
  let timeOfDay = 'noite';
  if (hour >= 5 && hour < 12) timeOfDay = 'manhã';
  else if (hour >= 12 && hour < 18) timeOfDay = 'tarde';

  let btcPrice = '';
  if (template.includes('{{btc_price}}')) btcPrice = await fetchBTCPrice();

  const variables: Record<string, string> = {
    '{{title}}': data?.title || automationName,
    '{{description}}': data?.description?.replace(/<[^>]*>/g, '').substring(0, 500) || '',
    '{{link}}': data?.link || '',
    '{{content}}':
      data?.content?.replace(/<[^>]*>/g, '').substring(0, 3000)
      || data?.description?.replace(/<[^>]*>/g, '').substring(0, 3000)
      || '',
    '{{images}}': (data?.allImages?.length || 0) > 0
      ? `${data!.allImages!.length} imagens disponíveis do conteúdo original`
      : 'Sem imagens disponíveis',
    '{{time_of_day}}': timeOfDay,
    '{{btc_price}}': btcPrice,
  };
  let prompt = template;
  for (const [k, v] of Object.entries(variables)) {
    prompt = prompt.replace(new RegExp(k.replace(/[{}]/g, '\\$&'), 'g'), v);
  }
  return prompt;
}

async function buildEnrichedPrompt(
  template: string | null,
  data: RSSItem | null,
  automation: PlanningAutomation,
  contentType: string,
  mediaUrls: string[],
  variationContext?: { category: string; instruction: string; recentTweets: string[] }
): Promise<string> {
  let prompt = await replaceTemplateVariables(template || '', data, automation.name);
  const formatLabel = CONTENT_TYPE_LABELS[contentType] || contentType;

  if (!template || template.trim().length < 20) {
    const cleanDesc = data?.description?.replace(/<[^>]*>/g, '').substring(0, 500) || '';
    const cleanContent = data?.content?.replace(/<[^>]*>/g, '').substring(0, 2500) || '';
    prompt = `TAREFA: Criar ${formatLabel} profissional e pronto para publicar.

📌 CONTEÚDO BASE:
Título: ${data?.title || automation.name}
${cleanDesc ? `Resumo: ${cleanDesc}` : ''}
${data?.link ? `Link original: ${data.link}` : ''}

${cleanContent ? `📄 CONTEÚDO COMPLETO:\n${cleanContent}` : ''}

📋 INSTRUÇÕES:
1. Siga RIGOROSAMENTE as regras do formato "${formatLabel}"
2. Mantenha o tom de voz e estilo do cliente
3. Crie conteúdo PRONTO PARA PUBLICAR
4. ${mediaUrls.length > 0 ? `Há ${mediaUrls.length} imagens disponíveis - faça referência onde apropriado` : 'Sem imagens'}

Conteúdo final completo, pronto para publicar como ${formatLabel}.`;
  }

  if (variationContext) {
    prompt += `\n\n🎲 ESTILO OBRIGATÓRIO PARA HOJE: ${variationContext.category}\n${variationContext.instruction}`;
    if (variationContext.recentTweets.length > 0) {
      prompt += `\n\n🚫 ANTI-EXEMPLOS (NÃO repita estes padrões):`;
      variationContext.recentTweets.forEach((t, i) => { prompt += `\n${i + 1}. "${t.substring(0, 300)}"`; });

      const allStructures: Record<string, number> = {};
      for (const t of variationContext.recentTweets) {
        for (const p of detectContentStructure(t)) {
          allStructures[p] = (allStructures[p] || 0) + 1;
        }
      }
      const frequent = Object.entries(allStructures).filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]);
      if (frequent.length > 0) {
        prompt += `\n\n📊 PADRÕES JÁ USADOS (NÃO repita):`;
        for (const [pattern, count] of frequent) prompt += `\n- ${pattern} (${count}x)`;
        prompt += `\n\n⚠️ USE UM PADRÃO DIFERENTE.`;
      }
      const openings = detectOpeningPatterns(variationContext.recentTweets);
      if (openings.length > 0) {
        prompt += `\n\n🎣 GANCHOS JÁ USADOS:`;
        for (const { pattern, count, examples } of openings) prompt += `\n- ${pattern} (${count}x): "${examples[0]}"`;
        prompt += `\n\n⚠️ COMECE com tipo de abertura DIFERENTE.`;
      }
      prompt += `\n\n⚠️ Conteúdo DEVE ser fundamentalmente DIFERENTE em estrutura, tema e abordagem.`;
    }
  }

  if (mediaUrls.length > 0 && ['thread', 'carousel', 'instagram_post', 'stories'].includes(contentType)) {
    prompt += `\n\n📸 IMAGENS DISPONÍVEIS (${mediaUrls.length}): As imagens serão anexadas. Faça referência onde apropriado.`;
  }
  switch (contentType) {
    case 'tweet':
      prompt += `\n\n⚠️ ENTREGA: APENAS texto puro do tweet. Sem rótulos, sem markdown.`;
      break;
    case 'thread':
      prompt += `\n\n⚠️ ENTREGA: Numere cada tweet (1/, 2/, etc). Máximo 280 chars por tweet.`;
      break;
    case 'carousel':
      prompt += `\n\n⚠️ ENTREGA: "Página 1:", "Página 2:", etc. + LEGENDA no final.`;
      break;
  }
  return prompt;
}

// =====================================================
// CONTENT CLEANUP & PARSING
// =====================================================
function cleanContentOutput(content: string, platform?: string): string {
  if (!content) return content;
  let cleaned = content;
  cleaned = cleaned.replace(/^```[\s\S]*?\n([\s\S]*?)```\s*$/gm, '$1');
  cleaned = cleaned.replace(/^```\s*\n?/gm, '').replace(/\n?```\s*$/gm, '');
  const isTextOnly = ['twitter', 'threads', 'linkedin'].includes(platform || '');
  const legendaMatch = cleaned.match(/\*{0,2}LEGENDA[:\s]*\*{0,2}\s*([\s\S]+)/i);
  const visualMatch = cleaned.match(/\*{0,2}TEXTO\s*(?:DO\s*)?VISUAL[:\s]*\*{0,2}\s*([\s\S]+?)(?:\n---|\n\n\*{0,2}LEGENDA)/i);
  if (legendaMatch && (isTextOnly || cleaned.includes('TEXTO DO VISUAL'))) {
    cleaned = legendaMatch[1].trim();
  } else if (visualMatch && !cleaned.includes('LEGENDA') && isTextOnly) {
    cleaned = visualMatch[1].trim();
  }
  cleaned = cleaned.replace(/\*{2}([^*]+)\*{2}/g, '$1');
  cleaned = cleaned.replace(/^#+\s+/gm, '');
  cleaned = cleaned.replace(/^---+$/gm, '');
  cleaned = cleaned.replace(/^\s*[-*]\s+/gm, '');
  cleaned = cleaned.replace(/^(?:TWEET|LEGENDA|TEXTO|CAPTION|POST|TEXTO DO VISUAL)[:\s]*/im, '');
  if (isTextOnly) cleaned = cleaned.replace(/\*{0,2}TEXTO\s*(?:DO\s*)?VISUAL[:\s]*\*{0,2}[^\n]*\n*/gi, '');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith('"') && cleaned.endsWith('"'))) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  return cleaned;
}

function parseThreadFromContent(content: string): Array<{ id: string; text: string; media_urls: string[] }> | null {
  const tweets: Array<{ id: string; text: string; media_urls: string[] }> = [];
  const numbered = /(?:^|\n)(\d+)\/[\s\n]*([\s\S]*?)(?=(?:\n\d+\/)|$)/g;
  let m;
  let foundNumbered = false;
  while ((m = numbered.exec(content)) !== null) {
    foundNumbered = true;
    tweets.push({ id: `tweet-${m[1]}`, text: m[2].trim(), media_urls: [] });
  }
  if (foundNumbered && tweets.length > 0) return tweets;
  const tweetPat = /(?:^|\n)Tweet\s*(\d+)[:.]?\s*([\s\S]*?)(?=(?:\nTweet\s*\d)|$)/gi;
  while ((m = tweetPat.exec(content)) !== null) {
    tweets.push({ id: `tweet-${m[1]}`, text: m[2].trim(), media_urls: [] });
  }
  if (tweets.length > 0) return tweets;
  const parts = content.split(/\n---\n/);
  if (parts.length > 1) {
    parts.forEach((p, i) => {
      const t = p.trim();
      if (t && t.length <= 280) tweets.push({ id: `tweet-${i + 1}`, text: t, media_urls: [] });
    });
    if (tweets.length > 0) return tweets;
  }
  return null;
}

function parseCarouselFromContent(content: string): Array<{ id: string; text: string; media_urls: string[] }> | null {
  const slides: Array<{ id: string; text: string; media_urls: string[] }> = [];
  const pagePat = /(?:^|\n)(?:Página|Slide|Capa)\s*(\d+)?[:.]?\s*([\s\S]*?)(?=(?:\n(?:Página|Slide|Capa)\s*\d?[:.])|\n---|\n\nLEGENDA:|$)/gi;
  let m;
  let i = 0;
  while ((m = pagePat.exec(content)) !== null) {
    i++;
    const t = m[2].trim();
    if (t && !t.toLowerCase().startsWith('legenda')) {
      slides.push({ id: `slide-${m[1] || i}`, text: t, media_urls: [] });
    }
  }
  if (slides.length > 0) return slides;
  const parts = content.split(/\n---\n/);
  if (parts.length > 1) {
    parts.forEach((p, idx) => {
      const t = p.trim();
      if (t && !t.toLowerCase().startsWith('legenda') && !t.toLowerCase().includes('legenda para')) {
        slides.push({ id: `slide-${idx + 1}`, text: t, media_urls: [] });
      }
    });
    if (slides.length > 0) return slides;
  }
  const numbered = /(?:^|\n)(\d+)\.\s+([\s\S]*?)(?=(?:\n\d+\.)|$)/g;
  while ((m = numbered.exec(content)) !== null) {
    const t = m[2].trim();
    if (t) slides.push({ id: `slide-${m[1]}`, text: t, media_urls: [] });
  }
  if (slides.length >= 3) return slides;
  return null;
}

// =====================================================
// LLM CALL
// =====================================================
async function generateTextWithGemini(
  prompt: string,
  format: string,
  context: { userId: string | null; clientId: string | null; platform?: string | null }
): Promise<string> {
  const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_AI_STUDIO_API_KEY missing');
  const cfg = selectModelForFormat(format);
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: cfg.temperature, maxOutputTokens: cfg.maxTokens },
      }),
    }
  );
  if (!r.ok) {
    const t = await r.text();
    console.error('[process-automations] Gemini error:', r.status, t);
    throw new Error(`Gemini ${r.status}`);
  }
  const data = await r.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (context.userId) {
    const inTok = data?.usageMetadata?.promptTokenCount ?? estimateTokens(prompt);
    const outTok = data?.usageMetadata?.candidatesTokenCount ?? estimateTokens(text);
    await logAIUsage(context.userId, cfg.model, 'process-automations', inTok, outTok, {
      client_id: context.clientId, format, platform: context.platform,
    });
  }
  return text;
}

// =====================================================
// SUB-CALL helpers (image generation, telegram, late-post)
// These call our own /api/<name> endpoints to reuse logic.
// =====================================================
function getOrigin(req: VercelRequest): string {
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
  const host = req.headers.host || 'localhost:3000';
  return `${proto}://${host}`;
}

async function callInternal(req: VercelRequest, path: string, body: any, authToken?: string): Promise<any> {
  const origin = getOrigin(req);
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    else if (req.headers.authorization) headers.Authorization = String(req.headers.authorization);
    const r = await fetch(`${origin}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
    const json = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, data: json };
  } catch (e: any) {
    console.warn(`[internal call] ${path} failed:`, e.message);
    return { ok: false, status: 0, data: { error: e.message } };
  }
}

// =====================================================
// MAIN
// =====================================================
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res);
  if (req.method !== 'POST') return jsonError(res, 405, 'Method not allowed');

  // Auth: cron service-role OR authenticated user
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.authorization;
  const isCron =
    (req.headers['x-vercel-cron'] === '1') ||
    (cronSecret && auth === `Bearer ${cronSecret}`);
  let user = null;
  if (!isCron) {
    user = await tryAuth(req);
    if (!user) return jsonError(res, 401, 'Unauthorized');
  }

  let automationId: string | null = null;
  let isManualTest = false;
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : (req.body ? JSON.parse(req.body) : {});
    automationId = body.automationId || null;
    isManualTest = !!automationId;
  } catch { /* no body */ }

  console.log(`[process-automations] start ${isManualTest ? `(manual: ${automationId})` : '(scheduled)'}`);

  // Defesa contra IDOR: se for manual test (user logado com automationId), garantir
  // que ele é membro do workspace da automation antes de rodar.
  if (isManualTest && user && automationId) {
    const aut = await queryOne<{ workspace_id: string }>(
      `SELECT workspace_id FROM planning_automations WHERE id = $1 LIMIT 1`,
      [automationId],
    );
    if (!aut) return jsonError(res, 404, 'Automation não encontrada');
    const member = await queryOne<{ id: string }>(
      `SELECT id FROM workspace_members WHERE workspace_id = $1 AND user_id = $2 LIMIT 1`,
      [aut.workspace_id, user.id],
    );
    if (!member) return jsonError(res, 403, 'Acesso negado a essa automation');
  }

  const automations = automationId
    ? await query<PlanningAutomation>(`SELECT * FROM planning_automations WHERE id = $1`, [automationId])
    : await query<PlanningAutomation>(`SELECT * FROM planning_automations WHERE is_active = true`);

  console.log(`[process-automations] ${automations.length} automation(s)`);

  const results: Array<{ id: string; name: string; triggered: boolean; error?: string; runId?: string; itemId?: string }> = [];

  for (const automation of automations) {
    const startTime = Date.now();
    let runId: string | null = null;

    try {
      const run = await insertRow<any>('planning_automation_runs', {
        automation_id: automation.id,
        workspace_id: automation.workspace_id,
        status: 'running',
        started_at: new Date().toISOString(),
      }).catch(() => null);
      runId = run?.id ?? null;

      let shouldTrigger = false;
      let triggerData: RSSItem | null = null;
      let newGuid: string | undefined;

      if (isManualTest) {
        shouldTrigger = true;
        if (automation.trigger_type === 'rss' && automation.trigger_config.url) {
          const items = await parseRSSFeed(automation.trigger_config.url);
          if (items.length > 0) { triggerData = items[0]; newGuid = items[0].guid; }
        }
      } else {
        switch (automation.trigger_type) {
          case 'schedule':
            shouldTrigger = shouldTriggerSchedule(automation.trigger_config, automation.last_triggered_at);
            break;
          case 'rss': {
            const r = await checkRSSTrigger(automation.trigger_config);
            shouldTrigger = r.shouldTrigger; triggerData = r.data || null; newGuid = r.newGuid;
            break;
          }
          case 'webhook':
            shouldTrigger = false;
            break;
        }
      }

      if (!shouldTrigger) {
        if (runId) {
          await getPool().query(
            `UPDATE planning_automation_runs SET status = $1, result = $2, completed_at = NOW(), duration_ms = $3 WHERE id = $4`,
            ['skipped', 'Trigger conditions not met', Date.now() - startTime, runId]
          );
        }
        results.push({ id: automation.id, name: automation.name, triggered: false, runId: runId || undefined });
        continue;
      }

      // Lock atômico para evitar race-condition entre crons concorrentes.
      // UPDATE ... WHERE last_triggered_at IS NULL OR not-today garante 1 disparo/dia.
      // Manual test (isManualTest) bypassa o lock.
      if (!isManualTest && automation.trigger_type === 'schedule') {
        const lockResult = await getPool().query(
          `UPDATE planning_automations
              SET last_triggered_at = NOW()
            WHERE id = $1
              AND (last_triggered_at IS NULL
                   OR DATE(last_triggered_at AT TIME ZONE 'UTC') < DATE(NOW() AT TIME ZONE 'UTC'))
            RETURNING id`,
          [automation.id]
        );
        if (lockResult.rowCount === 0) {
          // Outro processo já pegou hoje. Marca run como skipped + segue.
          if (runId) {
            await getPool().query(
              `UPDATE planning_automation_runs SET status = $1, result = $2, completed_at = NOW(), duration_ms = $3 WHERE id = $4`,
              ['skipped', 'Already triggered today (race lock)', Date.now() - startTime, runId]
            );
          }
          results.push({ id: automation.id, name: automation.name, triggered: false, runId: runId || undefined });
          continue;
        }
      }

      console.log(`[process-automations] triggering: ${automation.name}`);

      const itemTitle = triggerData?.title || automation.name;
      const itemDescription = triggerData?.description?.replace(/<[^>]*>/g, '').substring(0, 500) || '';
      const maxImages = automation.content_type === 'tweet' ? 1 : 4;
      const mediaUrls: string[] = triggerData?.allImages?.slice(0, maxImages) || [];

      const derivedPlatform = automation.platform || PLATFORM_MAP[automation.content_type] || null;
      let format = FORMAT_MAP[automation.content_type] || 'post';
      if (automation.content_type === 'social_post') {
        if (derivedPlatform === 'threads' || derivedPlatform === 'twitter') format = 'tweet';
        else if (derivedPlatform === 'linkedin') format = 'linkedin';
      }

      // Get column
      let columnId = automation.target_column_id;
      if (!columnId) {
        const col = await queryOne<any>(
          `SELECT id FROM kanban_columns WHERE workspace_id = $1 AND is_default = true LIMIT 1`,
          [automation.workspace_id]
        );
        columnId = col?.id;
      }
      const countRow = await queryOne<any>(`SELECT COUNT(*)::int AS c FROM planning_items WHERE column_id = $1`, [columnId]);
      const position = (countRow?.c || 0) + 1;

      const targetPlatforms: string[] = (automation.platforms && automation.platforms.length > 0)
        ? automation.platforms
        : (derivedPlatform ? [derivedPlatform] : []);

      const metadata: Record<string, unknown> = {
        automation_id: automation.id,
        automation_name: automation.name,
        trigger_type: automation.trigger_type,
        source_url: triggerData?.link,
        rss_images: mediaUrls,
        target_platforms: targetPlatforms,
      };

      // Status inicial honra o dropdown da AutomationDialog (Audit F).
      // auto_publish=true sobrescreve depois (vai pra published).
      const initialStatus =
        (automation as any).status_after_generation === 'draft' ? 'draft' :
        (automation as any).status_after_generation === 'approved' ? 'approved' :
        'idea';

      const newItem = await insertRow<any>('planning_items', {
        workspace_id: automation.workspace_id,
        client_id: automation.client_id,
        column_id: columnId,
        title: itemTitle,
        description: itemDescription,
        platform: derivedPlatform,
        content_type: automation.content_type,
        position,
        status: initialStatus,
        media_urls: mediaUrls,
        created_by: automation.created_by || '00000000-0000-0000-0000-000000000000',
        metadata: JSON.stringify(metadata),
      });

      let generatedContent: string | null = null;
      let updatedMetadata = { ...metadata };

      // ============ CONTENT GENERATION ============
      if (automation.auto_generate_content && automation.client_id) {
        try {
          // Enriched context
          let enrichedContext = '';
          try {
            enrichedContext = await getFullContentContext({
              clientId: automation.client_id,
              format,
              workspaceId: automation.workspace_id,
              includeLibrary: true,
              includeTopPerformers: true,
              includeGlobalKnowledge: true,
              includeSuccessPatterns: true,
              includeChecklist: true,
              maxLibraryExamples: 3,
              maxTopPerformers: 3,
            });
            const voiceSection = await getStructuredVoice(automation.client_id);
            if (voiceSection) enrichedContext = `${voiceSection}\n\n---\n\n${enrichedContext}`;
          } catch (e) {
            console.warn('[process-automations] context error:', e);
          }

          // Feedback loop (simple version)
          try {
            const negFb = await query<any>(
              `SELECT content_snapshot, feedback_reason, feedback_type
               FROM automation_content_feedback
               WHERE client_id = $1 AND feedback_type IN ('dislike', 'delete')
               ORDER BY created_at DESC LIMIT 5`,
              [automation.client_id]
            );
            if (negFb.length > 0) {
              let fb = `\n\n🚫 FEEDBACK NEGATIVO (NÃO repita):\n`;
              for (const f of negFb) {
                const snip = (f.content_snapshot || '').substring(0, 300);
                const reason = f.feedback_reason ? ` | Motivo: "${f.feedback_reason}"` : '';
                const action = f.feedback_type === 'delete' ? '🗑️ APAGADO' : '👎 NÃO GOSTOU';
                fb += `- [${action}${reason}]: "${snip}"\n`;
              }
              enrichedContext += fb;
            }
            const posFb = await query<any>(
              `SELECT content_snapshot FROM automation_content_feedback
               WHERE client_id = $1 AND feedback_type = 'like'
               ORDER BY created_at DESC LIMIT 3`,
              [automation.client_id]
            );
            if (posFb.length > 0) {
              let pf = `\n\n✅ APROVADOS (use como referência):\n`;
              for (const f of posFb) {
                const snip = (f.content_snapshot || '').substring(0, 300);
                if (snip) pf += `- "${snip}"\n`;
              }
              enrichedContext += pf;
            }
          } catch (e) {
            console.warn('[process-automations] feedback error:', e);
          }

          // Variation context per content_type
          let variationContext: { category: string; instruction: string; recentTweets: string[] } | undefined;

          if (automation.content_type === 'tweet') {
            const { index, variation, updatedRecentIndices } = selectVariationWithCooldown(
              GM_VARIATION_CATEGORIES, automation.trigger_config
            );
            const recent = await query<any>(
              `SELECT content FROM twitter_posts WHERE client_id = $1 AND content IS NOT NULL
               ORDER BY posted_at DESC LIMIT 12`,
              [automation.client_id]
            ).catch(() => []);
            const recentTweets = (recent || []).map((p: any) => p.content).filter(Boolean);
            variationContext = {
              category: variation.name,
              instruction: variation.instruction + getLengthModifier(),
              recentTweets,
            };
            await getPool().query(
              `UPDATE planning_automations SET trigger_config = $1::jsonb WHERE id = $2`,
              [JSON.stringify({ ...automation.trigger_config, variation_index: index + 1, recent_variation_indices: updatedRecentIndices }), automation.id]
            ).catch(() => null);
          }

          if (automation.content_type === 'linkedin_post') {
            let editorialType = 'opinion';
            if (automation.name.toLowerCase().includes('building')) editorialType = 'building_in_public';
            else if (automation.name.toLowerCase().includes('case') || automation.name.toLowerCase().includes('prova')) editorialType = 'case_study';
            const cats = LINKEDIN_VARIATION_CATEGORIES[editorialType] || LINKEDIN_VARIATION_CATEGORIES.opinion;
            const { index, variation, updatedRecentIndices } = selectVariationWithCooldown(cats, automation.trigger_config);
            const recent = await query<any>(
              `SELECT content FROM planning_items WHERE client_id = $1 AND platform = 'linkedin'
               AND content IS NOT NULL ORDER BY created_at DESC LIMIT 12`,
              [automation.client_id]
            ).catch(() => []);
            const recentPosts = (recent || []).map((p: any) => (p.content || '').substring(0, 300)).filter(Boolean);
            variationContext = {
              category: `LinkedIn ${editorialType}: ${variation.name}`,
              instruction: `${variation.instruction}${getLengthModifier()}\n\nFORMATO LINKEDIN: gancho nas 2 primeiras linhas, parágrafos curtos, ZERO hashtags, 1.200-1.500 caracteres.`,
              recentTweets: recentPosts,
            };
            await getPool().query(
              `UPDATE planning_automations SET trigger_config = $1::jsonb WHERE id = $2`,
              [JSON.stringify({ ...automation.trigger_config, variation_index: index + 1, recent_variation_indices: updatedRecentIndices }), automation.id]
            ).catch(() => null);
          }

          if (automation.content_type === 'social_post' && derivedPlatform === 'threads') {
            const { index, variation, updatedRecentIndices } = selectVariationWithCooldown(
              THREADS_VARIATION_CATEGORIES, automation.trigger_config
            );
            const recent = await query<any>(
              `SELECT content FROM planning_items WHERE client_id = $1 AND platform = 'threads'
               AND content IS NOT NULL ORDER BY created_at DESC LIMIT 12`,
              [automation.client_id]
            ).catch(() => []);
            const recentPosts = (recent || []).map((p: any) => (p.content || '').substring(0, 300)).filter(Boolean);
            variationContext = {
              category: `Threads: ${variation.name}`,
              instruction: variation.instruction + getLengthModifier(),
              recentTweets: recentPosts,
            };
            await getPool().query(
              `UPDATE planning_automations SET trigger_config = $1::jsonb WHERE id = $2`,
              [JSON.stringify({ ...automation.trigger_config, variation_index: index + 1, recent_variation_indices: updatedRecentIndices }), automation.id]
            ).catch(() => null);
          }

          // RSS-aware prompt
          const rssPrompt = await buildEnrichedPrompt(
            automation.prompt_template,
            triggerData,
            automation,
            automation.content_type,
            mediaUrls,
            variationContext
          );

          // Combine context + prompt
          const finalPrompt = enrichedContext
            ? `${enrichedContext}\n\n---\n\n## MATERIAL DE REFERÊNCIA:\n\n${rssPrompt}`
            : rssPrompt;

          console.log(`[process-automations] prompt ${finalPrompt.length} chars`);

          generatedContent = await generateTextWithGemini(finalPrompt, format, {
            userId: automation.created_by,
            clientId: automation.client_id,
            platform: derivedPlatform,
          });

          generatedContent = cleanContentOutput(generatedContent || '', derivedPlatform || undefined);

          // Parse thread/carousel structures
          if (automation.content_type === 'thread' && generatedContent) {
            const tweets = parseThreadFromContent(generatedContent);
            if (tweets && tweets.length > 0) {
              if (mediaUrls.length > 0) {
                const perTweet = Math.ceil(mediaUrls.length / Math.min(tweets.length, 4));
                let imgIdx = 0;
                for (let i = 0; i < tweets.length && imgIdx < mediaUrls.length; i++) {
                  const imgs: string[] = [];
                  for (let j = 0; j < perTweet && imgIdx < mediaUrls.length; j++) imgs.push(mediaUrls[imgIdx++]);
                  tweets[i].media_urls = imgs;
                }
              }
              updatedMetadata.thread_tweets = tweets;
            }
          }
          if (automation.content_type === 'carousel' && generatedContent) {
            const slides = parseCarouselFromContent(generatedContent);
            if (slides && slides.length > 0) {
              if (mediaUrls.length > 0) {
                const perSlide = Math.ceil(mediaUrls.length / Math.min(slides.length, mediaUrls.length));
                let imgIdx = 0;
                for (let i = 0; i < slides.length && imgIdx < mediaUrls.length; i++) {
                  const imgs: string[] = [];
                  for (let j = 0; j < perSlide && imgIdx < mediaUrls.length; j++) imgs.push(mediaUrls[imgIdx++]);
                  slides[i].media_urls = imgs;
                }
              }
              updatedMetadata.carousel_slides = slides;
            }
          }

          await getPool().query(
            `UPDATE planning_items SET content = $1, metadata = $2::jsonb WHERE id = $3`,
            [generatedContent, JSON.stringify(updatedMetadata), newItem.id]
          );

          // Move to review column if not auto-publish
          if (!automation.auto_publish && generatedContent) {
            const reviewCol = await queryOne<any>(
              `SELECT id FROM kanban_columns WHERE workspace_id = $1 AND column_type = 'review' LIMIT 1`,
              [automation.workspace_id]
            ).catch(() => null);
            if (reviewCol?.id) {
              const meta2 = { ...updatedMetadata, pending_telegram_approval: true, auto_publish_on_approve: true };
              await getPool().query(
                `UPDATE planning_items SET column_id = $1, status = 'review', metadata = $2::jsonb WHERE id = $3`,
                [reviewCol.id, JSON.stringify(meta2), newItem.id]
              );
            }
          }
        } catch (genError) {
          console.error(`[process-automations] gen error for ${automation.name}:`, genError);
        }
      }

      // ============ IMAGE GENERATION ============
      if (automation.auto_generate_image && automation.client_id) {
        try {
          let imagePromptOverride = '';
          if (automation.image_prompt_template) {
            imagePromptOverride = await replaceTemplateVariables(automation.image_prompt_template, triggerData, automation.name);
          }
          const isLinkedIn = derivedPlatform === 'linkedin';
          const imgResp = await callInternal(req, '/api/generate-content-v2', {
            type: 'image',
            inputs: [{ type: 'text', content: imagePromptOverride || (generatedContent || itemTitle).substring(0, 1000) }],
            config: {
              format: isLinkedIn ? 'linkedin_post' : 'post',
              platform: derivedPlatform,
              aspectRatio: isLinkedIn ? '16:9' : '1:1',
              noText: true,
            },
            clientId: automation.client_id,
            workspaceId: automation.workspace_id,
          });
          if (imgResp.ok && imgResp.data?.imageUrl) {
            mediaUrls.unshift(imgResp.data.imageUrl);
            updatedMetadata = {
              ...updatedMetadata,
              generated_image_url: imgResp.data.imageUrl,
              image_style: automation.image_style,
            };
            await getPool().query(
              `UPDATE planning_items SET media_urls = $1, metadata = $2::jsonb WHERE id = $3`,
              [mediaUrls, JSON.stringify(updatedMetadata), newItem.id]
            );
          } else {
            console.warn('[process-automations] image gen failed for', automation.name, imgResp.status, imgResp.data?.error);
          }
        } catch (e) {
          console.error('[process-automations] image exception:', e);
        }
      }

      // ============ AUTO-PUBLISH ============
      if (automation.auto_publish && automation.client_id && generatedContent) {
        const publishedPlatforms: string[] = [];
        const publishedUrls: Record<string, string> = {};
        const latePostIds: Record<string, string> = {};
        const publishErrors: Array<{ platform: string; error: string }> = [];

        for (const target of targetPlatforms) {
          try {
            const publishBody: any = {
              clientId: automation.client_id,
              platform: target,
              content: generatedContent,
              planningItemId: newItem.id,
            };
            const tweets = (updatedMetadata as any).thread_tweets;
            if (automation.content_type === 'thread' && Array.isArray(tweets) && tweets.length > 0) {
              publishBody.threadItems = tweets.map((t: any) => ({
                text: typeof t.text === 'string' ? t.text : '',
                media_urls: Array.isArray(t.media_urls) ? t.media_urls.filter((u: any) => typeof u === 'string') : [],
              }));
            }
            if (!publishBody.threadItems && mediaUrls.length > 0) {
              publishBody.mediaItems = mediaUrls.map((url) => ({
                url,
                type: url.match(/\.(mp4|mov|webm)$/i) ? 'video' : 'image',
              }));
            }
            const resp = await callInternal(req, '/api/late-post', publishBody);
            if (resp.ok && resp.data?.success && (resp.data.externalId || resp.data.postId)) {
              const id = resp.data.externalId || resp.data.postId;
              publishedPlatforms.push(target);
              latePostIds[target] = id;
              if (resp.data.postUrl || resp.data.url) publishedUrls[target] = resp.data.postUrl || resp.data.url;
            } else {
              const errMsg = resp.data?.error || `HTTP ${resp.status}`;
              const friendly = /not connected|missing.*account|no integration|account_not_found|invalid_credential/i.test(errMsg)
                ? `Plataforma ${target} não conectada para este cliente. Conecte via Integrações.`
                : errMsg;
              publishErrors.push({ platform: target, error: friendly });
              console.warn(`[publish] ${target} failed:`, errMsg);
            }
          } catch (e: any) {
            publishErrors.push({ platform: target, error: e?.message || 'Exception' });
            console.error(`[publish] ${target} exception:`, e);
          }
        }

        // Persiste publishErrors no metadata pra UI mostrar
        if (publishErrors.length > 0) {
          updatedMetadata = { ...updatedMetadata, publish_errors: publishErrors };
          await getPool().query(
            `UPDATE planning_items SET metadata = $1::jsonb WHERE id = $2`,
            [JSON.stringify(updatedMetadata), newItem.id],
          ).catch(() => null);
        }

        if (publishedPlatforms.length > 0) {
          const pubCol = await queryOne<any>(
            `SELECT id FROM kanban_columns WHERE workspace_id = $1 AND column_type = 'published' LIMIT 1`,
            [automation.workspace_id]
          ).catch(() => null);
          const meta3 = {
            ...updatedMetadata,
            auto_published: true,
            published_at: new Date().toISOString(),
            published_platforms: publishedPlatforms,
            late_post_ids: latePostIds,
            published_urls: publishedUrls,
            automation_id: automation.id,
            automation_name: automation.name,
          };
          await getPool().query(
            `UPDATE planning_items SET status = 'published', published_at = NOW(), column_id = $1,
             external_post_id = $2, metadata = $3::jsonb WHERE id = $4`,
            [pubCol?.id || columnId, Object.values(latePostIds)[0] || null, JSON.stringify(meta3), newItem.id]
          );
        }
      }

      // ============ AUTOMATION TRACKING ============
      const updateData: any = {
        last_triggered_at: new Date().toISOString(),
        items_created: (automation.items_created || 0) + 1,
      };
      if (automation.trigger_type === 'rss' && newGuid) {
        updateData.trigger_config = JSON.stringify({
          ...automation.trigger_config, last_guid: newGuid, last_checked: new Date().toISOString(),
        });
      }
      const setClause = Object.keys(updateData).map((k, i) => `"${k}" = $${i + 1}${k === 'trigger_config' ? '::jsonb' : ''}`).join(', ');
      await getPool().query(
        `UPDATE planning_automations SET ${setClause} WHERE id = $${Object.keys(updateData).length + 1}`,
        [...Object.values(updateData), automation.id]
      );

      // ============ NOTIFICATIONS ============
      const notifyUserId = automation.created_by;
      if (notifyUserId) {
        try {
          await getPool().query(
            `INSERT INTO notifications (user_id, workspace_id, type, title, message, entity_type, entity_id, metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
            [
              notifyUserId, automation.workspace_id, 'automation_completed',
              `Automação executada: ${automation.name}`,
              `Criado: "${itemTitle}"`,
              'planning_item', newItem.id,
              JSON.stringify({
                automation_id: automation.id,
                automation_name: automation.name,
                trigger_type: automation.trigger_type,
                content_type: automation.content_type,
              }),
            ]
          );
        } catch (e) {
          console.warn('[notification] error:', e);
        }
      }

      // Telegram (best-effort, fire-and-forget)
      try {
        let clientName = 'N/A';
        if (automation.client_id) {
          const cd = await queryOne<any>(`SELECT name FROM clients WHERE id = $1`, [automation.client_id]).catch(() => null);
          clientName = cd?.name || 'N/A';
        }
        callInternal(req, '/api/telegram-notify', {
          item_id: newItem.id,
          title: itemTitle,
          content: generatedContent || itemDescription || '',
          image_url: mediaUrls[0] || null,
          platform: derivedPlatform,
          client_name: clientName,
          automation_name: automation.name,
          content_type: automation.content_type,
          published: false,
        }).catch(() => null);
      } catch (e) {
        console.warn('[telegram] error:', e);
      }

      // Run record done
      const triggerDataForRun: Record<string, unknown> = {
        item_id: newItem.id,
        generated_content: generatedContent ? generatedContent.substring(0, 500) : null,
        title: triggerData?.title,
        link: triggerData?.link,
        images_count: triggerData?.allImages?.length || 0,
      };
      if (runId) {
        await getPool().query(
          `UPDATE planning_automation_runs SET status = $1, result = $2, items_created = 1,
           completed_at = NOW(), duration_ms = $3, trigger_data = $4::jsonb WHERE id = $5`,
          [
            'completed',
            generatedContent ? `Criado e gerado: ${itemTitle}` : `Criado: ${itemTitle}`,
            Date.now() - startTime,
            JSON.stringify(triggerDataForRun),
            runId,
          ]
        );
      }

      results.push({ id: automation.id, name: automation.name, triggered: true, runId: runId || undefined, itemId: newItem.id });
    } catch (autoError) {
      console.error(`[process-automations] error in ${automation.name}:`, autoError);
      if (runId) {
        await getPool().query(
          `UPDATE planning_automation_runs SET status = 'failed', error = $1, completed_at = NOW(), duration_ms = $2 WHERE id = $3`,
          [autoError instanceof Error ? autoError.message : 'Unknown error', Date.now() - startTime, runId]
        ).catch(() => null);
      }
      results.push({
        id: automation.id, name: automation.name, triggered: false,
        error: autoError instanceof Error ? autoError.message : 'Unknown error',
        runId: runId || undefined,
      });
    }
  }

  const triggered = results.filter((r) => r.triggered).length;
  console.log(`[process-automations] done: ${triggered}/${results.length}`);
  return res.status(200).json({ success: true, processed: results.length, triggered, results });
}
