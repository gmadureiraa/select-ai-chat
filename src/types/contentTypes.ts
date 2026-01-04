// Tipos de conteúdo padronizados para uso em Templates, Content Library e Reference Library
// Isso garante consistência e permite que a IA use a biblioteca do cliente como base

export const CONTENT_TYPES = {
  // Social - Twitter/X
  tweet: { label: "Tweet", category: "social" },
  thread: { label: "Thread", category: "social" },
  x_article: { label: "Artigo no X", category: "social" },
  
  // Social - LinkedIn
  linkedin_post: { label: "Post LinkedIn", category: "social" },
  
  // Social - Instagram
  carousel: { label: "Carrossel", category: "instagram" },
  stories: { label: "Stories", category: "instagram" },
  static_image: { label: "Estático Único", category: "instagram" },
  instagram_post: { label: "Post Instagram", category: "instagram" },
  
  // Video
  short_video: { label: "Vídeo Curto (Reels/TikTok)", category: "video" },
  long_video: { label: "Vídeo Longo", category: "video" },
  
  // Long-form
  newsletter: { label: "Newsletter", category: "long_form" },
  blog_post: { label: "Blog Post", category: "long_form" },
  
  // Other
  other: { label: "Outro", category: "other" },
} as const;

export type ContentTypeKey = keyof typeof CONTENT_TYPES;

// Array ordenado para uso nos selects - organized by category
export const CONTENT_TYPE_OPTIONS: { value: ContentTypeKey; label: string; category: string }[] = [
  // Social - Twitter/X
  { value: "tweet", label: "Tweet", category: "Twitter/X" },
  { value: "thread", label: "Thread", category: "Twitter/X" },
  { value: "x_article", label: "Artigo no X", category: "Twitter/X" },
  // Social - LinkedIn
  { value: "linkedin_post", label: "Post LinkedIn", category: "LinkedIn" },
  // Instagram
  { value: "carousel", label: "Carrossel", category: "Instagram" },
  { value: "stories", label: "Stories", category: "Instagram" },
  { value: "static_image", label: "Estático Único", category: "Instagram" },
  { value: "instagram_post", label: "Post Instagram", category: "Instagram" },
  // Video
  { value: "short_video", label: "Vídeo Curto (Reels/TikTok)", category: "Vídeo" },
  { value: "long_video", label: "Vídeo Longo", category: "Vídeo" },
  // Long-form
  { value: "newsletter", label: "Newsletter", category: "Escrita" },
  { value: "blog_post", label: "Blog Post", category: "Escrita" },
  // Other
  { value: "other", label: "Outro", category: "Outros" },
];

// Helper para obter o label de um tipo
export function getContentTypeLabel(type: string): string {
  return CONTENT_TYPES[type as ContentTypeKey]?.label || type;
}

// Mapeamento de content type para plataforma (para derivar automaticamente)
export const CONTENT_TO_PLATFORM: Record<ContentTypeKey, string> = {
  tweet: 'twitter',
  thread: 'twitter',
  x_article: 'twitter',
  linkedin_post: 'linkedin',
  carousel: 'instagram',
  stories: 'instagram',
  static_image: 'instagram',
  instagram_post: 'instagram',
  short_video: 'tiktok',
  long_video: 'youtube',
  newsletter: 'newsletter',
  blog_post: 'blog',
  other: 'other',
};

// Mapeamento de tipos antigos para novos (para migração de dados existentes)
export const LEGACY_TYPE_MAPPING: Record<string, ContentTypeKey> = {
  reel_script: "short_video",
  video_script: "long_video",
  social_post: "static_image",
  reel: "short_video",
  video: "long_video",
  article: "blog_post",
};

// Normaliza tipo antigo para novo
export function normalizeContentType(type: string): ContentTypeKey {
  if (type in CONTENT_TYPES) {
    return type as ContentTypeKey;
  }
  return LEGACY_TYPE_MAPPING[type] || "other";
}

// Sugestões de templates por categoria (para TemplateManager)
export const TEMPLATE_SUGGESTIONS = [
  "Tweet",
  "Thread",
  "Artigo no X",
  "Post LinkedIn",
  "Carrossel",
  "Stories",
  "Post Instagram",
  "Reels/Shorts",
  "Vídeo Longo",
  "Newsletter",
  "Blog Post",
];
