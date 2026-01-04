import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useFetchMentionItem } from "@/hooks/useMentionSearch";
import { Loader2, FileText, BookOpen, ExternalLink, Copy, Link } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface ReferencePopupProps {
  open: boolean;
  onClose: () => void;
  type: 'content' | 'reference';
  id: string;
}

const CONTENT_TYPE_LABELS: Record<string, string> = {
  post: 'Post',
  carousel: 'Carrossel',
  thread: 'Thread',
  video_script: 'Roteiro',
  newsletter: 'Newsletter',
  article: 'Artigo',
  story: 'Story',
  reel: 'Reel',
};

const REFERENCE_TYPE_LABELS: Record<string, string> = {
  tweet: 'Tweet',
  thread: 'Thread',
  video: 'Vídeo',
  newsletter: 'Newsletter',
  article: 'Artigo',
  image: 'Imagem',
  document: 'Documento',
  other: 'Outro',
};

export function ReferencePopup({ open, onClose, type, id }: ReferencePopupProps) {
  const { item, isLoading } = useFetchMentionItem(type, id);

  const handleCopy = () => {
    if (item?.content) {
      navigator.clipboard.writeText(item.content);
      toast.success('Conteúdo copiado');
    }
  };

  const handleOpenSource = () => {
    const url = item?.source_url || item?.content_url;
    if (url) {
      window.open(url, '_blank');
    }
  };

  const Icon = type === 'content' ? FileText : BookOpen;
  const typeLabel = type === 'content' 
    ? CONTENT_TYPE_LABELS[item?.content_type] || 'Conteúdo'
    : REFERENCE_TYPE_LABELS[item?.reference_type] || 'Referência';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${type === 'content' ? 'bg-primary/10' : 'bg-amber-500/10'}`}>
              <Icon className={`h-5 w-5 ${type === 'content' ? 'text-primary' : 'text-amber-600 dark:text-amber-400'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg leading-tight">
                {isLoading ? 'Carregando...' : item?.title || 'Sem título'}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-xs">
                  {typeLabel}
                </Badge>
                {(item?.source_url || item?.content_url) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs gap-1"
                    onClick={handleOpenSource}
                  >
                    <Link className="h-3 w-3" />
                    Abrir fonte
                  </Button>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : item ? (
          <ScrollArea className="flex-1 -mx-6 px-6">
            {/* Thumbnail */}
            {item.thumbnail_url && (
              <div className="mb-4">
                <img 
                  src={item.thumbnail_url} 
                  alt={item.title}
                  className="w-full max-h-48 object-cover rounded-lg"
                />
              </div>
            )}

            {/* Imagens do metadata */}
            {item.metadata?.image_urls && item.metadata.image_urls.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-muted-foreground mb-2">Imagens</p>
                <div className="flex gap-2 flex-wrap">
                  {item.metadata.image_urls.slice(0, 6).map((url: string, idx: number) => (
                    <img 
                      key={idx}
                      src={url} 
                      alt={`Imagem ${idx + 1}`}
                      className="w-20 h-20 object-cover rounded-md cursor-pointer hover:ring-2 ring-primary"
                      onClick={() => window.open(url, '_blank')}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Conteúdo */}
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>
                {item.content || '*Sem conteúdo*'}
              </ReactMarkdown>
            </div>
          </ScrollArea>
        ) : (
          <div className="py-12 text-center text-muted-foreground">
            <p>Não foi possível carregar o conteúdo</p>
          </div>
        )}

        {/* Footer */}
        {item && (
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" size="sm" onClick={handleCopy}>
              <Copy className="h-4 w-4 mr-1" />
              Copiar
            </Button>
            {(item.source_url || item.content_url) && (
              <Button variant="outline" size="sm" onClick={handleOpenSource}>
                <ExternalLink className="h-4 w-4 mr-1" />
                Abrir original
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
