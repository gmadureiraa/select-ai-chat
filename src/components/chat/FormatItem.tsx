import { Mail, FileText, ScrollText, Image, Video, Mic, Sparkles, BookOpen, MessageSquare, Send, PenTool } from "lucide-react";

export interface FormatItem {
  id: string;
  name: string;
  type: "format";
  category: string;
  description: string;
  icon: React.ElementType;
}

export const contentFormats: FormatItem[] = [
  {
    id: "format_newsletter",
    name: "Newsletter",
    type: "format",
    category: "newsletter",
    description: "E-mail editorial com seções e CTAs",
    icon: Mail,
  },
  {
    id: "format_carrossel",
    name: "Carrossel",
    type: "format",
    category: "carousel",
    description: "Slides visuais para Instagram/LinkedIn",
    icon: Image,
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
    id: "format_reels",
    name: "Reels/Shorts",
    type: "format",
    category: "short_video",
    description: "Roteiro para vídeo vertical curto",
    icon: Video,
  },
  {
    id: "format_post_linkedin",
    name: "Post LinkedIn",
    type: "format",
    category: "linkedin_post",
    description: "Post profissional otimizado",
    icon: FileText,
  },
  {
    id: "format_post_instagram",
    name: "Post Instagram",
    type: "format",
    category: "instagram_post",
    description: "Legenda com hashtags otimizadas",
    icon: Send,
  },
  {
    id: "format_blog",
    name: "Blog Post",
    type: "format",
    category: "blog_post",
    description: "Artigo longo com SEO",
    icon: BookOpen,
  },
  {
    id: "format_tweet",
    name: "Tweet",
    type: "format",
    category: "tweet",
    description: "Post curto para Twitter/X",
    icon: MessageSquare,
  },
  {
    id: "format_script",
    name: "Roteiro",
    type: "format",
    category: "video_script",
    description: "Roteiro para vídeo longo",
    icon: PenTool,
  },
];
