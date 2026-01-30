/**
 * Unified Content Generation Library
 * Pure functions for parsing, prompt building, and content formatting
 */

import { supabase } from "@/integrations/supabase/client";
import { parseMentions } from "@/lib/mentionParser";

// ============= Types =============

export interface TweetItem {
  id: string;
  content: string;
  image?: string;
}

export interface SlideItem {
  id: string;
  title?: string;
  content: string;
  image?: string;
}

export interface ReferenceContent {
  title?: string;
  content: string;
  type: 'youtube' | 'article' | 'html' | 'newsletter' | 'theme' | 'reference';
  thumbnail?: string;
  images?: string[];
}

export interface ExtractedReferences {
  content: string;
  images: string[];
  sources: Array<{ type: string; title?: string }>;
}

export interface StructuredContent {
  thread_tweets?: TweetItem[];
  carousel_slides?: SlideItem[];
  newsletter_sections?: { title: string; content: string }[];
}

// ============= Constants =============

export const CONTENT_TYPE_LABELS: Record<string, string> = {
  tweet: "tweet para Twitter/X",
  thread: "thread com 5-10 tweets para Twitter/X",
  x_article: "artigo longo no X (Twitter)",
  linkedin_post: "post para LinkedIn",
  carousel: "carrossel com 7-10 slides para Instagram",
  stories: "sequência de stories para Instagram",
  static_image: "post estático para Instagram",
  instagram_post: "post para Instagram",
  newsletter: "newsletter completa",
  blog_post: "artigo de blog",
  short_video: "roteiro de vídeo curto (Reels/TikTok)",
  long_video: "roteiro de vídeo longo (YouTube)",
  email_marketing: "email de marketing",
  other: "conteúdo",
};

export const PLATFORM_MAP: Record<string, string> = {
  tweet: "twitter",
  thread: "twitter",
  x_article: "twitter",
  linkedin_post: "linkedin",
  carousel: "instagram",
  stories: "instagram",
  static_image: "instagram",
  instagram_post: "instagram",
  newsletter: "newsletter",
  blog_post: "blog",
  short_video: "tiktok",
  long_video: "youtube",
  email_marketing: "email",
};

// ============= Reference Extraction =============

/**
 * Fetch content from a URL via edge function
 */
export async function fetchUrlContent(url: string): Promise<ReferenceContent | null> {
  try {
    const { data, error } = await supabase.functions.invoke("fetch-reference-content", {
      body: { url }
    });

    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || "Failed to fetch reference");

    return {
      title: data.title,
      content: data.content || "",
      type: data.type || "article",
      thumbnail: data.thumbnail,
      images: data.images || []
    };
  } catch (error) {
    console.error("[contentGeneration] URL fetch failed:", error);
    return null;
  }
}

/**
 * Fetch content from @mentions in the library
 */
export async function fetchMentionedContent(text: string): Promise<string> {
  const mentions = parseMentions(text);
  if (mentions.length === 0) return "";

  const contents: string[] = [];

  for (const mention of mentions) {
    const table = mention.type === 'content' 
      ? 'client_content_library' 
      : 'client_reference_library';

    const { data } = await supabase
      .from(table)
      .select('title, content')
      .eq('id', mention.id)
      .single();

    if (data?.content) {
      contents.push(`**${data.title}:**\n${data.content}`);
    }
  }

  return contents.join('\n\n---\n\n');
}

/**
 * Extract ALL references from input (URLs, @mentions, plain text)
 */
export async function extractAllReferences(
  input: string | undefined
): Promise<ExtractedReferences> {
  if (!input) {
    return { content: "", images: [], sources: [] };
  }

  const allContent: string[] = [];
  const extractedImages: string[] = [];
  const sources: Array<{ type: string; title?: string }> = [];

  // 1. Extract and fetch ALL URLs
  const urlMatches = input.match(/https?:\/\/[^\s]+/g) || [];
  if (urlMatches.length > 0) {
    console.log(`[contentGeneration] Found ${urlMatches.length} URLs to fetch`);
    
    const fetchPromises = urlMatches.map(url => fetchUrlContent(url));
    const fetchedResults = await Promise.all(fetchPromises);
    
    fetchedResults.forEach((fetched, index) => {
      if (fetched) {
        const sourceType = fetched.type === 'youtube' ? 'TRANSCRIÇÃO DO VÍDEO' :
                          fetched.type === 'newsletter' ? 'NEWSLETTER' :
                          'ARTIGO DE REFERÊNCIA';
        
        const charLimit = Math.floor(12000 / urlMatches.length);
        let refText = `**${sourceType}${urlMatches.length > 1 ? ` #${index + 1}` : ''}:**`;
        if (fetched.title) refText += `\nTítulo: ${fetched.title}`;
        refText += `\n\n${fetched.content.substring(0, charLimit)}`;
        allContent.push(refText);
        
        sources.push({ type: fetched.type, title: fetched.title });

        if (fetched.thumbnail && !extractedImages.includes(fetched.thumbnail)) {
          extractedImages.push(fetched.thumbnail);
        }
        if (fetched.images) {
          fetched.images.forEach(img => {
            if (!extractedImages.includes(img)) {
              extractedImages.push(img);
            }
          });
        }
      }
    });
  }

  // 2. Fetch @mentioned content
  const mentionContent = await fetchMentionedContent(input);
  if (mentionContent) {
    allContent.push(`**CONTEÚDO DA BIBLIOTECA:**\n\n${mentionContent}`);
    sources.push({ type: 'library' });
  }

  // 3. Extract clean plain text (without URLs and mentions)
  const cleanText = input
    .replace(/https?:\/\/[^\s]+/g, '')
    .replace(/@\[[^\]]+\]\([^)]+\)/g, '')
    .trim();

  if (cleanText) {
    allContent.push(cleanText);
  }

  return {
    content: allContent.join('\n\n---\n\n'),
    images: extractedImages.slice(0, 5), // Limit to 5 images
    sources
  };
}

// ============= Thread Parsing =============

/**
 * Parse thread content into individual tweets
 */
export function parseThreadFromContent(content: string): TweetItem[] | null {
  if (!content) return null;

  const tweets: TweetItem[] = [];
  
  // Try multiple separator patterns
  const patterns = [
    /(?:^|\n)(?:Tweet\s*\d+[:.]\s*|\d+[\/.)]\s*|---\s*\n)/gi,
    /\n{2,}/g, // Double newlines as fallback
  ];

  let parts: string[] = [];
  
  // Try numbered pattern first (1/, 2/, etc. or Tweet 1:, Tweet 2:, etc.)
  const numberedPattern = /(?:^|\n)(?:Tweet\s*\d+[:.]\s*|\d+[\/.)]\s*)/gi;
  const numberedSplit = content.split(numberedPattern).filter(p => p.trim());
  
  if (numberedSplit.length >= 3) {
    parts = numberedSplit;
  } else {
    // Try separator pattern
    const separatorPattern = /\n---\s*\n/g;
    const separatorSplit = content.split(separatorPattern).filter(p => p.trim());
    
    if (separatorSplit.length >= 3) {
      parts = separatorSplit;
    } else {
      // Use paragraphs as fallback
      parts = content.split(/\n{2,}/).filter(p => p.trim() && p.length > 20);
    }
  }

  parts.forEach((part, index) => {
    const cleanedPart = part
      .replace(/^(?:Tweet\s*\d+[:.]\s*|\d+[\/.)]\s*)/i, '')
      .trim();
    
    if (cleanedPart.length >= 10 && cleanedPart.length <= 500) {
      tweets.push({
        id: `tweet-${index + 1}`,
        content: cleanedPart
      });
    }
  });

  return tweets.length >= 2 ? tweets : null;
}

// ============= Carousel Parsing =============

/**
 * Parse carousel content into individual slides
 */
export function parseCarouselFromContent(content: string): SlideItem[] | null {
  if (!content) return null;

  const slides: SlideItem[] = [];
  
  // Try to find slide markers
  const slidePatterns = [
    /(?:^|\n)(?:Slide\s*\d+[:.]\s*)/gi,
    /(?:^|\n)(?:\*\*Slide\s*\d+\*\*[:.]\s*)/gi,
    /(?:^|\n)(?:📍\s*|\[Slide\s*\d+\])/gi,
  ];

  let parts: string[] = [];
  
  for (const pattern of slidePatterns) {
    const split = content.split(pattern).filter(p => p.trim());
    if (split.length >= 5) {
      parts = split;
      break;
    }
  }

  // Fallback: use double newlines
  if (parts.length < 5) {
    parts = content.split(/\n{2,}/).filter(p => p.trim() && p.length > 10);
  }

  parts.forEach((part, index) => {
    const cleanedPart = part
      .replace(/^(?:Slide\s*\d+[:.]\s*|\*\*Slide\s*\d+\*\*[:.]\s*)/i, '')
      .trim();
    
    if (cleanedPart.length >= 5) {
      // Try to extract title (first line or bold text)
      const lines = cleanedPart.split('\n');
      let title: string | undefined;
      let slideContent = cleanedPart;
      
      const boldMatch = cleanedPart.match(/^\*\*([^*]+)\*\*/);
      if (boldMatch) {
        title = boldMatch[1];
        slideContent = cleanedPart.replace(/^\*\*[^*]+\*\*\s*/, '');
      } else if (lines[0].length < 60) {
        title = lines[0];
        slideContent = lines.slice(1).join('\n').trim();
      }

      slides.push({
        id: `slide-${index + 1}`,
        title,
        content: slideContent || title || ""
      });
    }
  });

  return slides.length >= 3 ? slides : null;
}

// ============= Image Distribution =============

/**
 * Distribute images among structured content items
 */
export function distributeImages<T extends { image?: string }>(
  items: T[],
  images: string[],
  maxPerItem: number = 1
): T[] {
  if (!images.length || !items.length) return items;

  const result = [...items];
  let imageIndex = 0;

  // For threads: first image on first tweet, distribute rest
  // For carousels: more even distribution
  for (let i = 0; i < result.length && imageIndex < images.length; i++) {
    if (i === 0 || (imageIndex < images.length && i % 2 === 0)) {
      result[i] = { ...result[i], image: images[imageIndex] };
      imageIndex++;
    }
  }

  return result;
}

// ============= Prompt Building =============

/**
 * Build enriched prompt for content generation
 */
export function buildEnrichedPrompt(params: {
  title: string;
  format: string;
  referenceContent?: string;
  additionalContext?: string;
  imageCount?: number;
}): string {
  const { title, format, referenceContent, additionalContext, imageCount } = params;
  
  const formatLabel = CONTENT_TYPE_LABELS[format] || "conteúdo";
  
  let prompt = `Crie um ${formatLabel} sobre: "${title}"`;

  if (additionalContext) {
    prompt += `\n\nInstruções adicionais: ${additionalContext}`;
  }

  if (referenceContent) {
    prompt += `\n\n---\n\n**MATERIAL DE REFERÊNCIA:**\n\n${referenceContent}`;
    prompt += `\n\n---\n\nUSE o material de referência acima como base principal para criar o conteúdo, extraindo os melhores insights e adaptando para o formato ${formatLabel}.`;
  }

  if (imageCount && imageCount > 0) {
    prompt += `\n\n📷 NOTA: ${imageCount} imagem(ns) disponível(is) para uso no conteúdo.`;
  }

  prompt += `\n\nIMPORTANTE:
- Siga rigorosamente as regras do formato ${formatLabel}
- Use o tom de voz e estilo do cliente
- Entregue o conteúdo 100% pronto para publicar
- Seja específico e evite generalidades`;

  return prompt;
}

// ============= Structured Content Parsing =============

/**
 * Parse generated content into structured format based on content type
 */
export function parseStructuredContent(
  content: string,
  format: string,
  images: string[] = []
): StructuredContent {
  const result: StructuredContent = {};

  if (format === 'thread') {
    const tweets = parseThreadFromContent(content);
    if (tweets) {
      result.thread_tweets = distributeImages(tweets, images);
    }
  }

  if (format === 'carousel') {
    const slides = parseCarouselFromContent(content);
    if (slides) {
      result.carousel_slides = distributeImages(slides, images);
    }
  }

  // Newsletter parsing (basic)
  if (format === 'newsletter') {
    const sections: { title: string; content: string }[] = [];
    const sectionPattern = /(?:^|\n)(?:##\s+|Seção\s*\d+[:.]\s*)/gi;
    const parts = content.split(sectionPattern).filter(p => p.trim());
    
    parts.forEach((part) => {
      const lines = part.split('\n');
      if (lines.length > 0) {
        sections.push({
          title: lines[0].trim(),
          content: lines.slice(1).join('\n').trim()
        });
      }
    });

    if (sections.length >= 2) {
      result.newsletter_sections = sections;
    }
  }

  return result;
}

// ============= Utility Functions =============

/**
 * Extract a title from content (first meaningful line)
 */
export function extractTitleFromContent(content: string, maxLength: number = 100): string {
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length > 0) {
    const firstLine = lines[0]
      .replace(/^#+\s*/, '')
      .replace(/^\*\*/, '')
      .replace(/\*\*$/, '')
      .trim();
    if (firstLine.length <= maxLength) return firstLine;
    return firstLine.substring(0, maxLength - 3) + "...";
  }
  return "Novo conteúdo";
}

/**
 * Get platform from content type
 */
export function getPlatformFromFormat(format: string): string | undefined {
  return PLATFORM_MAP[format];
}
