import { ContentItem } from "@/hooks/useContentLibrary";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, FileText, Instagram, Video, Film, Globe, MessageSquare, Smartphone, Image as ImageIcon, Play, Twitter, Linkedin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getContentTypeLabel } from "@/types/contentTypes";

interface ContentCardProps {
  content: ContentItem;
  onEdit: (content: ContentItem) => void;
  onDelete: (id: string) => void;
  onView: (content: ContentItem) => void;
}

const contentTypeConfig: Record<string, { icon: any; color: string }> = {
  newsletter: { icon: FileText, color: "bg-blue-500/10 text-blue-500" },
  carousel: { icon: Instagram, color: "bg-pink-500/10 text-pink-500" },
  stories: { icon: Smartphone, color: "bg-orange-500/10 text-orange-500" },
  static_image: { icon: ImageIcon, color: "bg-indigo-500/10 text-indigo-500" },
  short_video: { icon: Play, color: "bg-red-500/10 text-red-500" },
  long_video: { icon: Video, color: "bg-purple-500/10 text-purple-500" },
  tweet: { icon: Twitter, color: "bg-sky-500/10 text-sky-500" },
  thread: { icon: Twitter, color: "bg-sky-500/10 text-sky-500" },
  x_article: { icon: Twitter, color: "bg-sky-500/10 text-sky-500" },
  linkedin_post: { icon: Linkedin, color: "bg-blue-600/10 text-blue-600" },
  blog_post: { icon: Globe, color: "bg-green-500/10 text-green-500" },
  other: { icon: FileText, color: "bg-gray-500/10 text-gray-500" },
};

// Clean markdown and page separators from content for preview
const cleanContentForPreview = (text: string): string => {
  if (!text) return "";
  return text
    .replace(/---\s*(PÁGINA|SLIDE|PAGE)\s*\d+\s*---/gi, "") // Remove page separators
    .replace(/\*\*([^*]+)\*\*/g, "$1") // Remove bold markdown
    .replace(/\*([^*]+)\*/g, "$1") // Remove italic markdown
    .replace(/#{1,6}\s/g, "") // Remove headers
    .replace(/`([^`]+)`/g, "$1") // Remove inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Remove links, keep text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "") // Remove images
    .replace(/^\s*[-*+]\s/gm, "") // Remove list markers
    .replace(/^\s*\d+\.\s/gm, "") // Remove numbered list markers
    .replace(/\n{2,}/g, " ") // Replace multiple newlines with space
    .replace(/\n/g, " ") // Replace single newlines with space
    .trim();
};

export const ContentCard = ({ content, onEdit, onDelete, onView }: ContentCardProps) => {
  const config = contentTypeConfig[content.content_type] || contentTypeConfig.other;
  const Icon = config.icon;
  const label = getContentTypeLabel(content.content_type);
  const cleanedContent = cleanContentForPreview(content.content);

  return (
    <Card className="group cursor-pointer hover:border-primary/50 transition-all h-[220px] flex flex-col" onClick={() => onView(content)}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${config.color} shrink-0`}>
              <Icon className="h-3.5 w-3.5" />
            </div>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {label}
            </Badge>
          </div>
        </div>
        <CardTitle className="text-sm font-medium mt-1.5 line-clamp-2">{content.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 py-0">
        <p className="text-xs text-muted-foreground line-clamp-4">
          {cleanedContent}
        </p>
      </CardContent>
      <CardFooter className="flex justify-between items-center pt-3 pb-3 border-t mt-auto">
        <span className="text-[10px] text-muted-foreground">
          {new Date(content.created_at).toLocaleDateString("pt-BR")}
        </span>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(content);
            }}
          >
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(content.id);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};
