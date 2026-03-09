import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { 
  FORMAT_MAP, 
  PLATFORM_MAP, 
  CONTENT_TYPE_LABELS,
  getFormatLabel 
} from "../_shared/format-constants.ts";
import { getFullContentContext, getStructuredVoice } from "../_shared/knowledge-loader.ts";

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
  cleaned = cleaned.replace(/^\s*[\-\*]\s+/gm, ''); // bullet points
  
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

// Replace template variables in prompt
function replaceTemplateVariables(template: string, data: RSSItem | null, automationName: string): string {
  if (!template) return '';
  
  let prompt = template;
  
  // Get time of day based on current hour
  const hour = new Date().getHours();
  let timeOfDay = 'noite';
  if (hour >= 5 && hour < 12) timeOfDay = 'manhã';
  else if (hour >= 12 && hour < 18) timeOfDay = 'tarde';
  
  const variables: Record<string, string> = {
    '{{title}}': data?.title || automationName,
    '{{description}}': data?.description?.replace(/<[^>]*>/g, '').substring(0, 500) || '',
    '{{link}}': data?.link || '',
    '{{content}}': data?.content?.replace(/<[^>]*>/g, '').substring(0, 3000) || data?.description?.replace(/<[^>]*>/g, '').substring(0, 3000) || '',
    '{{images}}': (data?.allImages?.length || 0) > 0 
      ? `${data!.allImages!.length} imagens disponíveis do conteúdo original`
      : 'Sem imagens disponíveis',
    '{{time_of_day}}': timeOfDay,
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

// GM Tweet variation categories for anti-repetition
const GM_VARIATION_CATEGORIES = [
  { name: 'Provocação', instruction: 'Use um tom provocativo e desafiador. Questione uma crença comum do nicho. Seja bold e contrarian.' },
  { name: 'Insight técnico', instruction: 'Compartilhe um insight técnico ou dado específico do nicho. Mostre profundidade de conhecimento.' },
  { name: 'Pergunta', instruction: 'Faça uma pergunta poderosa que gere reflexão. Não responda - deixe o leitor pensar.' },
  { name: 'Storytelling micro', instruction: 'Conte uma micro-história em 1-2 frases. Use narrativa pessoal ou metáfora.' },
  { name: 'Call-to-action', instruction: 'Termine com uma chamada para ação clara. Peça opinião, RT, ou ação concreta.' },
  { name: 'Dado/Métrica', instruction: 'Use um número, estatística ou dado concreto como gancho principal. Seja específico.' },
  { name: 'Humor/Ironia', instruction: 'Use humor inteligente ou ironia sutil. Seja espirituoso sem ser genérico.' },
  { name: 'Observação aguda', instruction: 'Faça uma observação perspicaz sobre o mercado/nicho que poucos percebem.' },
];

// LinkedIn editorial variation categories for anti-repetition
const LINKEDIN_VARIATION_CATEGORIES: Record<string, Array<{ name: string; instruction: string }>> = {
  'opinion': [
    { name: 'Contrarian Take', instruction: 'Desafie uma crença popular do mercado Web3/marketing com argumentos sólidos. Comece com "Todo mundo fala X, mas a verdade é Y". Tom provocativo mas fundamentado.' },
    { name: 'Dados & Análise', instruction: 'Use dados concretos, números e métricas como base do argumento. Cite fontes ou experiências mensuráveis. Framework analítico.' },
    { name: 'Framework Próprio', instruction: 'Apresente um framework, modelo mental ou metodologia própria para resolver um problema do mercado. Use nomenclatura original.' },
    { name: 'Tendência Emergente', instruction: 'Analise uma tendência emergente em cripto/IA/marketing que poucos estão falando. Posicione-se sobre o futuro com visão de quem constrói.' },
    { name: 'Lição do Fracasso', instruction: 'Comece com um erro real, investimento perdido ou decisão errada. Extraia a lição profunda. Vulnerabilidade + insight = conexão.' },
  ],
  'building_in_public': [
    { name: 'Bastidores Reais', instruction: 'Mostre o dia-a-dia real da Kaleidos: reuniões, decisões difíceis, processos internos. Seja raw e autêntico, não polido.' },
    { name: 'Números Abertos', instruction: 'Compartilhe uma métrica real do negócio: faturamento, crescimento, churn, leads. Contextualize o número com a jornada.' },
    { name: 'Aprendizado Honesto', instruction: 'Revele algo que aprendeu recentemente na prática que contradiz a teoria. "Na teoria X, na prática Y". Tom confessional.' },
    { name: 'Ferramenta/Stack', instruction: 'Revele uma ferramenta, automação ou processo interno que usa na Kaleidos. Explique por que e como implementou. Prático e replicável.' },
    { name: 'Decisão Difícil', instruction: 'Conte sobre uma decisão recente que foi difícil: demitir, pivotar, recusar cliente, investir. Mostre o processo de decisão.' },
  ],
  'case_study': [
    { name: 'Resultados & Métricas', instruction: 'Apresente resultados concretos de um cliente da Kaleidos: antes vs depois, ROI, crescimento. Use números reais ou realistas.' },
    { name: 'Processo Revelado', instruction: 'Mostre o passo-a-passo de como resolveu um problema de um cliente. Framework de diagnóstico → estratégia → execução → resultado.' },
    { name: 'Transformação do Cliente', instruction: 'Conte a história de transformação: onde o cliente estava, o desafio, a virada, onde está agora. Formato storytelling.' },
    { name: 'Erro que Virou Acerto', instruction: 'Comece com algo que deu errado num projeto de cliente. Mostre como corrigiu e o resultado final superou as expectativas.' },
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
function buildEnrichedPrompt(
  template: string | null,
  data: RSSItem | null,
  automation: PlanningAutomation,
  contentType: string,
  mediaUrls: string[],
  variationContext?: { category: string; instruction: string; recentTweets: string[] }
): string {
  // First, replace template variables if we have a template
  let prompt = replaceTemplateVariables(template || '', data, automation.name);
  
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
        prompt += `\n${i + 1}. "${tweet}"`;
      });
      prompt += `\n\n⚠️ Seu tweet DEVE ser fundamentalmente DIFERENTE dos exemplos acima em estrutura, tema e abordagem.`;
    }
  }
  
  // Add image context for visual formats
  if (mediaUrls.length > 0 && ['thread', 'carousel', 'instagram_post', 'stories'].includes(contentType)) {
    prompt += `\n\n📸 IMAGENS DISPONÍVEIS (${mediaUrls.length}): As imagens do conteúdo original serão anexadas automaticamente. Faça referência a elas nos pontos relevantes do conteúdo.`;
  }
  
  // Add format-specific tips
  switch (contentType) {
    case 'tweet':
      prompt += `\n\n⚠️ REGRAS ABSOLUTAS PARA TWEET:
- Máximo 280 caracteres
- Use gancho forte no início
- RESPONDA APENAS COM O TEXTO FINAL DO TWEET
- NÃO use rótulos como "TEXTO DO VISUAL:", "LEGENDA:", "TWEET:", "CAPTION:" etc.
- NÃO use markdown (sem ** ou ##)
- NÃO inclua instruções, explicações ou metadata
- Apenas o texto puro do tweet, pronto para publicar`;
      break;
    case 'thread':
      prompt += `\n\n⚠️ FORMATO: Numere cada tweet (1/, 2/, etc). Máximo 280 chars por tweet. Gancho forte no primeiro.`;
      break;
    case 'carousel':
      prompt += `\n\n⚠️ FORMATO: Use "Página 1:", "Página 2:", etc. Máximo 30 palavras por slide. 8-10 slides idealmente.`;
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

    const results: { id: string; name: string; triggered: boolean; error?: string; runId?: string }[] = [];

    for (const automation of (automations as PlanningAutomation[]) || []) {
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
              
            case 'rss':
              const rssResult = await checkRSSTrigger(automation.trigger_config);
              shouldTrigger = rssResult.shouldTrigger;
              triggerData = rssResult.data || null;
              newGuid = rssResult.newGuid;
              break;
              
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
        const targetPlatforms: string[] = (automation as any).platforms?.length > 0
          ? (automation as any).platforms
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
              // Get variation index and rotate
              const triggerConfig = automation.trigger_config as any;
              const variationIndex = (triggerConfig.variation_index || 0) % GM_VARIATION_CATEGORIES.length;
              const variation = GM_VARIATION_CATEGORIES[variationIndex];
              
              // Fetch recent tweets as anti-examples
              let recentTweets: string[] = [];
              try {
                const { data: recentPosts } = await supabase
                  .from('twitter_posts')
                  .select('content')
                  .eq('client_id', automation.client_id!)
                  .not('content', 'is', null)
                  .order('posted_at', { ascending: false })
                  .limit(7);
                
                if (recentPosts) {
                  recentTweets = recentPosts.map(p => p.content!).filter(Boolean);
                }
              } catch (e) {
                console.warn('Could not fetch recent tweets for anti-examples:', e);
              }
              
              variationContext = {
                category: variation.name,
                instruction: variation.instruction,
                recentTweets,
              };
              
              // Increment variation index
              await supabase
                .from('planning_automations')
                .update({
                  trigger_config: {
                    ...automation.trigger_config,
                    variation_index: variationIndex + 1,
                  }
                })
                .eq('id', automation.id);
              
              console.log(`Variation: ${variation.name} (index ${variationIndex}), ${recentTweets.length} anti-examples`);
            }
            
            // LinkedIn editorial variation system
            if (automation.content_type === 'linkedin_post') {
              const triggerConfig = automation.trigger_config as any;
              const variationIndex = triggerConfig.variation_index || 0;
              const linkedInVariation = getLinkedInVariation(automation.name, variationIndex);
              
              // Fetch recent LinkedIn posts as anti-examples
              let recentPosts: string[] = [];
              try {
                const { data: recent } = await supabase
                  .from('planning_items')
                  .select('content')
                  .eq('client_id', automation.client_id!)
                  .eq('platform', 'linkedin')
                  .not('content', 'is', null)
                  .order('created_at', { ascending: false })
                  .limit(5);
                
                if (recent) {
                  recentPosts = recent.map(p => p.content!).filter(Boolean).map(c => c.substring(0, 200));
                }
              } catch (e) {
                console.warn('Could not fetch recent LinkedIn posts:', e);
              }
              
              variationContext = {
                category: `LinkedIn ${linkedInVariation.editorialType}: ${linkedInVariation.category}`,
                instruction: `${linkedInVariation.instruction}

📝 FORMATO LINKEDIN OBRIGATÓRIO:
- Primeiras 2 linhas = GANCHO IRRESISTÍVEL (determinam se clicam em "ver mais")
- Parágrafos de 1-2 linhas máximo (leitura mobile)
- Espaço entre CADA parágrafo
- 1.200-1.500 caracteres ideal (máximo 3.000)
- Termine SEMPRE com pergunta que gera comentários
- Máximo 3 hashtags relevantes no final
- Tom: técnico mas didático, direto, visionário, provocador
- Posicionamento: "O Estrategista Full-Stack para Marcas Web3"
- NUNCA use emojis em excesso (máximo 2)
- Use quebras de linha generosas para respiro visual`,
                recentTweets: recentPosts,
              };
              
              // Increment variation index
              await supabase
                .from('planning_automations')
                .update({
                  trigger_config: {
                    ...automation.trigger_config,
                    variation_index: variationIndex + 1,
                  }
                })
                .eq('id', automation.id);
              
              console.log(`LinkedIn Variation: ${linkedInVariation.category} (type: ${linkedInVariation.editorialType}, index ${variationIndex})`);
            }
            
            // ===================================================
            // YOUTUBE TRANSCRIPTION: Enrich prompt with video content
            // ===================================================
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
            const rssPrompt = buildEnrichedPrompt(
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
                generatedContent = cleanContentOutput(generatedContent, derivedPlatform || undefined);
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
              
              // Fetch visual references (including image_url for real visual input)
              const { data: fetchedVisualRefs } = await supabase
                .from('client_visual_references')
                .select('image_url, description, reference_type')
                .eq('client_id', automation.client_id)
                .eq('is_primary', true)
                .limit(3);
              
              visualRefs = fetchedVisualRefs;
              
              if (visualRefs && visualRefs.length > 0) {
                visualIdentity += `REFERÊNCIAS VISUAIS: ${visualRefs.map(v => v.description || v.reference_type).join(', ')}\n`;
              }
            } catch (e) {
              console.warn('Could not fetch visual identity:', e);
            }
            
            if (automation.image_prompt_template) {
              imagePrompt = replaceTemplateVariables(
                automation.image_prompt_template,
                triggerData,
                automation.name
              );
            } else if (generatedContent) {
              // Build contextual prompt from generated content
              const contentSummary = generatedContent.substring(0, 200).replace(/\n/g, ' ');
              imagePrompt = `Create a powerful visual that captures the essence of this message: "${contentSummary}"`;
            } else {
              const title = triggerData?.title || automation.name;
              imagePrompt = `Create a striking visual for: ${title}`;
            }
            
            // Build the enriched image prompt
            const styleModifier = getImageStyleModifier(automation.image_style);
            const isLinkedIn = automation.platform === 'linkedin' || automation.content_type === 'linkedin_post';
            const platformFormat = automation.platform === 'twitter' || automation.content_type === 'tweet' 
              ? '1:1 square format for Twitter/X' 
              : isLinkedIn 
                ? '1.91:1 landscape format for LinkedIn (1200x628px)' 
                : '1:1 format';
            
            const fullImagePrompt = `${visualIdentity ? `IDENTIDADE VISUAL DO CLIENTE:\n${visualIdentity}\n` : ''}CONTEÚDO DO POST: ${imagePrompt}

ESTILO: ${styleModifier}
FORMATO: ${platformFormat}

REGRAS ABSOLUTAS:
- NÃO coloque NENHUM texto, palavra, letra ou número na imagem
- NO TEXT, NO WORDS, NO LETTERS, NO NUMBERS in the image
- A imagem deve ser puramente visual, sem elementos tipográficos
- Composição limpa e profissional
- Transmita a emoção e conceito do conteúdo visualmente`;
            
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
                    type: 'image',
                    inputs: imageInputs,
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
                    ...(newItem.metadata as any || {}),
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

        // Auto publish if enabled
        if (automation.auto_publish && automation.client_id && generatedContent) {
          // Determine target platforms: use metadata.target_platforms, automation.platforms[], or fallback to derived
          const itemMeta0 = (newItem.metadata as any) || {};
          const targetPlatforms: string[] = 
            itemMeta0.target_platforms?.length > 0 ? itemMeta0.target_platforms :
            (automation as any).platforms?.length > 0 ? (automation as any).platforms :
            (derivedPlatform ? [derivedPlatform] : []);

          for (const targetPlatform of targetPlatforms) {
            try {
              console.log(`Auto-publishing item ${newItem.id} to ${targetPlatform}...`);
              
              const { data: credentials } = await supabase
                .from('client_social_credentials')
                .select('metadata')
                .eq('client_id', automation.client_id)
                .eq('platform', targetPlatform === 'twitter' ? 'twitter' : targetPlatform)
                .maybeSingle();

              const lateProfileId = (credentials?.metadata as any)?.late_profile_id;

              if (lateProfileId) {
                // Build publish body with proper structured data for threads/carousels/videos
                const publishBody: Record<string, unknown> = {
                  clientId: automation.client_id,
                  platform: targetPlatform,
                  content: generatedContent,
                  planningItemId: newItem.id,
                };

                // Reload the latest item metadata (may have been updated with thread_tweets/carousel_slides)
                const { data: latestItem } = await supabase
                  .from('planning_items')
                  .select('metadata')
                  .eq('id', newItem.id)
                  .single();
                const itemMeta = (latestItem?.metadata as any) || {};

                // Threads: send threadItems so late-post publishes as a proper thread
                if (automation.content_type === 'thread' && itemMeta.thread_tweets?.length > 0) {
                  publishBody.threadItems = itemMeta.thread_tweets.map((t: any) => ({
                    text: t.text,
                    media_urls: t.media_urls || [],
                  }));
                  console.log(`Sending ${itemMeta.thread_tweets.length} threadItems to late-post`);
                }

                // Carousel: send mediaItems with correct order for Instagram carousel
                if (automation.content_type === 'carousel' && itemMeta.carousel_slides?.length > 0) {
                  const carouselMedia: { url: string; type: string }[] = [];
                  for (const slide of itemMeta.carousel_slides) {
                    if (slide.media_urls?.length > 0) {
                      for (const url of slide.media_urls) {
                        carouselMedia.push({ url, type: url.match(/\.(mp4|mov|webm)$/i) ? 'video' : 'image' });
                      }
                    }
                  }
                  if (carouselMedia.length > 0) {
                    publishBody.mediaItems = carouselMedia;
                    console.log(`Sending ${carouselMedia.length} carousel mediaItems to late-post`);
                  }
                }

                // For non-thread, non-carousel: send mediaItems with type detection
                if (!publishBody.threadItems && !publishBody.mediaItems && mediaUrls.length > 0) {
                  publishBody.mediaItems = mediaUrls.map((url: string) => ({
                    url,
                    type: url.match(/\.(mp4|mov|webm)$/i) ? 'video' : 'image',
                  }));
                }

                const publishResponse = await fetch(`${supabaseUrl}/functions/v1/late-post`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${supabaseKey}`,
                  },
                  body: JSON.stringify(publishBody),
                });

                if (publishResponse.ok) {
                  const publishResult = await publishResponse.json();
                  console.log(`Publish response for item ${newItem.id} on ${targetPlatform}:`, JSON.stringify(publishResult));
                  
                  const externalPostId = publishResult.externalId || publishResult.postId;
                  
                  if (publishResult.success && externalPostId) {
                    console.log(`✅ Successfully published item ${newItem.id} to ${targetPlatform} with externalId: ${externalPostId}`);
                    
                    await supabase
                      .from('planning_items')
                      .update({ 
                        status: 'published',
                        external_post_id: externalPostId,
                        metadata: {
                          ...itemMeta,
                          auto_published: true,
                          published_at: new Date().toISOString(),
                          late_post_id: externalPostId,
                          late_response: publishResult,
                          published_platforms: [...(itemMeta.published_platforms || []), targetPlatform],
                        }
                      })
                      .eq('id', newItem.id);
                  } else {
                    const publishError = publishResult.error || publishResult.message || 'Late API did not confirm successful publication';
                    console.warn(`⚠️ Late API returned OK but no success confirmation for item ${newItem.id} on ${targetPlatform}:`, publishResult);
                    
                    await supabase
                      .from('planning_items')
                      .update({ 
                        status: 'failed',
                        error_message: publishError,
                        metadata: {
                          ...itemMeta,
                          auto_publish_attempted: true,
                          auto_publish_error: publishError,
                          late_response: publishResult,
                        }
                      })
                      .eq('id', newItem.id);
                  }
                } else {
                  const errorText = await publishResponse.text();
                  console.error(`❌ Failed to publish item ${newItem.id} to ${targetPlatform}:`, errorText);
                  
                  await supabase
                    .from('planning_items')
                    .update({ 
                      status: 'failed',
                      metadata: {
                        ...itemMeta,
                        auto_publish_attempted: true,
                        auto_publish_error: errorText,
                      }
                    })
                    .eq('id', newItem.id);
                }
              } else {
                console.log(`No Late API credentials found for ${targetPlatform}`);
              }
            } catch (publishError) {
              console.error(`Error auto-publishing to ${targetPlatform} for ${automation.name}:`, publishError);
            }
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
    }

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
