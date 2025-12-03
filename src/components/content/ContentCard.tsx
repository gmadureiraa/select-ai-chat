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

export const ContentCard = ({ content, onEdit, onDelete, onView }: ContentCardProps) => {
  const config = contentTypeConfig[content.content_type] || contentTypeConfig.other;
  const Icon = config.icon;
  const label = getContentTypeLabel(content.content_type);

  return (
    <Card className="group cursor-pointer hover:border-primary/50 transition-all" onClick={() => onView(content)}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${config.color}`}>
              <Icon className="h-4 w-4" />
            </div>
            <Badge variant="secondary" className="text-xs">
              {label}
            </Badge>
          </div>
        </div>
        <CardTitle className="text-lg mt-2">{content.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-3">
          {content.content}
        </p>
      </CardContent>
      <CardFooter className="flex justify-between items-center pt-4 border-t">
        <span className="text-xs text-muted-foreground">
          {new Date(content.created_at).toLocaleDateString("pt-BR")}
        </span>
        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(content);
            }}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(content.id);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};
