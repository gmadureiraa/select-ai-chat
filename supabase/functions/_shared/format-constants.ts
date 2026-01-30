/**
 * Shared format constants for edge functions
 * Single source of truth for content type labels, format maps, and platform mappings
 */

// Content type to AI format mapping
export const FORMAT_MAP: Record<string, string> = {
  'tweet': 'tweet',
  'thread': 'thread',
  'x_article': 'linkedin',
  'linkedin_post': 'linkedin',
  'carousel': 'carousel',
  'stories': 'stories',
  'instagram_post': 'post',
  'static_image': 'post',
  'short_video': 'reels',
  'long_video': 'reels',
  'newsletter': 'newsletter',
  'blog_post': 'newsletter',
  'case_study': 'newsletter',
  'report': 'newsletter',
  'document': 'post',
  'social_post': 'post', // Legacy
  'other': 'post',
};

// Content type to platform mapping
export const PLATFORM_MAP: Record<string, string> = {
  'tweet': 'twitter',
  'thread': 'twitter',
  'x_article': 'twitter',
  'linkedin_post': 'linkedin',
  'carousel': 'instagram',
  'stories': 'instagram',
  'instagram_post': 'instagram',
  'static_image': 'instagram',
  'short_video': 'tiktok',
  'long_video': 'youtube',
  'newsletter': 'newsletter',
  'blog_post': 'blog',
  'email_marketing': 'email',
};

// Content type labels for enriched prompts (Portuguese)
export const CONTENT_TYPE_LABELS: Record<string, string> = {
  'tweet': 'Tweet (máx 280 caracteres)',
  'thread': 'Thread Twitter (5-10 tweets conectados)',
  'x_article': 'Artigo no X (conteúdo longo e profundo)',
  'linkedin_post': 'Post LinkedIn (profissional e informativo)',
  'carousel': 'Carrossel Instagram (8-10 slides visuais)',
  'stories': 'Stories (5-7 stories sequenciais)',
  'instagram_post': 'Post Instagram (legenda + visual impactante)',
  'static_image': 'Post Estático (visual único com legenda)',
  'short_video': 'Roteiro Reels/TikTok (30-60 segundos)',
  'long_video': 'Roteiro Vídeo Longo (5-15 minutos)',
  'newsletter': 'Newsletter (estruturada com seções)',
  'blog_post': 'Blog Post (SEO-otimizado)',
  'case_study': 'Estudo de Caso (análise detalhada)',
  'report': 'Relatório (dados e insights)',
  'email_marketing': 'Email Marketing (persuasivo)',
  'social_post': 'Post Social (genérico)',
  'other': 'Conteúdo',
};

// Map from detected PT format to database doc_key (EN) - used for kai_documentation
export const FORMAT_KEY_MAP: Record<string, string> = {
  "carrossel": "carousel",
  "post_instagram": "instagram_post",
  "linkedin": "linkedin_post",
  "artigo": "x_article",
  "blog": "blog_post",
  "email": "email_marketing",
  "newsletter": "newsletter",
  "thread": "thread",
  "stories": "stories",
  "reels": "short_video",
  "tweet": "tweet",
};

// Map from detected PT format to database content_type - used for client_content_library
export const CONTENT_TYPE_MAP: Record<string, string> = {
  "carrossel": "carousel",
  "post_instagram": "instagram_post",
  "linkedin": "linkedin_post",
  "artigo": "x_article",
  "blog": "blog_post",
  "email": "newsletter", // email maps to newsletter type
  "newsletter": "newsletter",
  "thread": "thread",
  "stories": "stories",
  "reels": "short_video",
  "tweet": "tweet",
};

// Content format keywords for detection (Portuguese)
export const CONTENT_FORMAT_KEYWORDS: Record<string, string[]> = {
  carrossel: ["carrossel", "carousel", "carrosel"],
  newsletter: ["newsletter", "news letter"],
  post_instagram: ["post", "postagem"],
  reels: ["reels", "reel", "vídeo curto"],
  thread: ["thread", "fio"],
  linkedin: ["linkedin", "linked in"],
  stories: ["stories", "story"],
  tweet: ["tweet", "tuíte"],
  artigo: ["artigo", "article", "artigo x"],
  blog: ["blog", "blog post"],
  email: ["email marketing", "email", "e-mail marketing"],
};

/**
 * Get format label for a content type
 */
export function getFormatLabel(contentType: string): string {
  return CONTENT_TYPE_LABELS[contentType] || CONTENT_TYPE_LABELS['other'];
}

/**
 * Get AI format for a content type
 */
export function getAIFormat(contentType: string): string {
  return FORMAT_MAP[contentType] || 'post';
}

/**
 * Get platform for a content type
 */
export function getPlatform(contentType: string): string | undefined {
  return PLATFORM_MAP[contentType];
}

/**
 * Detect format from Portuguese keywords
 */
export function detectFormatFromKeywords(text: string): string | null {
  const lowerText = text.toLowerCase();
  
  for (const [format, keywords] of Object.entries(CONTENT_FORMAT_KEYWORDS)) {
    if (keywords.some(k => lowerText.includes(k))) {
      return format;
    }
  }
  
  return null;
}
