// Tipos de conteúdo padronizados para uso em Templates, Content Library e Reference Library
// Isso garante consistência e permite que a IA use a biblioteca do cliente como base

export const CONTENT_TYPES = {
  // Texto e Social
  tweet: { label: "Tweet", category: "social" },
  thread: { label: "Thread", category: "social" },
  x_article: { label: "Artigo no X", category: "social" },
  linkedin_post: { label: "Post LinkedIn", category: "social" },
  
  // Instagram
  carousel: { label: "Carrossel Instagram", category: "instagram" },
  stories: { label: "Stories", category: "instagram" },
  static_image: { label: "Estático Único", category: "instagram" },
  
  // Vídeo
  short_video: { label: "Vídeo Curto (Reels/TikTok)", category: "video" },
  long_video: { label: "Vídeo Longo", category: "video" },
  
  // Escrita Longa
  newsletter: { label: "Newsletter", category: "long_form" },
  blog_post: { label: "Blog Post", category: "long_form" },
  
  // Outros
  other: { label: "Outro", category: "other" },
} as const;

export type ContentTypeKey = keyof typeof CONTENT_TYPES;

// Array ordenado para uso nos selects
export const CONTENT_TYPE_OPTIONS: { value: ContentTypeKey; label: string; category: string }[] = [
  // Social
  { value: "tweet", label: "Tweet", category: "Social" },
  { value: "thread", label: "Thread", category: "Social" },
  { value: "x_article", label: "Artigo no X", category: "Social" },
  { value: "linkedin_post", label: "Post LinkedIn", category: "Social" },
  // Instagram
  { value: "carousel", label: "Carrossel Instagram", category: "Instagram" },
  { value: "stories", label: "Stories", category: "Instagram" },
  { value: "static_image", label: "Estático Único", category: "Instagram" },
  // Vídeo
  { value: "short_video", label: "Vídeo Curto (Reels/TikTok)", category: "Vídeo" },
  { value: "long_video", label: "Vídeo Longo", category: "Vídeo" },
  // Escrita Longa
  { value: "newsletter", label: "Newsletter", category: "Escrita" },
  { value: "blog_post", label: "Blog Post", category: "Escrita" },
  // Outros
  { value: "other", label: "Outro", category: "Outros" },
];

// Helper para obter o label de um tipo
export function getContentTypeLabel(type: string): string {
  return CONTENT_TYPES[type as ContentTypeKey]?.label || type;
}

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
  "Newsletter",
  "Carrossel Instagram",
  "Stories",
  "Tweet",
  "Thread",
  "Artigo no X",
  "Post LinkedIn",
  "Vídeo Curto",
  "Vídeo Longo",
  "Blog Post",
];
