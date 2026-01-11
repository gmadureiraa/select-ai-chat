import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ContentItem } from "@/hooks/useContentLibrary";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Copy, FileText, Video, Link as LinkIcon, Image as ImageIcon, ExternalLink } from "lucide-react";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { supabase } from "@/integrations/supabase/client";

// Helper to get image URL from storage path or external URL
function getImageUrl(urlOrPath: string): string {
  if (!urlOrPath) return '';
  if (urlOrPath.startsWith('http')) return urlOrPath;
  // It's a storage path, convert to public URL
  const { data } = supabase.storage.from('client-files').getPublicUrl(urlOrPath);
  return data.publicUrl;
}

interface AttachedItem {
  id: string;
  type: 'link' | 'youtube' | 'pdf' | 'image' | 'video';
  url: string;
  name?: string;
  thumbnailUrl?: string;
}

const getAttachmentIcon = (type: AttachedItem['type']) => {
  switch (type) {
    case 'link': return <LinkIcon className="h-4 w-4" />;
    case 'youtube': return <Video className="h-4 w-4 text-red-500" />;
    case 'pdf': return <FileText className="h-4 w-4 text-orange-500" />;
    case 'image': return <ImageIcon className="h-4 w-4 text-blue-500" />;
    case 'video': return <Video className="h-4 w-4 text-purple-500" />;
  }
};

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

  const attachments = (content.metadata as Record<string, unknown>)?.attachments as AttachedItem[] | undefined;

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
            {/* Show thumbnail only if no attachments exist */}
            {(!attachments || attachments.length === 0) && content.thumbnail_url && (
              <img
                src={content.thumbnail_url}
                alt={content.title}
                className="w-full rounded-lg border"
              />
            )}
            {content.content_url && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground mb-2">Link do conteúdo:</p>
                <a 
                  href={content.content_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline break-all"
                >
                  {content.content_url}
                </a>
              </div>
            )}
            <div className="whitespace-pre-wrap text-sm text-foreground/90">
              {content.content}
            </div>

            {/* Attachments Section */}
            {attachments && attachments.length > 0 && (
              <div className="space-y-3 pt-4 border-t">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Anexos ({attachments.length})
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {attachments.map((item) => (
                    <div 
                      key={item.id} 
                      className="border rounded-lg p-2 bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      {item.type === 'image' ? (
                        <a href={getImageUrl(item.url)} target="_blank" rel="noopener noreferrer" className="block">
                          <img 
                            src={getImageUrl(item.url)} 
                            alt={item.name || 'Imagem'} 
                            className="w-full h-24 object-cover rounded mb-1"
                          />
                          <span className="text-xs text-muted-foreground truncate block">
                            {item.name || 'Imagem'}
                          </span>
                        </a>
                      ) : (
                        <a 
                          href={getImageUrl(item.url)} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-primary hover:underline"
                        >
                          {getAttachmentIcon(item.type)}
                          <span className="truncate flex-1">{item.name || item.url.substring(0, 30)}</span>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
        <div className="text-xs text-muted-foreground border-t pt-4">
          Criado em {new Date(content.created_at).toLocaleString("pt-BR")}
        </div>
      </DialogContent>
    </Dialog>
  );
};
