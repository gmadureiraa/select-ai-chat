import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ReferenceItem } from "@/hooks/useReferenceLibrary";
import { ExternalLink, FileText, Link, Loader2 } from "lucide-react";
import { getSignedUrl } from "@/lib/storage";
import { openFileInNewTab } from "@/lib/storage";

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
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  useEffect(() => {
    if (!reference || !open) {
      setImageUrls([]);
      setThumbnailUrl(null);
      setPdfUrl(null);
      return;
    }
    
    const metadata = reference.metadata || {};
    setIsLoading(true);
    
    const loadUrls = async () => {
      // Load image URLs
      if (metadata.image_urls && Array.isArray(metadata.image_urls)) {
        const urls = await Promise.all(
          metadata.image_urls.map(async (path: string) => {
            if (path.startsWith("http")) return path;
            return getSignedUrl(path, 86400);
          })
        );
        setImageUrls(urls.filter(Boolean) as string[]);
      }
      
      // Load thumbnail
      if (reference.thumbnail_url) {
        if (reference.thumbnail_url.startsWith("http")) {
          setThumbnailUrl(reference.thumbnail_url);
        } else {
          const url = await getSignedUrl(reference.thumbnail_url, 86400);
          setThumbnailUrl(url);
        }
      }
      
      // Load PDF URL
      if (metadata.pdf_url) {
        if (metadata.pdf_url.startsWith("http")) {
          setPdfUrl(metadata.pdf_url);
        } else {
          const url = await getSignedUrl(metadata.pdf_url, 86400);
          setPdfUrl(url);
        }
      }
      
      setIsLoading(false);
    };
    
    loadUrls();
  }, [reference, open]);
  
  if (!reference) return null;

  const metadata = reference.metadata || {};
  
  const handleOpenPdf = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (metadata.pdf_url && !metadata.pdf_url.startsWith("http")) {
      // Use downloadAsBlob for paths
      await openFileInNewTab(metadata.pdf_url);
    } else if (pdfUrl) {
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
              {metadata.pdf_url && (
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
          
          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          
          {!isLoading && imageUrls.length > 0 && (
            <div className="space-y-2">
              {imageUrls.map((url, index) => (
                <img
                  key={index}
                  src={url}
                  alt={`${reference.title} - imagem ${index + 1}`}
                  className="w-full rounded-lg border"
                />
              ))}
            </div>
          )}
          {!isLoading && thumbnailUrl && imageUrls.length === 0 && (
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
          <div className="text-xs text-muted-foreground pt-4 border-t">
            Adicionado em {new Date(reference.created_at).toLocaleDateString("pt-BR")}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
