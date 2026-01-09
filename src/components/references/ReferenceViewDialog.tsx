import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ReferenceItem } from "@/hooks/useReferenceLibrary";
import { ExternalLink, FileText, Link, Video, Image as ImageIcon } from "lucide-react";
import { getPublicUrl } from "@/lib/storage";

interface AttachedItem {
  id: string;
  type: 'link' | 'youtube' | 'pdf' | 'image' | 'video';
  url: string;
  name?: string;
  thumbnailUrl?: string;
}

const getAttachmentIcon = (type: AttachedItem['type']) => {
  switch (type) {
    case 'link': return <Link className="h-4 w-4" />;
    case 'youtube': return <Video className="h-4 w-4 text-red-500" />;
    case 'pdf': return <FileText className="h-4 w-4 text-orange-500" />;
    case 'image': return <ImageIcon className="h-4 w-4 text-blue-500" />;
    case 'video': return <Video className="h-4 w-4 text-purple-500" />;
  }
};

interface ReferenceViewDialogProps {
  open: boolean;
  onClose: () => void;
  reference: ReferenceItem | null;
}

const REFERENCE_TYPE_LABELS: Record<string, string> = {
  tweet: "Tweet",
  thread: "Thread",
  carousel: "Carrossel",
  reel: "Reel",
  video: "Vídeo",
  article: "Artigo",
  other: "Outro"
};

export function ReferenceViewDialog({ open, onClose, reference }: ReferenceViewDialogProps) {
  if (!reference) return null;

  const metadata = (reference.metadata || {}) as any;
  
  // Get public URLs directly (no async, no expiration)
  const imageUrls = metadata.image_urls?.map((path: string) => getPublicUrl(path)) || [];
  const thumbnailUrl = reference.thumbnail_url ? getPublicUrl(reference.thumbnail_url) : null;
  const pdfUrl = metadata.pdf_url ? getPublicUrl(metadata.pdf_url) : null;
  
  const handleOpenPdf = (e: React.MouseEvent) => {
    e.preventDefault();
    if (pdfUrl) {
      window.open(pdfUrl, "_blank");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <DialogTitle className="text-xl">{reference.title}</DialogTitle>
            <Badge variant="outline">
              {REFERENCE_TYPE_LABELS[reference.reference_type] || reference.reference_type}
            </Badge>
          </div>
        </DialogHeader>
        <div className="space-y-4">
          {/* Attached files section */}
          {(metadata.scraped_url || metadata.pdf_url || reference.source_url) && (
            <div className="flex flex-wrap gap-3 p-3 bg-muted/30 rounded-lg">
              {metadata.scraped_url && (
                <a
                  href={metadata.scraped_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-2 bg-background px-3 py-1.5 rounded-md border"
                >
                  <Link className="h-4 w-4" />
                  Link original
                </a>
              )}
              {pdfUrl && (
                <button
                  onClick={handleOpenPdf}
                  className="text-sm text-primary hover:underline flex items-center gap-2 bg-background px-3 py-1.5 rounded-md border"
                >
                  <FileText className="h-4 w-4" />
                  {metadata.pdf_file_name || "Abrir PDF"}
                </button>
              )}
              {reference.source_url && reference.source_url !== metadata.scraped_url && (
                <a
                  href={reference.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-2 bg-background px-3 py-1.5 rounded-md border"
                >
                  <ExternalLink className="h-4 w-4" />
                  Fonte original
                </a>
              )}
            </div>
          )}
          
          {imageUrls.length > 0 && (
            <div className="space-y-2">
              {imageUrls.map((url: string, index: number) => (
                <img
                  key={index}
                  src={url}
                  alt={`${reference.title} - imagem ${index + 1}`}
                  className="w-full rounded-lg border"
                />
              ))}
            </div>
          )}
          {thumbnailUrl && imageUrls.length === 0 && (
            <div>
              <img
                src={thumbnailUrl}
                alt={reference.title}
                className="w-full rounded-lg"
              />
            </div>
          )}
          <div className="p-4 bg-muted/30 rounded-lg">
            <pre className="whitespace-pre-wrap text-sm font-mono">
              {reference.content}
            </pre>
          </div>

          {/* Attachments Section */}
          {metadata.attachments && Array.isArray(metadata.attachments) && metadata.attachments.length > 0 && (
            <div className="space-y-3 pt-4 border-t">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Anexos ({metadata.attachments.length})
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {(metadata.attachments as AttachedItem[]).map((item) => (
                  <div 
                    key={item.id} 
                    className="border rounded-lg p-2 bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    {item.type === 'image' ? (
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="block">
                        <img 
                          src={item.url} 
                          alt={item.name || 'Imagem'} 
                          className="w-full h-24 object-cover rounded mb-1"
                        />
                        <span className="text-xs text-muted-foreground truncate block">
                          {item.name || 'Imagem'}
                        </span>
                      </a>
                    ) : (
                      <a 
                        href={item.url} 
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

          <div className="text-xs text-muted-foreground pt-4 border-t">
            Adicionado em {new Date(reference.created_at).toLocaleDateString("pt-BR")}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
