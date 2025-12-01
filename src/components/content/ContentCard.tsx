import { ContentItem } from "@/hooks/useContentLibrary";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, FileText, Instagram, Video, Film, Globe, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ContentCardProps {
  content: ContentItem;
  onEdit: (content: ContentItem) => void;
  onDelete: (id: string) => void;
  onView: (content: ContentItem) => void;
}

const contentTypeConfig = {
  newsletter: { label: "Newsletter", icon: FileText, color: "bg-blue-500/10 text-blue-500" },
  carousel: { label: "Carrossel", icon: Instagram, color: "bg-pink-500/10 text-pink-500" },
  reel_script: { label: "Roteiro Reels", icon: Film, color: "bg-purple-500/10 text-purple-500" },
  video_script: { label: "Roteiro Vídeo", icon: Video, color: "bg-red-500/10 text-red-500" },
  blog_post: { label: "Post Blog", icon: Globe, color: "bg-green-500/10 text-green-500" },
  social_post: { label: "Post Social", icon: MessageSquare, color: "bg-cyan-500/10 text-cyan-500" },
  other: { label: "Outro", icon: FileText, color: "bg-gray-500/10 text-gray-500" },
};

export const ContentCard = ({ content, onEdit, onDelete, onView }: ContentCardProps) => {
  const config = contentTypeConfig[content.content_type];
  const Icon = config.icon;

  return (
    <Card className="group cursor-pointer hover:border-primary/50 transition-all" onClick={() => onView(content)}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${config.color}`}>
              <Icon className="h-4 w-4" />
            </div>
            <Badge variant="secondary" className="text-xs">
              {config.label}
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
