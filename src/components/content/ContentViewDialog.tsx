import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ContentItem } from "@/hooks/useContentLibrary";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";

interface ContentViewDialogProps {
  open: boolean;
  onClose: () => void;
  content: ContentItem | null;
}

const contentTypeLabels = {
  newsletter: "Newsletter",
  carousel: "Carrossel Instagram",
  reel_script: "Roteiro Reels",
  video_script: "Roteiro Vídeo",
  blog_post: "Post de Blog",
  social_post: "Post Social",
  other: "Outro",
};

export const ContentViewDialog = ({ open, onClose, content }: ContentViewDialogProps) => {
  const { copyToClipboard } = useCopyToClipboard();

  if (!content) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <DialogTitle className="text-2xl">{content.title}</DialogTitle>
              <Badge variant="secondary">{contentTypeLabels[content.content_type]}</Badge>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(content.content)}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copiar
            </Button>
          </div>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 pr-4">
            {content.thumbnail_url && (
              <img
                src={content.thumbnail_url}
                alt={content.title}
                className="w-full rounded-lg border"
              />
            )}
            <div className="whitespace-pre-wrap text-sm text-foreground/90">
              {content.content}
            </div>
          </div>
        </ScrollArea>
        <div className="text-xs text-muted-foreground border-t pt-4">
          Criado em {new Date(content.created_at).toLocaleString("pt-BR")}
        </div>
      </DialogContent>
    </Dialog>
  );
};
