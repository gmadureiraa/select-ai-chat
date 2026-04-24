import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { 
  FORMAT_MAP, 
  PLATFORM_MAP, 
  CONTENT_TYPE_LABELS,
  getFormatLabel 
} from "../_shared/format-constants.ts";
import { getFullContentContext, getStructuredVoice } from "../_shared/knowledge-loader.ts";
import { buildImageBriefing } from "../_shared/prompt-builder.ts";
import { detectContentStructure, detectOpeningPatterns } from "../_shared/quality-rules.ts";

// =====================================================
// HELPER: Random rotation with cooldown
// =====================================================
function selectVariationWithCooldown(
  categories: Array<{ name: string; instruction: string }>,
  triggerConfig: RSSConfig,
): { index: number; variation: { name: string; instruction: string }; updatedRecentIndices: number[] } {
  const recentIndices: number[] = triggerConfig.recent_variation_indices || [];
  
  // Build list of available indices (exclude recently used)
  let available = Array.from({ length: categories.length }, (_, i) => i)
    .filter(i => !recentIndices.includes(i));
  
  // If all are exhausted, reset cooldown
  if (available.length === 0) {
    available = Array.from({ length: categories.length }, (_, i) => i);
  }
  
  // Random selection from available
  const selectedIndex = available[Math.floor(Math.random() * available.length)];
  
  // Update cooldown (keep last 3)
  const updatedRecentIndices = [...recentIndices, selectedIndex].slice(-3);
  
  return {
    index: selectedIndex,
    variation: categories[selectedIndex],
    updatedRecentIndices,
  };
}

// =====================================================
// HELPER: Content length variation modifier
// =====================================================
function getLengthModifier(): string {
  const rand = Math.random();
  if (rand < 0.3) {
    return '\n\n📏 COMPRIMENTO: BREVE. Máximo 2 frases. Brevidade é poder. Diga o essencial e pare.';
  } else if (rand < 0.7) {
    return ''; // normal — no modifier
  } else {
    return '\n\n📏 COMPRIMENTO: DETALHADO. Desenvolva com 4-5 frases. Use detalhes concretos, exemplos específicos.';
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

type JsonObject = Record<string, unknown>;

function toRecord(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function toRecordArray(value: unknown): JsonObject[] {
  return Array.isArray(value)
    ? value.filter((item): item is JsonObject => !!item && typeof item === 'object' && !Array.isArray(item))
    : [];
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
  // Image generation fields
  auto_generate_image: boolean;
  image_prompt_template: string | null;
  image_style: 'photographic' | 'illustration' | 'minimalist' | 'vibrant' | null;
  image_reference_ids: string[] | null;
  platforms?: string[] | null;
  // Tracking
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

// Clean content output: remove AI formatting labels like "TEXTO DO VISUAL:", "LEGENDA:", markdown bold, etc.
// Applied to ALL text-based content types (tweet, social_post, thread, linkedin_post, etc.)
function cleanContentOutput(content: string, platform?: string): string {
  if (!content) return content;
  
  let cleaned = content;
  
  // Remove code block wrappers (```...```)
  cleaned = cleaned.replace(/^```[\s\S]*?\n([\s\S]*?)```\s*$/gm, '$1');
  cleaned = cleaned.replace(/^```\s*\n?/gm, '').replace(/\n?```\s*$/gm, '');
  
  // For text-only platforms (twitter, threads, linkedin), extract only the caption/legenda
  const isTextOnlyPlatform = ['twitter', 'threads', 'linkedin'].includes(platform || '');
  
  // Pattern: **TEXTO DO VISUAL:** ... --- **LEGENDA:** ... → keep only the LEGENDA part
  const legendaMatch = cleaned.match(/\*{0,2}LEGENDA[:\s]*\*{0,2}\s*([\s\S]+)/i);
  const textoVisualMatch = cleaned.match(/\*{0,2}TEXTO\s*(?:DO\s*)?VISUAL[:\s]*\*{0,2}\s*([\s\S]+?)(?:\n---|\n\n\*{0,2}LEGENDA)/i);
  
  if (legendaMatch && (isTextOnlyPlatform || cleaned.includes('TEXTO DO VISUAL'))) {
    // If there's a LEGENDA section, use that as the post text
    cleaned = legendaMatch[1].trim();
  } else if (textoVisualMatch && !cleaned.includes('LEGENDA') && isTextOnlyPlatform) {
    // If there's only TEXTO DO VISUAL and no LEGENDA, use that
    cleaned = textoVisualMatch[1].trim();
  }
  
  // Remove remaining markdown formatting
  cleaned = cleaned.replace(/\*{2}([^*]+)\*{2}/g, '$1'); // **bold** → bold
  cleaned = cleaned.replace(/^#+\s+/gm, ''); // ## headers
  cleaned = cleaned.replace(/^---+$/gm, ''); // --- separators
  cleaned = cleaned.replace(/^\s*[-*]\s+/gm, ''); // bullet points
  
  // Remove label prefixes that might remain
  cleaned = cleaned.replace(/^(?:TWEET|LEGENDA|TEXTO|CAPTION|POST|TEXTO DO VISUAL)[:\s]*/im, '');
  
  // Remove "TEXTO DO VISUAL:" blocks entirely for text-only platforms
  if (isTextOnlyPlatform) {
    cleaned = cleaned.replace(/\*{0,2}TEXTO\s*(?:DO\s*)?VISUAL[:\s]*\*{0,2}[^\n]*\n*/gi, '');
  }
  
  // Clean up excessive whitespace
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
  
  // Remove surrounding quotes if the entire text is quoted
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || 
      (cleaned.startsWith('"') && cleaned.endsWith('"'))) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  
  return cleaned;
}

// Transcribe YouTube video for richer content generation
async function transcribeYouTubeVideo(
  videoUrl: string,
  supabaseUrl: string,
  supabaseKey: string,
): Promise<string | null> {
  try {
    console.log(`[YouTube] Transcribing video: ${videoUrl}`);
    
    const response = await fetch(`${supabaseUrl}/functions/v1/youtube-transcribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ url: videoUrl }),
    });
    
    if (!response.ok) {
      console.warn(`[YouTube] Transcription failed: ${response.status}`);
      return null;
    }
    
    const result = await response.json();
    const transcript = result.transcript || result.text || result.content;
    
    if (transcript) {
      console.log(`[YouTube] Transcript obtained: ${transcript.length} chars`);
      return transcript.substring(0, 5000); // Limit to 5000 chars
    }
    
    return null;
  } catch (error) {
    console.warn(`[YouTube] Transcription error:`, error);
    return null;
  }
}

// Extract images from HTML content
function extractImagesFromHTML(html: string): string[] {
  const images: string[] = [];
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match;
  
  while ((match = imgRegex.exec(html)) !== null) {
    const src = match[1];
    // Filter out tracking pixels and icons
    if (src && !src.includes('pixel') && !src.includes('tracking') && !src.includes('icon')) {
      images.push(src);
    }
  }
  
  // Also look for og:image or twitter:image meta patterns if present
  const metaImageRegex = /content=["']([^"']+\.(jpg|jpeg|png|gif|webp)[^"']*)["']/gi;
  while ((match = metaImageRegex.exec(html)) !== null) {
    if (!images.includes(match[1])) {
      images.push(match[1]);
    }
  }
  
  return images.slice(0, 10); // Limit to 10 images
}

// Parse Atom feed (YouTube format)
function parseAtomEntries(text: string): RSSItem[] {
  const items: RSSItem[] = [];
  const entryMatches = text.match(/<entry[\s\S]*?<\/entry>/gi) || [];
  
  console.log(`Parsing Atom feed, found ${entryMatches.length} entries`);
  
  for (const entryXml of entryMatches) {
    const videoId = entryXml.match(/<yt:videoId[^>]*>([\s\S]*?)<\/yt:videoId>/i)?.[1]?.trim() || '';
    const title = entryXml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || '';
    const published = entryXml.match(/<published[^>]*>([\s\S]*?)<\/published>/i)?.[1]?.trim() || '';
    const updated = entryXml.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i)?.[1]?.trim() || '';
    const description = entryXml.match(/<media:description[^>]*>([\s\S]*?)<\/media:description>/i)?.[1]?.trim() || '';
    const thumbnail = entryXml.match(/<media:thumbnail[^>]*url="([^"]+)"/i)?.[1] || '';
    const link = entryXml.match(/<link[^>]*href="([^"]+)"/i)?.[1] || '';
    
    const cleanDescription = description
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .substring(0, 500);
    
    const videoUrl = link || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : '');
    const thumbUrl = thumbnail || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '');
    
    items.push({
      title,
      link: videoUrl,
      description: cleanDescription,
      content: description,
      pubDate: published || updated,
      guid: videoId ? `yt:video:${videoId}` : videoUrl,
      imageUrl: thumbUrl,
      allImages: thumbUrl ? [thumbUrl] : [],
    });
  }
  
  return items;
}

// Parse RSS feed with full content and images (supports both RSS and Atom/YouTube)
async function parseRSSFeed(url: string): Promise<RSSItem[]> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Kaleidos/1.0)',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*'
      }
    });
    const text = await response.text();
    
    // Detect Atom format (YouTube uses this)
    const isAtom = text.includes('<feed') && text.includes('<entry');
    if (isAtom) {
      console.log('Detected Atom format (YouTube)');
      return parseAtomEntries(text);
    }
    
    console.log('Detected RSS format');
    const items: RSSItem[] = [];
    const itemMatches = text.match(/<item[\s\S]*?<\/item>/gi) || [];
    
    for (const itemXml of itemMatches) {
      const title = itemXml.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1]?.trim() || '';
      const link = itemXml.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1]?.trim() || '';
      const description = itemXml.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)?.[1]?.trim();
      const content = itemXml.match(/<content:encoded[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/content:encoded>/i)?.[1]?.trim() 
                   || itemXml.match(/<content[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/content>/i)?.[1]?.trim();
      const pubDate = itemXml.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim();
      const guid = itemXml.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i)?.[1]?.trim() || link;
      
      const allImages: string[] = [];
      
      const mediaUrl = itemXml.match(/<media:content[^>]+url=["']([^"']+)["']/i)?.[1];
      if (mediaUrl) allImages.push(mediaUrl);
      
      const thumbnailUrl = itemXml.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i)?.[1];
      if (thumbnailUrl && !allImages.includes(thumbnailUrl)) allImages.push(thumbnailUrl);
      
      const enclosureUrl = itemXml.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]+type=["']image/i)?.[1];
      if (enclosureUrl && !allImages.includes(enclosureUrl)) allImages.push(enclosureUrl);
      
      if (content) {
        const contentImages = extractImagesFromHTML(content);
        for (const img of contentImages) {
          if (!allImages.includes(img)) allImages.push(img);
        }
      }
      
      if (description) {
        const descImages = extractImagesFromHTML(description);
        for (const img of descImages) {
          if (!allImages.includes(img)) allImages.push(img);
        }
      }
      
      items.push({ 
        title, 
        link, 
        description, 
        content,
        pubDate, 
        guid,
        imageUrl: allImages[0],
        allImages: allImages.slice(0, 8),
      });
    }
    
    return items;
  } catch (error) {
    console.error(`Error parsing RSS feed ${url}:`, error);
    return [];
  }
}

// Check if schedule trigger should fire
function shouldTriggerSchedule(config: ScheduleConfig, lastTriggered: string | null): boolean {
  const now = new Date();
  const today = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const dayOfMonth = now.getDate();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  
  // Check if we already triggered today
  if (lastTriggered) {
    const lastDate = new Date(lastTriggered);
    if (lastDate.toDateString() === now.toDateString()) {
      console.log(`Schedule already triggered today (last: ${lastTriggered})`);
      return false;
    }
  }
  
  // Check if time has passed (if time is configured)
  const timeCheck = config.time ? currentTime >= config.time : true;
  if (!timeCheck) {
    console.log(`Schedule time not reached yet (current: ${currentTime}, target: ${config.time})`);
    return false;
  }
  
  switch (config.type) {
    case 'daily':
      // For "daily" type, IGNORE the days array - it should run every day
      console.log(`Daily schedule: triggering at ${currentTime}`);
      return true;
      
    case 'weekly':
      // For weekly, check if today is one of the selected days
      if (!config.days?.includes(today)) {
        console.log(`Weekly schedule: today (${today}) not in selected days (${config.days?.join(', ')})`);
        return false;
      }
      console.log(`Weekly schedule: today (${today}) is a selected day, triggering`);
      return true;
      
    case 'monthly':
      // For monthly, check if today is one of the selected days of month
      if (!config.days?.includes(dayOfMonth)) {
        console.log(`Monthly schedule: today (${dayOfMonth}) not in selected days (${config.days?.join(', ')})`);
        return false;
      }
      console.log(`Monthly schedule: today (${dayOfMonth}) is a selected day, triggering`);
      return true;
      
    default:
      console.log(`Unknown schedule type: ${config.type}`);
      return false;
  }
}

// Check RSS trigger
async function checkRSSTrigger(
  config: RSSConfig
): Promise<{ shouldTrigger: boolean; data?: RSSItem; newGuid?: string }> {
  if (!config.url) return { shouldTrigger: false };
  
  const items = await parseRSSFeed(config.url);
  if (items.length === 0) return { shouldTrigger: false };
  
  // Sort by pubDate descending to ensure we get the most recent item
  // (RSS feeds may not always be in chronological order)
  items.sort((a, b) => {
    if (!a.pubDate || !b.pubDate) return 0;
    return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime();
  });
  
  const latestItem = items[0];
  
  if (config.last_guid && latestItem.guid === config.last_guid) {
    return { shouldTrigger: false };
  }
  
  return { 
    shouldTrigger: true, 
    data: latestItem,
    newGuid: latestItem.guid 
  };
}

// Fetch Bitcoin price from CoinGecko (free, no API key needed)
async function fetchBTCPrice(): Promise<string> {
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd,brl&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true',
      { headers: { 'Accept': 'application/json' } }
    );
    if (!response.ok) {
      console.warn(`[BTC] CoinGecko API error: ${response.status}`);
      return 'Dados do Bitcoin indisponíveis no momento.';
    }
    const data = await response.json();
    const btc = data.bitcoin;
    const priceUSD = btc.usd?.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    const priceBRL = btc.brl?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const change24h = btc.usd_24h_change?.toFixed(2);
    const direction = parseFloat(change24h) >= 0 ? '📈' : '📉';
    const marketCap = btc.usd_market_cap ? `$${(btc.usd_market_cap / 1e9).toFixed(1)}B` : 'N/A';
    
    return `${direction} Bitcoin (BTC)
- Preço: ${priceUSD} / ${priceBRL}
- Variação 24h: ${change24h}%
- Market Cap: ${marketCap}`;
  } catch (error) {
    console.error('[BTC] Error fetching price:', error);
    return 'Dados do Bitcoin indisponíveis no momento.';
  }
}

// Replace template variables in prompt
async function replaceTemplateVariables(template: string, data: RSSItem | null, automationName: string): Promise<string> {
  if (!template) return '';
  
  let prompt = template;
  
  // Get time of day based on current hour
  const hour = new Date().getHours();
  let timeOfDay = 'noite';
  if (hour >= 5 && hour < 12) timeOfDay = 'manhã';
  else if (hour >= 12 && hour < 18) timeOfDay = 'tarde';
  
  // Fetch BTC price if template uses it
  let btcPrice = '';
  if (template.includes('{{btc_price}}')) {
    btcPrice = await fetchBTCPrice();
    console.log('[BTC] Price data fetched for template injection');
  }
  
  const variables: Record<string, string> = {
    '{{title}}': data?.title || automationName,
    '{{description}}': data?.description?.replace(/<[^>]*>/g, '').substring(0, 500) || '',
    '{{link}}': data?.link || '',
    '{{content}}': data?.content?.replace(/<[^>]*>/g, '').substring(0, 3000) || data?.description?.replace(/<[^>]*>/g, '').substring(0, 3000) || '',
    '{{images}}': (data?.allImages?.length || 0) > 0 
      ? `${data!.allImages!.length} imagens disponíveis do conteúdo original`
      : 'Sem imagens disponíveis',
    '{{time_of_day}}': timeOfDay,
    '{{btc_price}}': btcPrice,
  };
  
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(key.replace(/[{}]/g, '\\$&'), 'g');
    prompt = prompt.replace(regex, value);
  }
  
  return prompt;
}

// Get image style modifier for prompt
function getImageStyleModifier(style: string | null): string {
  switch (style) {
    case 'photographic':
      return 'Professional photography style, ultra realistic, natural lighting, high resolution';
    case 'illustration':
      return 'Digital illustration, artistic style, clean vector-like aesthetic, modern design';
    case 'minimalist':
      return 'Minimalist design, clean composition, lots of white space, simple elements, elegant';
    case 'vibrant':
      return 'Vibrant colors, high contrast, bold and energetic visual style, eye-catching';
    default:
      return 'Professional photography style, natural lighting';
  }
}

// GM Tweet variation categories for anti-repetition — with CONCRETE structural examples
const GM_VARIATION_CATEGORIES = [
  { name: 'Provocação', instruction: `Escreva como se estivesse respondendo um tweet que te irritou. Formato: frase curta + ponto final + uma segunda frase que explica por quê.
Exemplo de ESTRUTURA (NÃO copie o conteúdo): "Todo mundo quer escalar. Ninguém quer simplificar primeiro."
NÃO use listas, bullets, formato "X vs Y" ou perguntas retóricas.` },
  { name: 'Confissão', instruction: `Comece com uma frase vulnerável. Revele algo que você fez errado ou que mudou de opinião. Tom pessoal e honesto.
Exemplo de ESTRUTURA: "Passei 2 anos fazendo X achando que era o caminho. Estava errado. O que mudou tudo foi [insight específico]."
NÃO use bullets nem listas numeradas.` },
  { name: 'Observação afiada', instruction: `Faça uma observação curta e perspicaz sobre algo que está acontecendo no mercado AGORA. Máximo 2 frases. Sem explicação, sem contexto excessivo.
Exemplo de ESTRUTURA: "O mercado está premiando quem executa rápido e punindo quem planeja demais."
NÃO faça perguntas retóricas no final.` },
  { name: 'Micro-storytelling', instruction: `Conte uma história em 3 frases: situação → virada → lição. Use detalhes concretos (nomes de ferramentas, valores, datas).
Exemplo de ESTRUTURA: "Semana passada perdi um cliente de R$8k/mês. Motivo: demorei 3 dias pra responder. Velocidade > perfeição."
NÃO generalize. Use SUA experiência específica.` },
  { name: 'Dado concreto', instruction: `Abra com um número REAL e específico da sua experiência. Não invente estatísticas. Use dados do seu negócio, dos seus clientes, do seu dia.
Exemplo de ESTRUTURA: "Testei 4 CTAs diferentes na última semana. O que converteu 3x mais? O mais curto — 3 palavras."
NÃO use "X% dos founders" ou números inventados.` },
  { name: 'Metáfora', instruction: `Use uma analogia inesperada para explicar um conceito do seu nicho. Conecte algo do cotidiano com business/tech.
Exemplo de ESTRUTURA: "Criar conteúdo sem estratégia é como dirigir de noite sem farol: você avança, mas não sabe pra onde."
NÃO use clichês (maratona não sprint, construir avião voando, etc).` },
  { name: 'Contrarian rápido', instruction: `Discorde de algo popular em 1-2 frases sem justificar muito. Tom ousado. Deixe as pessoas discordarem nos comentários.
Exemplo de ESTRUTURA: "Newsletter não é canal de aquisição. É canal de retenção. A maioria usa errado."
NÃO abra com "Hot take:" nem "Unpopular opinion:"` },
  { name: 'Pergunta poderosa', instruction: `Faça UMA única pergunta que force reflexão genuína. Sem respondê-la. Sem contextualizar demais. A pergunta É o tweet.
Exemplo de ESTRUTURA: "Se você não pudesse postar nas redes por 30 dias, seu negócio sobreviveria?"
NÃO faça múltiplas perguntas nem perguntas retóricas óbvias.` },
];

// Threads editorial variation categories for anti-repetition
const THREADS_VARIATION_CATEGORIES = [
  { name: 'Reflexão Curta', instruction: `Escreva um pensamento contemplativo em 2-3 frases. Não resolva, não conclua. Deixe em aberto para o leitor refletir.
Exemplo de ESTRUTURA: "A maioria dos conselhos de negócio que recebi foram úteis... 3 anos depois do momento certo. Timing é tudo — mas ninguém ensina a ter timing."
NÃO use listas nem bullets.` },
  { name: 'Insight Rápido', instruction: `Compartilhe algo que aprendeu recentemente em 1-2 frases CURTAS. Direto ao ponto. Sem floreios.
Exemplo de ESTRUTURA: "Reduzi meu tempo de criação de conteúdo pela metade. O segredo não foi uma ferramenta — foi cortar 80% das etapas."
NÃO explique o processo inteiro.` },
  { name: 'Bastidores', instruction: `Revele algo real dos seus bastidores: uma ferramenta, um processo, um erro. Tom cru e autêntico.
Exemplo de ESTRUTURA: "Hoje de manhã apaguei 3 posts prontos porque percebi que estavam todos iguais. Voltei pro zero. Às vezes o melhor conteúdo é o que você joga fora."
NÃO faça parecer polido demais.` },
  { name: 'Provocação Leve', instruction: `Questione algo aceito como verdade no seu nicho. Tom amigável mas firme. Sem ser agressivo.
Exemplo de ESTRUTURA: "Engajamento alto nem sempre significa conteúdo bom. Às vezes significa que você acertou o ego da audiência."
NÃO comece com "Hot take:" nem use formato de lista.` },
  { name: 'Opinião Direta', instruction: `Dê sua opinião sobre algo em 1-2 frases SEM justificar. A brevidade é o poder.
Exemplo de ESTRUTURA: "Marca pessoal não é postar todo dia. É ter algo que valha a pena dizer."
NÃO use bullets, listas ou explicações longas.` },
  { name: 'Aprendizado do Dia', instruction: `Compartilhe algo que aprendeu HOJE ou esta semana. Use detalhes temporais para dar autenticidade.
Exemplo de ESTRUTURA: "Ontem um prospect me disse que já acompanha meu conteúdo há 6 meses. Nem sabia que ele existia. Consistência funciona mesmo quando você não vê."
NÃO generalize. Conte o caso específico.` },
  { name: 'Analogia', instruction: `Use uma comparação inesperada para iluminar um conceito. Conecte mundos diferentes.
Exemplo de ESTRUTURA: "Algoritmo é como um barman: ele serve mais do que o público pede. Se pedem polêmica, ele entrega polêmica."
NÃO use analogias batidas (maratona, avião, etc).` },
  { name: 'Confissão', instruction: `Admita algo com vulnerabilidade. Pode ser um erro, uma mudança de opinião, uma insegurança.
Exemplo de ESTRUTURA: "Passei meses evitando vídeos porque tinha vergonha da minha voz. Quando finalmente gravei, percebi que ninguém se importa com sua voz — se importam com o que você diz."
NÃO force uma moral. Deixe a história falar.` },
];

// Blog editorial variation categories for anti-repetition
const BLOG_VARIATION_CATEGORIES = [
  { name: 'Framework Prático', instruction: `Crie um guia com etapas claras e numeradas. Cada etapa deve ter uma ação concreta que o leitor pode fazer HOJE.
NÃO use introduções longas. Vá direto para o framework.` },
  { name: 'Análise de Tendência', instruction: `Analise algo que está mudando no mercado AGORA. Conecte dados reais (não inventados) com sua visão do futuro.
NÃO invente estatísticas. Use observações qualitativas se não tiver dados.` },
  { name: 'Opinião Contrarian', instruction: `Escolha uma crença popular e argumente contra ela com experiência REAL. Use casos do seu dia a dia.
NÃO use dados inventados. Baseie-se na sua prática.` },
  { name: 'Deep Dive', instruction: `Mergulhe profundamente em UM conceito específico. Use analogias para tornar o complexo acessível.
NÃO tente cobrir tudo. Prefira profundidade a amplitude.` },
  { name: 'Guia Definitivo', instruction: `Crie um recurso completo e prático. Inclua exemplos reais, templates ou checklists.
O leitor deve sair com algo CONCRETO para aplicar imediatamente.` },
];


// LinkedIn editorial variation categories for anti-repetition
const LINKEDIN_VARIATION_CATEGORIES: Record<string, Array<{ name: string; instruction: string }>> = {
  'opinion': [
    { name: 'Contrarian com Dados', instruction: `Discorde de algo popular usando experiência REAL (não dados inventados). Comece com a crença popular e depois desmonte com sua vivência.
Exemplo de ESTRUTURA: Frase que todo mundo concorda → "Mas na prática..." → Sua experiência específica → O que realmente funciona.
NÃO invente números. NÃO use "300+ empresas" ou "92% dos founders". Use SUA experiência.
NÃO use formato de lista com bullets.` },
    { name: 'Análise em Primeira Pessoa', instruction: `Analise algo que você VIVEU esta semana/mês. Use detalhes temporais e específicos.
Exemplo de ESTRUTURA: "Na última terça..." ou "Essa semana percebi que..." → O que aconteceu → O que isso significa para o mercado.
NÃO generalize. NÃO faça parecer que é sobre "o mercado" — é sobre SUA experiência.` },
    { name: 'Framework Original', instruction: `Apresente um modelo mental SEU para resolver um problema. Dê um nome para o framework. Explique em 3-4 frases como funciona.
NÃO copie frameworks conhecidos. Crie algo da sua prática.
NÃO use mais de 5 bullets no total.` },
    { name: 'Previsão Ousada', instruction: `Faça uma previsão sobre o futuro do seu nicho. Seja específico sobre QUANDO e O QUE vai acontecer. Aceite que pode estar errado.
Exemplo de ESTRUTURA: "Em 12 meses, X vai acontecer. Por quê? [3 sinais que já estou vendo]. Posso estar errado — mas aposto nisso."
NÃO use "tendência" como palavra. Fale do futuro com convicção.` },
    { name: 'Lição do Erro', instruction: `Comece com um erro real que você cometeu. Dê detalhes: quando, quanto custou, o que fez de errado. Depois extraia a lição.
Exemplo de ESTRUTURA: "Em [data], fiz [erro específico]. Custou [consequência real]. O que aprendi: [lição em 1-2 frases]."
NÃO minimize o erro. Seja honesto sobre o impacto.` },
  ],
  'building_in_public': [
    { name: 'Bastidores Crus', instruction: `Mostre algo REAL do seu dia: uma decisão, uma reunião, um processo. Tom não-polido, como se estivesse contando para um amigo.
NÃO tente parecer inspirador. Seja real e específico.
NÃO use bullets. Escreva em parágrafos curtos narrativos.` },
    { name: 'Número Aberto', instruction: `Compartilhe UMA métrica real do seu negócio. Não precisa ser impressionante. Contextualize: por que esse número importa?
Exemplo de ESTRUTURA: "Faturamento de [mês]: R$[valor]. [Comparação com mês anterior]. [O que fiz diferente ou O que deu errado]."
NÃO invente números. Se não quer revelar o real, não poste sobre isso.` },
    { name: 'Ferramenta/Stack', instruction: `Revele UMA ferramenta, automação ou processo que usa. Explique: por que essa e não outra? Quanto tempo/dinheiro economiza?
NÃO faça lista de ferramentas. Foque em UMA e vá fundo.
Inclua um detalhe prático de implementação.` },
    { name: 'Decisão Difícil', instruction: `Conte sobre uma decisão recente que te tirou o sono. Qual era o dilema? O que pesou? O que decidiu?
NÃO resolva com "e no final deu tudo certo". Aceite a ambiguidade.
Tom: confessional, não triunfante.` },
    { name: 'Aprendizado Contra-Intuitivo', instruction: `Revele algo que aprendeu na prática que contradiz a teoria ou o conselho comum.
Exemplo de ESTRUTURA: "Na teoria: [conselho popular]. Na prática: [o que realmente funciona]. O que mudou minha visão: [experiência específica]."
NÃO generalize. Fale do SEU caso.` },
  ],
  'case_study': [
    { name: 'Antes e Depois', instruction: `Apresente um resultado REAL de cliente: onde estava antes, o que fizeram, onde está agora. Use números reais.
Exemplo de ESTRUTURA: "Cliente chegou com [problema]. Em [tempo], [ação que tomamos]. Resultado: [métrica antes] → [métrica depois]."
NÃO invente números. Se o cliente não autorizou, generalize sem inventar.` },
    { name: 'Processo Revelado', instruction: `Mostre o passo-a-passo de como resolveu UM problema específico de um cliente. Foco no COMO, não no resultado.
NÃO faça parecer fácil. Mostre as dificuldades do processo.
Máximo 4 etapas — profundidade > quantidade.` },
    { name: 'Erro que Virou Acerto', instruction: `Comece com algo que deu errado num projeto real. Mostre o pivô e como corrigiu. O resultado final pode ou não ser melhor que o esperado.
NÃO force um final feliz se não houve.
Tom: narrativo e honesto.` },
    { name: 'Transformação', instruction: `Conte a jornada de transformação de um cliente como uma história. Início → desafio → virada → estado atual.
NÃO use formato de lista. Escreva como narrativa.
Inclua uma fala ou reação real do cliente se possível.` },
  ],
};

// Get LinkedIn variation for a specific automation type
function getLinkedInVariation(automationName: string, variationIndex: number): { category: string; instruction: string; editorialType: string } {
  let editorialType = 'opinion';
  if (automationName.toLowerCase().includes('building')) editorialType = 'building_in_public';
  else if (automationName.toLowerCase().includes('case') || automationName.toLowerCase().includes('prova')) editorialType = 'case_study';
  
  const categories = LINKEDIN_VARIATION_CATEGORIES[editorialType] || LINKEDIN_VARIATION_CATEGORIES['opinion'];
  const variation = categories[variationIndex % categories.length];
  
  return {
    category: variation.name,
    instruction: variation.instruction,
    editorialType,
  };
}

// Build enriched prompt with context when template is empty or simple
async function buildEnrichedPrompt(
  template: string | null,
  data: RSSItem | null,
  automation: PlanningAutomation,
  contentType: string,
  mediaUrls: string[],
  variationContext?: { category: string; instruction: string; recentTweets: string[] }
): Promise<string> {
  // First, replace template variables if we have a template
  let prompt = await replaceTemplateVariables(template || '', data, automation.name);
  
  const formatLabel = CONTENT_TYPE_LABELS[contentType] || contentType;
  
  // If template is empty or too simple, create a robust default prompt
  if (!template || template.trim().length < 20) {
    const cleanDescription = data?.description?.replace(/<[^>]*>/g, '').substring(0, 500) || '';
    const cleanContent = data?.content?.replace(/<[^>]*>/g, '').substring(0, 2500) || '';
    
    prompt = `TAREFA: Criar ${formatLabel} profissional e pronto para publicar.

📌 CONTEÚDO BASE:
Título: ${data?.title || automation.name}
${cleanDescription ? `Resumo: ${cleanDescription}` : ''}
${data?.link ? `Link original: ${data.link}` : ''}

${cleanContent ? `📄 CONTEÚDO COMPLETO:\n${cleanContent}` : ''}

📋 INSTRUÇÕES:
1. Siga RIGOROSAMENTE as regras do formato "${formatLabel}"
2. Siga RIGOROSAMENTE o tom de voz e as expressões do Voice Profile do cliente. Use as expressões da lista "USE" e evite absolutamente as da lista "EVITE".
3. Mantenha o tom de voz e estilo do cliente conforme o identity_guide
4. Crie conteúdo PRONTO PARA PUBLICAR - sem placeholders ou instruções
5. Use linguagem natural e envolvente
6. ${mediaUrls.length > 0 ? `Há ${mediaUrls.length} imagens disponíveis - faça referência a elas onde apropriado` : 'Não há imagens disponíveis'}

🎯 RESULTADO ESPERADO:
Conteúdo final completo, formatado e pronto para publicar como ${formatLabel}.`;
  }
  
  // Add variation context for anti-repetition (tweets)
  if (variationContext) {
    prompt += `\n\n🎲 ESTILO OBRIGATÓRIO PARA HOJE: ${variationContext.category}
${variationContext.instruction}`;
    
    if (variationContext.recentTweets.length > 0) {
      prompt += `\n\n🚫 ANTI-EXEMPLOS (NÃO repita estes padrões, estruturas ou frases similares):`;
      variationContext.recentTweets.forEach((tweet, i) => {
        prompt += `\n${i + 1}. "${tweet.substring(0, 300)}"`;
      });
      
      // Detect structural patterns from recent posts
      const allStructures: Record<string, number> = {};
      for (const tweet of variationContext.recentTweets) {
        const patterns = detectContentStructure(tweet);
        for (const p of patterns) {
          allStructures[p] = (allStructures[p] || 0) + 1;
        }
      }
      
      const frequentPatterns = Object.entries(allStructures)
        .filter(([_, count]) => count >= 2)
        .sort((a, b) => b[1] - a[1]);
      
      if (frequentPatterns.length > 0) {
        prompt += `\n\n📊 PADRÕES ESTRUTURAIS JÁ USADOS RECENTEMENTE (NÃO repita):`;
        for (const [pattern, count] of frequentPatterns) {
          prompt += `\n- ${pattern} (${count}x)`;
        }
        prompt += `\n\n⚠️ USE UM PADRÃO ESTRUTURAL COMPLETAMENTE DIFERENTE dos listados acima.`;
      }
      
      // Detect opening hook patterns
      const openingPatterns = detectOpeningPatterns(variationContext.recentTweets);
      if (openingPatterns.length > 0) {
        prompt += `\n\n🎣 GANCHOS DE ABERTURA JÁ USADOS (NÃO repita o mesmo tipo):`;
        for (const { pattern, count, examples } of openingPatterns) {
          prompt += `\n- ${pattern} (${count}x): "${examples[0]}"`;
        }
        prompt += `\n\n⚠️ COMECE com um tipo de abertura DIFERENTE dos listados acima.`;
      }
      
      prompt += `\n\n⚠️ Seu conteúdo DEVE ser fundamentalmente DIFERENTE dos exemplos acima em estrutura, tema e abordagem.`;
    }
  }
  
  // Add image context for visual formats
  if (mediaUrls.length > 0 && ['thread', 'carousel', 'instagram_post', 'stories'].includes(contentType)) {
    prompt += `\n\n📸 IMAGENS DISPONÍVEIS (${mediaUrls.length}): As imagens do conteúdo original serão anexadas automaticamente. Faça referência a elas nos pontos relevantes do conteúdo.`;
  }
  
  // NOTE: Format-specific tips removed here to avoid duplication.
  // Format rules are already loaded via getFullContentContext() in the enriched context.
  // Only add DELIVERY instructions that aren't covered by format schemas.
  switch (contentType) {
    case 'tweet':
      prompt += `\n\n⚠️ ENTREGA: Responda APENAS com o texto puro do tweet. Sem rótulos, sem markdown, sem metadata.`;
      break;
    case 'thread':
      prompt += `\n\n⚠️ ENTREGA: Numere cada tweet (1/, 2/, etc). Máximo 280 chars por tweet.`;
      break;
    case 'carousel':
      prompt += `\n\n⚠️ ENTREGA: Use "Página 1:", "Página 2:", etc. + LEGENDA no final.`;
      break;
  }
  
  return prompt;
}

// Parse thread from generated content
function parseThreadFromContent(content: string): Array<{ id: string; text: string; media_urls: string[] }> | null {
  const tweets: Array<{ id: string; text: string; media_urls: string[] }> = [];
  
  // Try to detect thread structure
  // Pattern 1: "1/", "2/", etc.
  const numberedPattern = /(?:^|\n)(\d+)\/[\s\n]*([\s\S]*?)(?=(?:\n\d+\/)|$)/g;
  let match;
  let foundNumbered = false;
  
  while ((match = numberedPattern.exec(content)) !== null) {
    foundNumbered = true;
    tweets.push({
      id: `tweet-${match[1]}`,
      text: match[2].trim(),
      media_urls: [],
    });
  }
  
  if (foundNumbered && tweets.length > 0) return tweets;
  
  // Pattern 2: "Tweet 1:", "Tweet 2:", etc.
  const tweetPattern = /(?:^|\n)Tweet\s*(\d+)[:.]?\s*([\s\S]*?)(?=(?:\nTweet\s*\d)|$)/gi;
  
  while ((match = tweetPattern.exec(content)) !== null) {
    tweets.push({
      id: `tweet-${match[1]}`,
      text: match[2].trim(),
      media_urls: [],
    });
  }
  
  if (tweets.length > 0) return tweets;
  
  // Pattern 3: Split by "---" separator
  const parts = content.split(/\n---\n/);
  if (parts.length > 1) {
    parts.forEach((part, idx) => {
      const text = part.trim();
      if (text && text.length <= 280) {
        tweets.push({
          id: `tweet-${idx + 1}`,
          text,
          media_urls: [],
        });
      }
    });
    if (tweets.length > 0) return tweets;
  }
  
  return null;
}

// Parse carousel from generated content
function parseCarouselFromContent(content: string): Array<{ id: string; text: string; media_urls: string[] }> | null {
  const slides: Array<{ id: string; text: string; media_urls: string[] }> = [];
  
  // Pattern 1: "Página 1:", "Slide 1:", etc.
  const pagePattern = /(?:^|\n)(?:Página|Slide|Capa)\s*(\d+)?[:.]?\s*([\s\S]*?)(?=(?:\n(?:Página|Slide|Capa)\s*\d?[:.])|\n---|\n\nLEGENDA:|$)/gi;
  let match;
  let slideIndex = 0;
  
  while ((match = pagePattern.exec(content)) !== null) {
    slideIndex++;
    const text = match[2].trim();
    if (text && !text.toLowerCase().startsWith('legenda')) {
      slides.push({
        id: `slide-${match[1] || slideIndex}`,
        text,
        media_urls: [],
      });
    }
  }
  
  if (slides.length > 0) return slides;
  
  // Pattern 2: "---" separator
  const parts = content.split(/\n---\n/);
  if (parts.length > 1) {
    parts.forEach((part, idx) => {
      const text = part.trim();
      // Skip if it looks like a caption/legenda section
      if (text && !text.toLowerCase().startsWith('legenda') && !text.toLowerCase().includes('legenda para')) {
        slides.push({
          id: `slide-${idx + 1}`,
          text,
          media_urls: [],
        });
      }
    });
    if (slides.length > 0) return slides;
  }
  
  // Pattern 3: Numbered lines (1. , 2. , etc)
  const numberedPattern = /(?:^|\n)(\d+)\.\s+([\s\S]*?)(?=(?:\n\d+\.)|$)/g;
  
  while ((match = numberedPattern.exec(content)) !== null) {
    const text = match[2].trim();
    if (text) {
      slides.push({
        id: `slide-${match[1]}`,
        text,
        media_urls: [],
      });
    }
  }
  
  if (slides.length >= 3) return slides; // Only return if we have at least 3 slides
  
  return null;
}

// Scrape content from URL using Firecrawl (for non-RSS links)
async function scrapeContentFromUrl(
  url: string, 
  supabaseUrl: string, 
  supabaseKey: string
): Promise<{ title: string; content: string; images: string[] } | null> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/firecrawl-scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ 
        url,
        options: { 
          formats: ['markdown', 'links'],
          onlyMainContent: true 
        }
      }),
    });
    
    if (!response.ok) {
      console.log(`Firecrawl returned ${response.status} for ${url}`);
      return null;
    }
    
    const result = await response.json();
    if (!result.success) {
      console.log(`Firecrawl failed for ${url}:`, result.error);
      return null;
    }
    
    const data = result.data || result;
    
    return {
      title: data.metadata?.title || '',
      content: data.markdown || '',
      images: data.images || [],
    };
  } catch (error) {
    console.error('Firecrawl error:', error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // ========================================
  // SECURITY: Validate cron/service caller
  // ========================================
  const authHeader = req.headers.get("Authorization");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  
  // Accept requests from:
  // 1. Supabase internal cron scheduler headers
  // 2. Service role key authentication
  // 3. pg_cron via net.http_post (sends anon key)
  // 4. Authenticated user JWT (for manual triggers from frontend)
  const isCronJob = req.headers.get("x-supabase-eed-request") === "true" || 
                    req.headers.get("user-agent")?.includes("Supabase") ||
                    req.headers.get("x-supabase-cron") === "true";
  const isServiceRole = authHeader === `Bearer ${serviceRoleKey}`;
  const isPgCron = !!anonKey && authHeader === `Bearer ${anonKey}`;
  
  // Check if it's an authenticated user (for manual trigger via frontend)
  let isAuthenticatedUser = false;
  if (!isCronJob && !isServiceRole && !isPgCron && authHeader?.startsWith('Bearer ')) {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const tempClient = createClient(supabaseUrl, anonKey ?? '', {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: claimsData, error: claimsError } = await tempClient.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (!claimsError && claimsData?.claims?.sub) {
      isAuthenticatedUser = true;
    }
  }

  if (!isCronJob && !isServiceRole && !isPgCron && !isAuthenticatedUser) {
    console.error("[process-automations] Unauthorized access attempt");
    return new Response(
      JSON.stringify({ error: "Unauthorized - Service role required" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  
  console.log(`[process-automations] Auth check passed: isCronJob=${isCronJob}, isServiceRole=${isServiceRole}, isUser=${isAuthenticatedUser}`);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let automationId: string | null = null;
    let isManualTest = false;
    try {
      const body = await req.json();
      automationId = body.automationId || null;
      isManualTest = !!automationId;
    } catch {
      // No body or invalid JSON
    }

    console.log(`Starting automation processing... ${isManualTest ? `(Manual test: ${automationId})` : '(Scheduled)'}`);

    let query = supabase
      .from('planning_automations')
      .select('*');
    
    if (automationId) {
      query = query.eq('id', automationId);
    } else {
      query = query.eq('is_active', true);
    }

    const { data: automations, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching automations:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${automations?.length || 0} automation(s) to process`);

    // ========================================================
    // MANUAL TEST (frontend trigger): roda em background pra
    // não estourar o timeout do client/gateway. A automação
    // pode levar 30s-3min se gerar texto + imagens.
    // Usa EdgeRuntime.waitUntil pra manter o runtime vivo
    // até terminar, retornando 202 imediatamente.
    // ========================================================
    const automationsList = (automations as PlanningAutomation[]) || [];
    const results: { id: string; name: string; triggered: boolean; error?: string; runId?: string; itemId?: string }[] = [];

    const runLoop = async () => {
      for (const automation of automationsList) {

      const startTime = Date.now();
      let runId: string | null = null;
      
      try {
        // Create run record
        const { data: run, error: runError } = await supabase
          .from('planning_automation_runs')
          .insert({
            automation_id: automation.id,
            workspace_id: automation.workspace_id,
            status: 'running',
            started_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (runError) {
          console.error(`Error creating run record for ${automation.name}:`, runError);
        } else {
          runId = run?.id;
        }

        let shouldTrigger = false;
        let triggerData: RSSItem | null = null;
        let newGuid: string | undefined;

        if (isManualTest) {
          console.log(`Manual test for ${automation.name} - forcing trigger`);
          shouldTrigger = true;
          
          if (automation.trigger_type === 'rss' && automation.trigger_config.url) {
            const items = await parseRSSFeed(automation.trigger_config.url);
            if (items.length > 0) {
              triggerData = items[0];
              newGuid = items[0].guid;
              console.log(`RSS data loaded: "${triggerData.title}" with ${triggerData.allImages?.length || 0} images`);
            }
          }
        } else {
          switch (automation.trigger_type) {
            case 'schedule':
              shouldTrigger = shouldTriggerSchedule(automation.trigger_config, automation.last_triggered_at);
              break;
              
            case 'rss': {
              const rssResult = await checkRSSTrigger(automation.trigger_config);
              shouldTrigger = rssResult.shouldTrigger;
              triggerData = rssResult.data || null;
              newGuid = rssResult.newGuid;
              break;
            }
              
            case 'webhook':
              shouldTrigger = false;
              break;
          }
        }

        if (!shouldTrigger) {
          if (runId) {
            await supabase
              .from('planning_automation_runs')
              .update({
                status: 'skipped',
                result: 'Trigger conditions not met',
                completed_at: new Date().toISOString(),
                duration_ms: Date.now() - startTime,
              })
              .eq('id', runId);
          }
          
          results.push({ id: automation.id, name: automation.name, triggered: false, runId: runId || undefined });
          continue;
        }

        console.log(`Triggering automation: ${automation.name}`);

        // ============================================================
        // BRANCH: viral_carousel — delega pra generate-viral-carousel
        // ============================================================
        if (automation.content_type === 'viral_carousel' && automation.client_id) {
          try {
            // Substitui variáveis ({{title}}, {{description}}, {{link}}, {{content}}, etc.)
            // do prompt_template usando dados do trigger (RSS, etc.) — assim o briefing
            // do carrossel já vem rico em contexto da notícia/evento.
            const rawTemplate = automation.prompt_template ?? triggerData?.title ?? automation.name;
            const briefing = (await replaceTemplateVariables(rawTemplate, triggerData ?? null, automation.name)).slice(0, 4000);
            const carouselTitle = triggerData?.title || automation.name;
            // Pega 1ª imagem do RSS pra usar como capa do slide 1 (estilo jornal).
            const coverImageUrl = triggerData?.allImages?.[0] ?? null;

            const vcRes = await fetch(`${supabaseUrl}/functions/v1/generate-viral-carousel`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''}`,
                apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
                'x-internal-call': 'true',
              },
              body: JSON.stringify({
                clientId: automation.client_id,
                briefing,
                title: carouselTitle,
                persistAs: 'both',
                source: 'automation',
                automationId: automation.id,
                coverImageUrl,
                coverImageAttribution: triggerData?.link ?? null,
              }),
            });

            const vcJson = await vcRes.json().catch(() => ({}));
            if (!vcRes.ok || !vcJson?.ok) {
              throw new Error(vcJson?.error || `generate-viral-carousel ${vcRes.status}`);
            }

            console.log(`[viral_carousel] created carousel=${vcJson.carouselId} planningItem=${vcJson.planningItemId}`);

            // Update automation tracking — INCLUI last_guid pra evitar disparos duplicados
            // (esse era o bug: branch viral_carousel não atualizava last_guid e cada hour
            // a automação re-disparava a mesma notícia).
            const vcUpdateData: Record<string, unknown> = {
              last_triggered_at: new Date().toISOString(),
              items_created: (automation.items_created ?? 0) + 1,
            };
            if (automation.trigger_type === 'rss' && newGuid) {
              vcUpdateData.trigger_config = {
                ...automation.trigger_config,
                last_guid: newGuid,
                last_checked: new Date().toISOString(),
              };
            }
            await supabase
              .from('planning_automations')
              .update(vcUpdateData)
              .eq('id', automation.id);

            if (runId) {
              await supabase
                .from('planning_automation_runs')
                .update({
                  status: 'completed',
                  result: `Carrossel viral criado: ${vcJson.carouselId} (planningItem=${vcJson.planningItemId})`,
                  items_created: 1,
                  completed_at: new Date().toISOString(),
                  duration_ms: Date.now() - startTime,
                })
                .eq('id', runId);
            }

            results.push({
              id: automation.id,
              name: automation.name,
              triggered: true,
              itemId: vcJson.planningItemId,
              runId: runId || undefined,
            });
            continue; // pula o fluxo padrão
          } catch (vcErr) {
            const msg = vcErr instanceof Error ? vcErr.message : String(vcErr);
            console.error(`[viral_carousel] failed for automation ${automation.id}:`, msg);

            if (runId) {
              await supabase
                .from('planning_automation_runs')
                .update({
                  status: 'failed',
                  error: msg,
                  completed_at: new Date().toISOString(),
                  duration_ms: Date.now() - startTime,
                })
                .eq('id', runId);
            }
            results.push({
              id: automation.id,
              name: automation.name,
              triggered: false,
              error: msg,
              runId: runId || undefined,
            });
            continue;
          }
        }

        const itemTitle = triggerData?.title || automation.name;
        const itemDescription = triggerData?.description?.replace(/<[^>]*>/g, '').substring(0, 500) || '';
        
        // Get images from RSS
        // For single tweets, limit to 1 image (best quality); threads/carousels can have more
        const maxImages = automation.content_type === 'tweet' ? 1 : 4;
        const mediaUrls = triggerData?.allImages?.slice(0, maxImages) || [];
        console.log(`Extracted ${mediaUrls.length} images from RSS (max: ${maxImages})`);

        // Derive platform from content_type if not set
        const derivedPlatform = automation.platform || PLATFORM_MAP[automation.content_type] || null;
        // Override format for text-only platforms using social_post type
        // social_post → 'post' format generates TEXTO DO VISUAL labels (designed for Instagram)
        // For twitter/threads/linkedin, use 'tweet' or 'linkedin' format instead
        let format = FORMAT_MAP[automation.content_type] || 'post';
        if (automation.content_type === 'social_post') {
          if (derivedPlatform === 'threads' || derivedPlatform === 'twitter') {
            format = 'tweet';
          } else if (derivedPlatform === 'linkedin') {
            format = 'linkedin';
          }
        }
        
        // Get default column
        let columnId = automation.target_column_id;
        if (!columnId) {
          const { data: defaultColumn } = await supabase
            .from('kanban_columns')
            .select('id')
            .eq('workspace_id', automation.workspace_id)
            .eq('is_default', true)
            .single();
          columnId = defaultColumn?.id;
        }

        const { count } = await supabase
          .from('planning_items')
          .select('*', { count: 'exact', head: true })
          .eq('column_id', columnId);

        const position = (count || 0) + 1;

        // Prepare metadata with images and target platforms
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

        // Create planning item
        const { data: newItem, error: createError } = await supabase
          .from('planning_items')
          .insert({
            workspace_id: automation.workspace_id,
            client_id: automation.client_id,
            column_id: columnId,
            title: itemTitle,
            description: itemDescription,
            platform: derivedPlatform,
            content_type: automation.content_type,
            position,
            status: 'idea',
            media_urls: mediaUrls,
            created_by: automation.created_by || '00000000-0000-0000-0000-000000000000',
            metadata,
          })
          .select()
          .single();

        if (createError) {
          console.error(`Error creating item for ${automation.name}:`, createError);
          
          if (runId) {
            await supabase
              .from('planning_automation_runs')
              .update({
                status: 'failed',
                error: createError.message,
                completed_at: new Date().toISOString(),
                duration_ms: Date.now() - startTime,
              })
              .eq('id', runId);
          }
          
          results.push({ id: automation.id, name: automation.name, triggered: false, error: createError.message, runId: runId || undefined });
          continue;
        }

        console.log(`Created planning item: ${newItem.id}`);

        let generatedContent: string | null = null;

        // Generate content if enabled
        if (automation.auto_generate_content && automation.client_id) {
          try {
            console.log(`Generating content for item ${newItem.id} with format: ${format}...`);
            
            // ===================================================
            // ENRICHED CONTEXT: Usar mesma qualidade dos outros ambientes
            // ===================================================
            let enrichedContext = "";
            
            // Buscar contexto completo (identity_guide, favorites, top performers, etc)
            try {
              enrichedContext = await getFullContentContext({
                clientId: automation.client_id,
                format: format,
                workspaceId: automation.workspace_id,
                includeLibrary: true,
                includeTopPerformers: true,
                includeGlobalKnowledge: true,
                includeSuccessPatterns: true,
                includeChecklist: true,
                maxLibraryExamples: 3,
                maxTopPerformers: 3,
              });
              console.log(`Enriched context loaded: ${enrichedContext.length} chars`);
              
              // Inject Voice Profile directly into enrichedContext for double reinforcement
              try {
                const voiceSection = await getStructuredVoice(automation.client_id!);
                if (voiceSection) {
                  enrichedContext = `${voiceSection}\n\n---\n\n${enrichedContext}`;
                  console.log(`Voice Profile injected: ${voiceSection.length} chars`);
                }
              } catch (vpError) {
                console.warn(`Could not load voice profile:`, vpError);
              }
            } catch (ctxError) {
              console.warn(`Could not load enriched context:`, ctxError);
            }
            
            // ===================================================
            // FEEDBACK LOOP: Load negative feedback as anti-examples
            // ===================================================
            try {
              const { data: negativeFeedback } = await supabase
                .from('automation_content_feedback')
                .select('content_snapshot, feedback_reason, feedback_type')
                .eq('client_id', automation.client_id!)
                .in('feedback_type', ['dislike', 'delete'])
                .order('created_at', { ascending: false })
                .limit(5);
              
              if (negativeFeedback && negativeFeedback.length > 0) {
                let feedbackSection = `\n\n🚫 FEEDBACK NEGATIVO DO USUÁRIO (NÃO repita estes padrões):\n`;
                feedbackSection += `O usuário avaliou negativamente os seguintes conteúdos gerados anteriormente. EVITE replicar o estilo, tom ou abordagem desses exemplos:\n\n`;
                
                for (const fb of negativeFeedback) {
                  const snippet = fb.content_snapshot?.substring(0, 300) || '[conteúdo não disponível]';
                  const reason = fb.feedback_reason ? ` | Motivo: "${fb.feedback_reason}"` : '';
                  const action = fb.feedback_type === 'delete' ? '🗑️ APAGADO' : '👎 NÃO GOSTOU';
                  feedbackSection += `- [${action}${reason}]: "${snippet}"\n`;
                }
                
                feedbackSection += `\n⚠️ Produza conteúdo com abordagem DIFERENTE dos exemplos acima.\n`;
                enrichedContext += feedbackSection;
                console.log(`Feedback loop injected: ${negativeFeedback.length} negative examples`);
              }
              
              // Also load positive feedback as "do more like this"
              const { data: positiveFeedback } = await supabase
                .from('automation_content_feedback')
                .select('content_snapshot')
                .eq('client_id', automation.client_id!)
                .eq('feedback_type', 'like')
                .order('created_at', { ascending: false })
                .limit(3);
              
              if (positiveFeedback && positiveFeedback.length > 0) {
                let positiveSection = `\n\n✅ CONTEÚDOS APROVADOS PELO USUÁRIO (use como referência de qualidade):\n`;
                for (const fb of positiveFeedback) {
                  const snippet = fb.content_snapshot?.substring(0, 300) || '';
                  if (snippet) positiveSection += `- "${snippet}"\n`;
                }
                enrichedContext += positiveSection;
                console.log(`Positive feedback injected: ${positiveFeedback.length} liked examples`);
              }
            } catch (fbError) {
              console.warn('Could not load feedback context:', fbError);
            }
            
            // ===================================================
            // DEEP RESEARCH: Para newsletters, buscar dados em tempo real
            // ===================================================
            let researchBriefing = "";
            
            if (format === 'newsletter') {
              try {
                console.log(`[AUTOMATION] Starting deep research for newsletter...`);
                
                const researchTopic = triggerData?.title || automation.prompt_template?.substring(0, 200) || 'crypto market analysis';
                
                const researchResponse = await fetch(`${supabaseUrl}/functions/v1/research-newsletter-topic`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${supabaseKey}`,
                  },
                  body: JSON.stringify({
                    topic: researchTopic,
                    client_id: automation.client_id,
                    depth: 'standard',
                    include_newsletter_examples: true,
                  }),
                });
                
                if (researchResponse.ok) {
                  const researchResult = await researchResponse.json();
                  if (researchResult.success && researchResult.briefing) {
                    researchBriefing = researchResult.briefing;
                    console.log(`[AUTOMATION] Research complete: ${researchBriefing.length} chars, ${researchResult.sources?.length || 0} sources`);
                  }
                } else {
                  console.warn(`[AUTOMATION] Research failed: ${researchResponse.status}`);
                }
              } catch (researchError) {
                console.warn(`[AUTOMATION] Research error (continuing without):`, researchError);
              }
            }
            
            // Build variation context for tweets (anti-repetition)
            let variationContext: { category: string; instruction: string; recentTweets: string[] } | undefined;
            
            if (automation.content_type === 'tweet') {
              // Random rotation with cooldown instead of sequential
              const triggerConfig = automation.trigger_config;
              const { index: variationIndex, variation, updatedRecentIndices } = selectVariationWithCooldown(GM_VARIATION_CATEGORIES, triggerConfig);
              
              // Fetch recent tweets as anti-examples (increased to 12)
              let recentTweets: string[] = [];
              try {
                const { data: recentPosts } = await supabase
                  .from('twitter_posts')
                  .select('content')
                  .eq('client_id', automation.client_id!)
                  .not('content', 'is', null)
                  .order('posted_at', { ascending: false })
                  .limit(12);
                
                if (recentPosts) {
                  recentTweets = recentPosts.map(p => p.content!).filter(Boolean);
                }
              } catch (e) {
                console.warn('Could not fetch recent tweets for anti-examples:', e);
              }
              
              // Add length modifier
              const lengthMod = getLengthModifier();
              
              variationContext = {
                category: variation.name,
                instruction: variation.instruction + lengthMod,
                recentTweets,
              };
              
              // Update with random cooldown indices
              await supabase
                .from('planning_automations')
                .update({
                  trigger_config: {
                    ...automation.trigger_config,
                    variation_index: variationIndex + 1,
                    recent_variation_indices: updatedRecentIndices,
                  }
                })
                .eq('id', automation.id);
              
              console.log(`Variation: ${variation.name} (random index ${variationIndex}, cooldown: [${updatedRecentIndices}]), ${recentTweets.length} anti-examples`);
            }
            
            // LinkedIn editorial variation system
            if (automation.content_type === 'linkedin_post') {
              const triggerConfig = automation.trigger_config;
              
              // Get editorial type from automation name
              let editorialType = 'opinion';
              if (automation.name.toLowerCase().includes('building')) editorialType = 'building_in_public';
              else if (automation.name.toLowerCase().includes('case') || automation.name.toLowerCase().includes('prova')) editorialType = 'case_study';
              
              const categories = LINKEDIN_VARIATION_CATEGORIES[editorialType] || LINKEDIN_VARIATION_CATEGORIES['opinion'];
              const { index: variationIndex, variation, updatedRecentIndices } = selectVariationWithCooldown(categories, triggerConfig);
              
              // Fetch recent LinkedIn posts as anti-examples (increased to 12)
              let recentPosts: string[] = [];
              try {
                const { data: recent } = await supabase
                  .from('planning_items')
                  .select('content')
                  .eq('client_id', automation.client_id!)
                  .eq('platform', 'linkedin')
                  .not('content', 'is', null)
                  .order('created_at', { ascending: false })
                  .limit(12);
                
                if (recent) {
                  recentPosts = recent.map(p => p.content!).filter(Boolean).map(c => c.substring(0, 300));
                }
              } catch (e) {
                console.warn('Could not fetch recent LinkedIn posts:', e);
              }
              
              const lengthMod = getLengthModifier();
              
              variationContext = {
                category: `LinkedIn ${editorialType}: ${variation.name}`,
                instruction: `${variation.instruction}${lengthMod}

📝 FORMATO LINKEDIN OBRIGATÓRIO:
- Primeiras 2 linhas = GANCHO IRRESISTÍVEL (determinam se clicam em "ver mais")
- Parágrafos de 1-2 linhas máximo (leitura mobile)
- Espaço entre CADA parágrafo
- 1.200-1.500 caracteres ideal (máximo 3.000)
- ZERO hashtags (hashtags são spam)
- ZERO links
- NUNCA use emojis em excesso (máximo 2)
- Use quebras de linha generosas para respiro visual
- NÃO termine SEMPRE com pergunta — varie: CTA, provocação, frase seca, silêncio`,
                recentTweets: recentPosts,
              };
              
              // Update with random cooldown
              await supabase
                .from('planning_automations')
                .update({
                  trigger_config: {
                    ...automation.trigger_config,
                    variation_index: variationIndex + 1,
                    recent_variation_indices: updatedRecentIndices,
                  }
                })
                .eq('id', automation.id);
              
              console.log(`LinkedIn Variation: ${variation.name} (random, cooldown: [${updatedRecentIndices}]), ${recentPosts.length} anti-examples`);
            }
            
            // Threads editorial variation system
            if (automation.content_type === 'social_post' && (derivedPlatform === 'threads')) {
              const triggerConfig = automation.trigger_config;
              const { index: variationIndex, variation, updatedRecentIndices } = selectVariationWithCooldown(THREADS_VARIATION_CATEGORIES, triggerConfig);
              
              // Fetch recent Threads posts as anti-examples (increased to 12)
              let recentPosts: string[] = [];
              try {
                const { data: recent } = await supabase
                  .from('planning_items')
                  .select('content')
                  .eq('client_id', automation.client_id!)
                  .eq('platform', 'threads')
                  .not('content', 'is', null)
                  .order('created_at', { ascending: false })
                  .limit(12);
                
                if (recent) {
                  recentPosts = recent.map(p => p.content!).filter(Boolean).map(c => c.substring(0, 300));
                }
              } catch (e) {
                console.warn('Could not fetch recent Threads posts:', e);
              }
              
              const lengthMod = getLengthModifier();
              
              variationContext = {
                category: `Threads: ${variation.name}`,
                instruction: variation.instruction + lengthMod,
                recentTweets: recentPosts,
              };
              
              // Update with random cooldown
              await supabase
                .from('planning_automations')
                .update({
                  trigger_config: {
                    ...automation.trigger_config,
                    variation_index: variationIndex + 1,
                    recent_variation_indices: updatedRecentIndices,
                  }
                })
                .eq('id', automation.id);
              
              console.log(`Threads Variation: ${variation.name} (random, cooldown: [${updatedRecentIndices}]), ${recentPosts.length} anti-examples`);
            }
            
            // Blog editorial variation system
            if (automation.content_type === 'blog_post' || automation.content_type === 'article') {
              const triggerConfig = automation.trigger_config;
              const { index: variationIndex, variation, updatedRecentIndices } = selectVariationWithCooldown(BLOG_VARIATION_CATEGORIES, triggerConfig);
              
              variationContext = {
                category: `Blog: ${variation.name}`,
                instruction: variation.instruction,
                recentTweets: [], // Blog posts don't need anti-examples as frequently
              };
              
              // Update with random cooldown
              await supabase
                .from('planning_automations')
                .update({
                  trigger_config: {
                    ...automation.trigger_config,
                    variation_index: variationIndex + 1,
                    recent_variation_indices: updatedRecentIndices,
                  }
                })
                .eq('id', automation.id);
              
              console.log(`Blog Variation: ${variation.name} (random, cooldown: [${updatedRecentIndices}])`);
            }
            let youtubeTranscript = "";
            
            if (triggerData?.link && (
              triggerData.link.includes('youtube.com') || 
              triggerData.link.includes('youtu.be')
            )) {
              try {
                const transcript = await transcribeYouTubeVideo(triggerData.link, supabaseUrl, supabaseKey);
                if (transcript) {
                  youtubeTranscript = transcript;
                  console.log(`YouTube transcript loaded: ${youtubeTranscript.length} chars`);
                }
              } catch (ytError) {
                console.warn('YouTube transcription failed:', ytError);
              }
            }
            
            // Build enriched prompt with full context + RSS data
            const rssPrompt = await buildEnrichedPrompt(
              automation.prompt_template,
              triggerData,
              automation,
              automation.content_type,
              mediaUrls,
              variationContext
            );
            
            // Combine: YouTube Transcript + Research Briefing + Enriched Context + RSS Prompt
            let finalPrompt = "";
            
            // Add YouTube transcript if available
            const transcriptBlock = youtubeTranscript 
              ? `\n\n## TRANSCRIÇÃO DO VÍDEO:\n${youtubeTranscript}\n\n---\n` 
              : '';
            
            if (researchBriefing) {
              finalPrompt = `${researchBriefing}${transcriptBlock}\n\n---\n\n## CONTEXTO DO CLIENTE:\n\n${enrichedContext}\n\n---\n\n## MATERIAL DE REFERÊNCIA (RSS/FONTE EXTERNA):\n\n${rssPrompt}`;
            } else if (enrichedContext) {
              finalPrompt = `${enrichedContext}${transcriptBlock}\n\n---\n\n## MATERIAL DE REFERÊNCIA (RSS/FONTE EXTERNA):\n\n${rssPrompt}`;
            } else {
              finalPrompt = `${transcriptBlock}${rssPrompt}`;
            }

            console.log(`Final prompt (${finalPrompt.length} chars): ${finalPrompt.substring(0, 300)}...`);

            // Use unified-content-api for consistent impeccable content generation
            const response = await fetch(`${supabaseUrl}/functions/v1/unified-content-api`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`,
              },
              body: JSON.stringify({
                client_id: automation.client_id,
                format: format,
                brief: finalPrompt,
                options: {
                  skip_review: false, // Always review for automations
                  strict_validation: true,
                },
              }),
            });

            if (response.ok) {
              const contentResult = await response.json();
              if (contentResult.content) {
                generatedContent = contentResult.content;
                
                // Clean content output: remove AI formatting labels for ALL content types
                // Pass derivedPlatform so cleaning is context-aware (e.g., text-only for twitter/threads)
                generatedContent = cleanContentOutput(generatedContent ?? "", derivedPlatform ?? undefined);
                console.log(`Content cleaned for ${derivedPlatform}: "${generatedContent.substring(0, 100)}..." (${generatedContent.length} chars)`);
                
                console.log(`Content generated (${generatedContent!.length} chars)`);
                
                // Update metadata based on content type
                const updatedMetadata = { ...metadata };
                
                // For threads, parse and structure the tweets with images
                if (automation.content_type === 'thread' && generatedContent) {
                  const threadTweets = parseThreadFromContent(generatedContent);
                  if (threadTweets && threadTweets.length > 0) {
                    // Distribute images across tweets
                    if (mediaUrls.length > 0) {
                      const imagesPerTweet = Math.ceil(mediaUrls.length / Math.min(threadTweets.length, 4));
                      let imageIndex = 0;
                      
                      for (let i = 0; i < threadTweets.length && imageIndex < mediaUrls.length; i++) {
                        const tweetImages: string[] = [];
                        for (let j = 0; j < imagesPerTweet && imageIndex < mediaUrls.length; j++) {
                          tweetImages.push(mediaUrls[imageIndex]);
                          imageIndex++;
                        }
                        threadTweets[i].media_urls = tweetImages;
                      }
                    }
                    
                    updatedMetadata.thread_tweets = threadTweets;
                    console.log(`Parsed ${threadTweets.length} tweets with distributed images`);
                  }
                }
                
                // For carousels, parse and structure the slides with images
                if (automation.content_type === 'carousel' && generatedContent) {
                  const carouselSlides = parseCarouselFromContent(generatedContent);
                  if (carouselSlides && carouselSlides.length > 0) {
                    // Distribute images across slides
                    if (mediaUrls.length > 0) {
                      const imagesPerSlide = Math.ceil(mediaUrls.length / Math.min(carouselSlides.length, mediaUrls.length));
                      let imageIndex = 0;
                      
                      for (let i = 0; i < carouselSlides.length && imageIndex < mediaUrls.length; i++) {
                        const slideImages: string[] = [];
                        for (let j = 0; j < imagesPerSlide && imageIndex < mediaUrls.length; j++) {
                          slideImages.push(mediaUrls[imageIndex]);
                          imageIndex++;
                        }
                        carouselSlides[i].media_urls = slideImages;
                      }
                    }
                    
                    updatedMetadata.carousel_slides = carouselSlides;
                    console.log(`Parsed ${carouselSlides.length} carousel slides with distributed images`);
                  }
                }
                
                await supabase
                  .from('planning_items')
                  .update({ 
                    content: generatedContent,
                    metadata: updatedMetadata,
                  })
                  .eq('id', newItem.id);
                  
                console.log(`Content saved to item ${newItem.id}`);

                // ========== NON-AUTO-PUBLISH: Move to "Revisão" for Telegram approval ==========
                if (!automation.auto_publish && generatedContent) {
                  try {
                    const { data: reviewColumn } = await supabase
                      .from('kanban_columns')
                      .select('id')
                      .eq('workspace_id', automation.workspace_id)
                      .eq('column_type', 'review')
                      .single();

                    if (reviewColumn) {
                      await supabase
                        .from('planning_items')
                        .update({
                          column_id: reviewColumn.id,
                          status: 'review',
                          metadata: {
                            ...updatedMetadata,
                            pending_telegram_approval: true,
                            auto_publish_on_approve: true,
                          },
                        })
                        .eq('id', newItem.id);

                      console.log(`Item ${newItem.id} moved to Revisão for Telegram approval`);
                    }
                  } catch (reviewErr) {
                    console.warn('Could not move to review column:', reviewErr);
                  }
                }
              }
            } else {
              const errorText = await response.text();
              console.error(`Content generation failed: ${errorText}`);
            }
          } catch (genError) {
            console.error(`Error generating content for ${automation.name}:`, genError);
          }
        }

        // Generate image if enabled
        if (automation.auto_generate_image && automation.client_id) {
          try {
            // ===================================================
            // SMART IMAGE PROMPT: Based on generated content + visual identity
            // ===================================================
            let imagePrompt = '';
            
            // Fetch client visual identity for enriched image prompts
            let visualIdentity = '';
            let visualRefs: any[] | null = null;
            try {
              const { data: client } = await supabase
                .from('clients')
                .select('identity_guide, brand_assets')
                .eq('id', automation.client_id)
                .single();
              
              if (client?.identity_guide) {
                // Extract color/visual cues from identity guide
                const guide = client.identity_guide as string;
                const colorMatch = guide.match(/(?:cores?|paleta|colors?|palette)[:\s]*([^\n]{10,100})/i);
                const styleMatch = guide.match(/(?:estilo visual|visual style|estética|aesthetic)[:\s]*([^\n]{10,100})/i);
                if (colorMatch) visualIdentity += `CORES DA MARCA: ${colorMatch[1].trim()}\n`;
                if (styleMatch) visualIdentity += `ESTÉTICA DA MARCA: ${styleMatch[1].trim()}\n`;
              }
              
              // Fetch visual references: use automation-specific refs if set, else fallback to is_primary
              if (automation.image_reference_ids && automation.image_reference_ids.length > 0) {
                // Use specific references selected for this automation
                const { data: fetchedVisualRefs } = await supabase
                  .from('client_visual_references')
                  .select('image_url, description, reference_type')
                  .in('id', automation.image_reference_ids)
                  .limit(5);
                
                visualRefs = fetchedVisualRefs;
                console.log(`Using ${visualRefs?.length || 0} automation-specific visual references`);
              } else {
                // Fallback: use client's primary visual references
                const { data: fetchedVisualRefs } = await supabase
                  .from('client_visual_references')
                  .select('image_url, description, reference_type')
                  .eq('client_id', automation.client_id)
                  .eq('is_primary', true)
                  .limit(3);
                
                visualRefs = fetchedVisualRefs;
              }
              
              if (visualRefs && visualRefs.length > 0) {
                visualIdentity += `REFERÊNCIAS VISUAIS: ${visualRefs.map(v => v.description || v.reference_type).join(', ')}\n`;
              }
            } catch (e) {
              console.warn('Could not fetch visual identity:', e);
            }
            
            if (automation.image_prompt_template) {
              imagePrompt = await replaceTemplateVariables(
                automation.image_prompt_template,
                triggerData,
                automation.name
              );
            }
            
            // Build the enriched image prompt using centralized builder
            const fullImagePrompt = buildImageBriefing({
              generatedContent: generatedContent || undefined,
              title: triggerData?.title || automation.name,
              customPrompt: imagePrompt || undefined,
              platform: derivedPlatform || undefined,
              contentType: automation.content_type,
              imageStyle: automation.image_style || undefined,
              visualIdentity: visualIdentity || undefined,
              visualRefDescriptions: visualRefs?.map(v => v.description || v.reference_type).filter(Boolean) || [],
            });
            
            console.log(`Generating image for item ${newItem.id}...`);
            console.log(`Image prompt: ${fullImagePrompt.substring(0, 200)}...`);
            
            // Build inputs array: text prompt + visual reference images
            const imageInputs: any[] = [{
              type: 'text',
              content: fullImagePrompt
            }];
            
            // Pass real reference images for style matching
            if (visualRefs && visualRefs.length > 0) {
              const supabaseStorageBase = `${supabaseUrl}/storage/v1/object/public/client-files/`;
              for (const ref of visualRefs) {
                if (ref.image_url) {
                  const refUrl = ref.image_url.startsWith('http') 
                    ? ref.image_url 
                    : `${supabaseStorageBase}${ref.image_url}`;
                  imageInputs.push({
                    type: 'image',
                    content: refUrl,
                    // Flag this as a style reference, not content to edit
                    imageBase64: undefined,
                  });
                }
              }
              console.log(`Passing ${imageInputs.length - 1} visual reference images to generate-content-v2`);
            }
            
            const isLinkedIn = derivedPlatform === 'linkedin';
            const imageResponse = await fetch(`${supabaseUrl}/functions/v1/generate-content-v2`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`,
              },
              body: JSON.stringify({
                type: 'image',
                inputs: imageInputs,
                config: {
                  format: isLinkedIn ? 'linkedin_post' : 'post',
                  aspectRatio: isLinkedIn ? '16:9' : '1:1',
                  noText: true,
                  useVisualReferences: visualRefs && visualRefs.length > 0,
                },
                clientId: automation.client_id,
                workspaceId: automation.workspace_id,
              }),
            });
            
            let imageResult: any = null;
            let imageGenSuccess = false;
            
            if (imageResponse.ok) {
              imageResult = await imageResponse.json();
              if (imageResult.imageUrl) {
                imageGenSuccess = true;
              } else {
                console.warn(`[IMAGE] Response OK but no imageUrl returned for "${automation.name}". Response keys: ${Object.keys(imageResult).join(', ')}`);
              }
            } else {
              const errorText = await imageResponse.text();
              console.error(`[IMAGE] Generation failed for "${automation.name}" (status ${imageResponse.status}): ${errorText}`);
            }
            
            // Retry once if first attempt failed
            if (!imageGenSuccess) {
              console.log(`[IMAGE] Retrying image generation for "${automation.name}"...`);
              try {
                const retryResponse = await fetch(`${supabaseUrl}/functions/v1/generate-content-v2`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${supabaseKey}`,
                  },
                  body: JSON.stringify({
                    type: 'image',
                    inputs: imageInputs,
                    config: {
                      format: isLinkedIn ? 'linkedin_post' : 'post',
                      aspectRatio: isLinkedIn ? '16:9' : '1:1',
                      noText: true,
                      useVisualReferences: visualRefs && visualRefs.length > 0,
                    },
                    settings: {
                      imageStyle: automation.image_style || 'illustration',
                    },
                    clientId: automation.client_id,
                    workspaceId: automation.workspace_id,
                  }),
                });
                
                if (retryResponse.ok) {
                  imageResult = await retryResponse.json();
                  if (imageResult.imageUrl) {
                    imageGenSuccess = true;
                    console.log(`[IMAGE] Retry succeeded for "${automation.name}"`);
                  } else {
                    console.error(`[IMAGE] Retry returned no imageUrl for "${automation.name}"`);
                  }
                } else {
                  const retryError = await retryResponse.text();
                  console.error(`[IMAGE] Retry also failed for "${automation.name}": ${retryError}`);
                }
              } catch (retryErr) {
                console.error(`[IMAGE] Retry exception for "${automation.name}":`, retryErr);
              }
            }
            
            if (imageGenSuccess && imageResult?.imageUrl) {
              mediaUrls.unshift(imageResult.imageUrl);
              console.log(`[IMAGE] ✅ Generated for "${automation.name}": ${imageResult.imageUrl}`);
              
              await supabase
                .from('planning_items')
                .update({ 
                  media_urls: mediaUrls,
                  metadata: {
                    ...toRecord(newItem.metadata),
                    generated_image_url: imageResult.imageUrl,
                    image_style: automation.image_style,
                  }
                })
                .eq('id', newItem.id);
            } else {
              console.error(`[IMAGE] ❌ FAILED for "${automation.name}" after retry. Item ${newItem.id} will have no image.`);
            }
          } catch (imgError) {
            console.error(`[IMAGE] Exception for "${automation.name}":`, imgError);
          }
        }

        // ========== AUTO-PUBLISH DIRECTLY ==========
        // Publish immediately without requiring Telegram approval.
        // Telegram will receive an informational notification after publishing.
        if (automation.auto_publish && automation.client_id && generatedContent) {
          const itemMeta0 = toRecord(newItem.metadata);
          const targetPlatforms: string[] = 
            Array.isArray(itemMeta0.target_platforms) && itemMeta0.target_platforms.length > 0 ? itemMeta0.target_platforms.filter((platform): platform is string => typeof platform === 'string') :
            (automation.platforms && automation.platforms.length > 0) ? automation.platforms :
            (derivedPlatform ? [derivedPlatform] : []);

          const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
          const publishedPlatforms: string[] = [];
          const publishedUrls: Record<string, string> = {};
          const latePostIds: Record<string, string> = {};

          for (const targetPlatform of targetPlatforms) {
            try {
              const publishBody: Record<string, unknown> = {
                clientId: automation.client_id,
                platform: targetPlatform,
                content: generatedContent,
                planningItemId: newItem.id,
              };

              // Add thread items if available
              const threadTweets = toRecordArray(itemMeta0.thread_tweets);
              if (automation.content_type === 'thread' && threadTweets.length > 0) {
                publishBody.threadItems = threadTweets.map((tweet) => ({
                  text: typeof tweet.text === 'string' ? tweet.text : '',
                  media_urls: Array.isArray(tweet.media_urls)
                    ? tweet.media_urls.filter((url): url is string => typeof url === 'string')
                    : [],
                }));
              }

              // Add carousel media if available
              const carouselSlides = toRecordArray(itemMeta0.carousel_slides);
              if (automation.content_type === 'carousel' && carouselSlides.length > 0) {
                const carouselMedia: { url: string; type: string }[] = [];
                for (const slide of carouselSlides) {
                  const slideMediaUrls = Array.isArray(slide.media_urls)
                    ? slide.media_urls.filter((url): url is string => typeof url === 'string')
                    : [];
                  if (slideMediaUrls.length > 0) {
                    for (const url of slideMediaUrls) {
                      carouselMedia.push({ url, type: url.match(/\.(mp4|mov|webm)$/i) ? 'video' : 'image' });
                    }
                  }
                }
                if (carouselMedia.length > 0) publishBody.mediaItems = carouselMedia;
              }

              // Regular media
              if (!publishBody.threadItems && !publishBody.mediaItems && mediaUrls?.length > 0) {
                publishBody.mediaItems = mediaUrls.map((url: string) => ({
                  url,
                  type: url.match(/\.(mp4|mov|webm)$/i) ? 'video' : 'image',
                }));
              }

              const publishResponse = await fetch(`${supabaseUrl}/functions/v1/late-post`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${serviceKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(publishBody),
              });

              if (publishResponse.ok) {
                const publishResult = await publishResponse.json();
                const externalPostId = publishResult.externalId || publishResult.postId;

                if (publishResult.success && externalPostId) {
                  publishedPlatforms.push(targetPlatform);
                  latePostIds[targetPlatform] = externalPostId;
                  if (publishResult.postUrl || publishResult.url) {
                    publishedUrls[targetPlatform] = publishResult.postUrl || publishResult.url;
                  }
                  console.log(`📤 Published to ${targetPlatform}: ${externalPostId}`);
                } else {
                  console.warn(`⚠️ ${targetPlatform} publish failed: ${publishResult.error || 'unknown'}`);
                }
              } else {
                const errText = await publishResponse.text();
                console.warn(`❌ ${targetPlatform} publish error: ${errText.substring(0, 200)}`);
              }
            } catch (pubErr) {
              console.error(`❌ ${targetPlatform} publish exception:`, pubErr);
            }
          }

          // Update planning item with publish results
          if (publishedPlatforms.length > 0) {
            // Get published column
            const { data: publishedColumn } = await supabase
              .from('kanban_columns')
              .select('id')
              .eq('workspace_id', automation.workspace_id)
              .eq('column_type', 'published')
              .single();

            await supabase
              .from('planning_items')
              .update({
                status: 'published',
                published_at: new Date().toISOString(),
                column_id: publishedColumn?.id || columnId,
                external_post_id: Object.values(latePostIds)[0] || null,
                metadata: {
                  ...itemMeta0,
                  auto_published: true,
                  published_at: new Date().toISOString(),
                  published_platforms: publishedPlatforms,
                  late_post_ids: latePostIds,
                  published_urls: publishedUrls,
                  automation_id: automation.id,
                  automation_name: automation.name,
                },
              })
              .eq('id', newItem.id);

            console.log(`✅ Item ${newItem.id} published to [${publishedPlatforms.join(', ')}]`);
          } else {
            console.warn(`⚠️ Item ${newItem.id} — no platform published successfully`);
          }
        }

        // Update automation tracking
        const updateData: Record<string, unknown> = {
          last_triggered_at: new Date().toISOString(),
          items_created: (automation.items_created || 0) + 1,
        };

        if (automation.trigger_type === 'rss' && newGuid) {
          updateData.trigger_config = {
            ...automation.trigger_config,
            last_guid: newGuid,
            last_checked: new Date().toISOString(),
          };
        }

        await supabase
          .from('planning_automations')
          .update(updateData)
          .eq('id', automation.id);

        // ========== CRIAR NOTIFICAÇÃO PARA O USUÁRIO ==========
        // Notify the user that created the automation (or fallback to workspace owner)
        const notifyUserId = automation.created_by;
        
        if (notifyUserId) {
          try {
            await supabase.from('notifications').insert({
              user_id: notifyUserId,
              workspace_id: automation.workspace_id,
              type: 'automation_completed',
              title: `Automação executada: ${automation.name}`,
              message: `Criado: "${itemTitle}"`,
              entity_type: 'planning_item',
              entity_id: newItem.id,
              metadata: {
                automation_id: automation.id,
                automation_name: automation.name,
                trigger_type: automation.trigger_type,
                content_type: automation.content_type,
                published: false, // Will be updated after checking final status
              }
            });
            console.log(`Notification created for user ${notifyUserId.substring(0, 8)}...`);
          } catch (notifError) {
            console.error('Error creating notification:', notifError);
          }
        } else {
          // Fallback: notify workspace owner
          try {
            const { data: workspace } = await supabase
              .from('workspaces')
              .select('owner_id')
              .eq('id', automation.workspace_id)
              .single();
            
            if (workspace?.owner_id) {
              await supabase.from('notifications').insert({
                user_id: workspace.owner_id,
                workspace_id: automation.workspace_id,
                type: 'automation_completed',
                title: `Automação executada: ${automation.name}`,
                message: `Criado: "${itemTitle}"`,
                entity_type: 'planning_item',
                entity_id: newItem.id,
                metadata: {
                  automation_id: automation.id,
                  automation_name: automation.name,
                  trigger_type: automation.trigger_type,
                }
              });
              console.log(`Notification created for workspace owner ${workspace.owner_id.substring(0, 8)}...`);
            }
          } catch (notifError) {
            console.error('Error creating notification for owner:', notifError);
          }
        }

        // ========== ENVIAR NOTIFICAÇÃO TELEGRAM ==========
        try {
          // Fetch client name for the notification
          let clientName = 'N/A';
          if (automation.client_id) {
            const { data: clientData } = await supabase
              .from('clients')
              .select('name')
              .eq('id', automation.client_id)
              .single();
            clientName = clientData?.name || 'N/A';
          }

          // Check if item was auto-published by looking at its current metadata
          const { data: currentItem } = await supabase
            .from('planning_items')
            .select('metadata, status')
            .eq('id', newItem.id)
            .single();
          const currentMeta = (currentItem?.metadata as any) || {};
          const wasPublished = currentItem?.status === 'published';

          const telegramPayload = {
            item_id: newItem.id,
            title: itemTitle,
            content: generatedContent || itemDescription || '',
            image_url: mediaUrls?.[0] || null,
            platform: derivedPlatform,
            client_name: clientName,
            automation_name: automation.name,
            content_type: automation.content_type,
            published: wasPublished,
            published_urls: currentMeta.published_urls || null,
            published_platforms: currentMeta.published_platforms || null,
          };

          fetch(`${supabaseUrl}/functions/v1/telegram-notify`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify(telegramPayload),
          }).then(async (res) => {
            if (res.ok) {
              console.log(`📱 Telegram notification sent for item ${newItem.id}`);
            } else {
              const errText = await res.text();
              console.warn(`⚠️ Telegram notification failed: ${errText.substring(0, 200)}`);
            }
          }).catch(err => {
            console.warn(`⚠️ Telegram notification error:`, err);
          });
        } catch (telegramError) {
          console.warn('Telegram notification error (non-blocking):', telegramError);
        }

        // Build trigger data for run record - include item_id for detail lookup
        const triggerDataForRun: Record<string, unknown> = {
          item_id: newItem.id,
          generated_content: generatedContent ? generatedContent.substring(0, 500) : null,
        };
        
        if (triggerData) {
          triggerDataForRun.title = triggerData.title;
          triggerDataForRun.link = triggerData.link;
          triggerDataForRun.images_count = triggerData.allImages?.length || 0;
        }
        
        // Check if item was published and add that info (including metadata errors)
        const { data: finalItem } = await supabase
          .from('planning_items')
          .select('status, external_post_id, error_message, metadata')
          .eq('id', newItem.id)
          .single();
        
        if (finalItem) {
          triggerDataForRun.published = finalItem.status === 'published';
          triggerDataForRun.external_post_id = finalItem.external_post_id;
          
          // Capture error from multiple sources for UI visibility
          const publishError = finalItem.error_message || 
            (finalItem.metadata as any)?.auto_publish_error ||
            (finalItem.status === 'failed' ? 'Publicação falhou' : null);
            
          if (publishError) {
            triggerDataForRun.publish_error = publishError;
          }
          
          // Include Late API response for debugging
          if ((finalItem.metadata as any)?.late_response) {
            triggerDataForRun.late_response = (finalItem.metadata as any).late_response;
          }
        }

        // Update run as completed
        if (runId) {
          await supabase
            .from('planning_automation_runs')
            .update({
              status: 'completed',
              result: generatedContent 
                ? `Criado e gerado: ${itemTitle}` 
                : `Criado: ${itemTitle}`,
              items_created: 1,
              completed_at: new Date().toISOString(),
              duration_ms: Date.now() - startTime,
              trigger_data: triggerDataForRun,
            })
            .eq('id', runId);
        }

        results.push({ id: automation.id, name: automation.name, triggered: true, runId: runId || undefined });

      } catch (automationError) {
        console.error(`Error processing automation ${automation.name}:`, automationError);
        
        if (runId) {
          await supabase
            .from('planning_automation_runs')
            .update({
              status: 'failed',
              error: automationError instanceof Error ? automationError.message : 'Unknown error',
              completed_at: new Date().toISOString(),
              duration_ms: Date.now() - startTime,
            })
            .eq('id', runId);
        }
        
        results.push({ 
          id: automation.id, 
          name: automation.name, 
          triggered: false, 
          error: automationError instanceof Error ? automationError.message : 'Unknown error',
          runId: runId || undefined
        });
      }
      } // end for automation loop
    }; // end runLoop

    if (isManualTest) {
      // @ts-expect-error — EdgeRuntime is available in Supabase Edge Runtime
      EdgeRuntime.waitUntil(
        runLoop().catch((e) => console.error('[process-automations] background run failed:', e))
      );
      return new Response(JSON.stringify({
        success: true,
        accepted: true,
        message: 'Automação iniciada em background. Acompanhe pelo histórico de execuções.',
        automationId,
      }), {
        status: 202,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await runLoop();

    const triggered = results.filter(r => r.triggered).length;
    console.log(`Processing complete. Triggered: ${triggered}/${results.length}`);

    return new Response(JSON.stringify({
      success: true,
      processed: results.length,
      triggered,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in process-automations:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
