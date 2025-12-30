import { Mail, FileText, ScrollText, Image, Video, Sparkles, BookOpen, MessageSquare, Send, PenTool, Lightbulb, ImageIcon, Newspaper } from "lucide-react";

export interface FormatItem {
  id: string;
  name: string;
  type: "format";
  category: string;
  description: string;
  icon: React.ElementType;
}

// All content formats - standardized across the app
export const contentFormats: FormatItem[] = [
  // Special actions
  {
    id: "format_ideias",
    name: "Ideias",
    type: "format",
    category: "ideias",
    description: "Gerar ideias criativas baseadas na biblioteca",
    icon: Lightbulb,
  },
  {
    id: "format_gerar_imagem",
    name: "Gerar Imagem",
    type: "format",
    category: "imagem",
    description: "Criar imagem com IA baseada no estilo do cliente",
    icon: Sparkles,
  },
  // Social - Twitter/X
  {
    id: "format_tweet",
    name: "Tweet",
    type: "format",
    category: "tweet",
    description: "Post curto para Twitter/X (280 caracteres)",
    icon: MessageSquare,
  },
  {
    id: "format_thread",
    name: "Thread",
    type: "format",
    category: "thread",
    description: "Série de tweets conectados",
    icon: ScrollText,
  },
  {
    id: "format_artigo_x",
    name: "Artigo no X",
    type: "format",
    category: "x_article",
    description: "Artigo longo publicado no Twitter/X",
    icon: Newspaper,
  },
  // Social - LinkedIn
  {
    id: "format_post_linkedin",
    name: "Post LinkedIn",
    type: "format",
    category: "linkedin_post",
    description: "Post profissional otimizado para LinkedIn",
    icon: FileText,
  },
  // Social - Instagram
  {
    id: "format_carrossel",
    name: "Carrossel",
    type: "format",
    category: "carousel",
    description: "Slides visuais para Instagram/LinkedIn",
    icon: Image,
  },
  {
    id: "format_stories",
    name: "Stories",
    type: "format",
    category: "stories",
    description: "Sequência de stories para Instagram",
    icon: Sparkles,
  },
  {
    id: "format_post_instagram",
    name: "Post Instagram",
    type: "format",
    category: "instagram_post",
    description: "Legenda para estático único com hashtags",
    icon: Send,
  },
  // Video
  {
    id: "format_reels",
    name: "Reels/Shorts",
    type: "format",
    category: "short_video",
    description: "Roteiro para vídeo vertical curto",
    icon: Video,
  },
  {
    id: "format_video_longo",
    name: "Vídeo Longo",
    type: "format",
    category: "long_video",
    description: "Roteiro para vídeo longo (YouTube, etc)",
    icon: PenTool,
  },
  // Long-form
  {
    id: "format_newsletter",
    name: "Newsletter",
    type: "format",
    category: "newsletter",
    description: "E-mail editorial com seções e CTAs",
    icon: Mail,
  },
  {
    id: "format_blog",
    name: "Blog Post",
    type: "format",
    category: "blog_post",
    description: "Artigo longo otimizado para SEO",
    icon: BookOpen,
  },
];

// Helper to get format by category
export const getFormatByCategory = (category: string): FormatItem | undefined => {
  return contentFormats.find(f => f.category === category);
};

// Helper to get format by id
export const getFormatById = (id: string): FormatItem | undefined => {
  return contentFormats.find(f => f.id === id);
};
