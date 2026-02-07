/**
 * Format Detection Module
 * Detects content format from user input text using natural language patterns.
 * Used by chat input to show format chip and route to correct pipeline.
 */

export type DetectedFormat = {
  formatKey: string;
  formatLabel: string;
  platform: string;
  confidence: "high" | "medium" | "low";
};

interface FormatPattern {
  pattern: RegExp;
  formatKey: string;
  formatLabel: string;
  platform: string;
}

const FORMAT_PATTERNS: FormatPattern[] = [
  // LinkedIn
  { pattern: /\b(linkedin|linked\s*in)\b/i, formatKey: "linkedin_post", formatLabel: "LinkedIn", platform: "linkedin" },
  { pattern: /\b(post\s+corporativo|post\s+profissional)\b/i, formatKey: "linkedin_post", formatLabel: "LinkedIn", platform: "linkedin" },
  
  // Instagram
  { pattern: /\b(carrossel|carousel|carrosel)\b/i, formatKey: "carousel", formatLabel: "Carrossel", platform: "instagram" },
  { pattern: /\b(stor(y|ies)|stories)\b/i, formatKey: "stories", formatLabel: "Stories", platform: "instagram" },
  { pattern: /\b(reels?|reel)\b/i, formatKey: "short_video", formatLabel: "Reels", platform: "instagram" },
  { pattern: /\b(post\s+(estático|instagram|insta))\b/i, formatKey: "static_post", formatLabel: "Post Instagram", platform: "instagram" },
  { pattern: /\b(legenda\s+(para\s+)?(instagram|insta|post))\b/i, formatKey: "static_post", formatLabel: "Post Instagram", platform: "instagram" },
  
  // Twitter/X
  { pattern: /\b(tweet|twit)\b/i, formatKey: "tweet", formatLabel: "Tweet", platform: "twitter" },
  { pattern: /\b(thread|fio)\b/i, formatKey: "thread", formatLabel: "Thread", platform: "twitter" },
  { pattern: /\b(artigo\s+(no\s+)?(x|twitter))\b/i, formatKey: "x_article", formatLabel: "Artigo X", platform: "twitter" },
  
  // Email
  { pattern: /\b(newsletter|news\s*letter)\b/i, formatKey: "newsletter", formatLabel: "Newsletter", platform: "email" },
  { pattern: /\b(email\s+(de\s+)?(marketing|promocional|vendas))\b/i, formatKey: "email_marketing", formatLabel: "Email Marketing", platform: "email" },
  { pattern: /\b(email\s+(de\s+)?nutrição)\b/i, formatKey: "email_nurturing", formatLabel: "Email Nutrição", platform: "email" },
  
  // Blog
  { pattern: /\b(blog\s*post|post\s+(para\s+)?(o\s+)?blog)\b/i, formatKey: "blog_post", formatLabel: "Blog Post", platform: "blog" },
  { pattern: /\b(artigo\s+(para\s+)?(o\s+)?blog)\b/i, formatKey: "blog_post", formatLabel: "Blog Post", platform: "blog" },
  
  // Video
  { pattern: /\b(roteiro\s+(de\s+)?vídeo|script\s+(de\s+)?video)\b/i, formatKey: "long_video", formatLabel: "Roteiro Vídeo", platform: "video" },
  { pattern: /\b(vídeo\s+(longo|youtube))\b/i, formatKey: "long_video", formatLabel: "Roteiro Vídeo", platform: "video" },
  { pattern: /\b(shorts?|tiktok)\b/i, formatKey: "short_video", formatLabel: "Vídeo Curto", platform: "video" },
  
  // Generic content
  { pattern: /\b(conteúdo\s+(para\s+)?(linkedin))\b/i, formatKey: "linkedin_post", formatLabel: "LinkedIn", platform: "linkedin" },
  { pattern: /\b(conteúdo\s+(para\s+)?(instagram|insta))\b/i, formatKey: "static_post", formatLabel: "Post Instagram", platform: "instagram" },
  { pattern: /\b(conteúdo\s+(para\s+)?(twitter|x))\b/i, formatKey: "tweet", formatLabel: "Tweet", platform: "twitter" },
];

/**
 * Detects the content format from user input text.
 * Returns the detected format with confidence level, or null if no format detected.
 */
export function detectFormat(text: string): DetectedFormat | null {
  if (!text || text.length < 3) return null;
  
  const lowerText = text.toLowerCase();
  
  for (const { pattern, formatKey, formatLabel, platform } of FORMAT_PATTERNS) {
    if (pattern.test(lowerText)) {
      return {
        formatKey,
        formatLabel,
        platform,
        confidence: "high",
      };
    }
  }
  
  return null;
}

/**
 * Gets format options for the "Refazer como" dropdown.
 * Returns alternative formats the user can regenerate content as.
 */
export function getAlternativeFormats(currentFormat?: string): Array<{ key: string; label: string }> {
  const allFormats = [
    { key: "linkedin_post", label: "LinkedIn" },
    { key: "carousel", label: "Carrossel" },
    { key: "tweet", label: "Tweet" },
    { key: "thread", label: "Thread" },
    { key: "newsletter", label: "Newsletter" },
    { key: "stories", label: "Stories" },
    { key: "blog_post", label: "Blog Post" },
    { key: "email_marketing", label: "Email Marketing" },
    { key: "short_video", label: "Vídeo Curto" },
  ];
  
  // Filter out the current format
  if (currentFormat) {
    return allFormats.filter(f => f.key !== currentFormat);
  }
  
  return allFormats;
}

/**
 * Gets the platform icon name for a given format.
 */
export function getFormatPlatformIcon(platform: string): string {
  switch (platform) {
    case "linkedin": return "linkedin";
    case "instagram": return "instagram";
    case "twitter": return "twitter";
    case "email": return "mail";
    case "blog": return "file-text";
    case "video": return "video";
    default: return "file-text";
  }
}
