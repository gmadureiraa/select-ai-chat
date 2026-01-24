import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Instagram, Youtube, MessageSquare, Linkedin, FileText, Heart, MessageCircle, 
  Share2, Eye, Star, ExternalLink, Copy, Download, ChevronLeft, ChevronRight, 
  Edit, Loader2, Images
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { UnifiedContentItem } from "@/hooks/useUnifiedContent";
import { toast } from "sonner";
import JSZip from "jszip";

interface ContentPreviewDialogProps {
  item: UnifiedContentItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggleFavorite?: () => void;
  onEdit?: () => void;
}

const platformIcons = {
  instagram: Instagram,
  youtube: Youtube,
  twitter: MessageSquare,
  linkedin: Linkedin,
  newsletter: FileText,
  content: FileText,
};

const platformColors = {
  instagram: "text-pink-500",
  youtube: "text-red-500",
  twitter: "text-blue-400",
  linkedin: "text-blue-600",
  newsletter: "text-orange-500",
  content: "text-muted-foreground",
};

const platformLabels = {
  instagram: "Instagram",
  youtube: "YouTube",
  twitter: "Twitter/X",
  linkedin: "LinkedIn",
  newsletter: "Newsletter",
  content: "Conteúdo",
};

export function ContentPreviewDialog({ 
  item, 
  open, 
  onOpenChange,
  onToggleFavorite,
  onEdit
}: ContentPreviewDialogProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);

  if (!item) return null;

  const Icon = platformIcons[item.platform] ?? FileText;
  const formattedDate = format(new Date(item.posted_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  
  // Get all images - use images array if available, otherwise use thumbnail
  const images = item.images || (item.thumbnail_url ? [item.thumbnail_url] : []);

  const handleCopy = () => {
    navigator.clipboard.writeText(item.content);
    toast.success("Conteúdo copiado!");
  };

  const handlePrevImage = () => {
    setCurrentImageIndex(prev => prev > 0 ? prev - 1 : images.length - 1);
  };

  const handleNextImage = () => {
    setCurrentImageIndex(prev => prev < images.length - 1 ? prev + 1 : 0);
  };

  // Download single image
  const downloadImage = async (url: string, filename: string) => {
    setIsDownloading(true);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch image');
      
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      
      toast.success('Imagem baixada!');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Erro ao baixar imagem');
    } finally {
      setIsDownloading(false);
    }
  };

  // Download all images as ZIP
  const downloadAllImages = async () => {
    if (images.length === 0) return;
    
    setIsDownloadingAll(true);
    try {
      const zip = new JSZip();
      
      for (let i = 0; i < images.length; i++) {
        try {
          const response = await fetch(images[i]);
          if (!response.ok) continue;
          
          const blob = await response.blob();
          const ext = blob.type.includes('png') ? 'png' : 'jpg';
          zip.file(`imagem-${i + 1}.${ext}`, blob);
        } catch (err) {
          console.error(`Error fetching image ${i}:`, err);
        }
      }
      
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const blobUrl = URL.createObjectURL(zipBlob);
      
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${item.title.substring(0, 30)}-imagens.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      
      toast.success(`${images.length} imagens baixadas!`);
    } catch (error) {
      console.error('Download all error:', error);
      toast.error('Erro ao baixar imagens');
    } finally {
      setIsDownloadingAll(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0 pb-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-lg bg-muted/50")}>
                <Icon className={cn("h-5 w-5", platformColors[item.platform])} />
              </div>
              <div>
                <DialogTitle className="text-lg">{platformLabels[item.platform]}</DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  {formattedDate}
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {item.engagement_rate && (
                <Badge variant="secondary" className="gap-1">
                  <Eye className="h-3 w-3" />
                  {item.engagement_rate.toFixed(2)}% eng
                </Badge>
              )}
              {item.is_favorite && (
                <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col gap-4 py-4 overflow-hidden">
          {/* Image Gallery */}
          {images.length > 0 && (
            <div className="relative rounded-lg overflow-hidden border bg-muted/30 flex-shrink-0">
              <div className="aspect-square max-h-[300px] flex items-center justify-center">
                <img
                  src={images[currentImageIndex]}
                  alt={`${item.title} - Imagem ${currentImageIndex + 1}`}
                  className="max-w-full max-h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
              
              {/* Navigation arrows */}
              {images.length > 1 && (
                <>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/80 hover:bg-background"
                    onClick={handlePrevImage}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/80 hover:bg-background"
                    onClick={handleNextImage}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  
                  {/* Image counter */}
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-background/80 rounded-full px-3 py-1">
                    <Images className="h-3 w-3" />
                    <span className="text-xs font-medium">{currentImageIndex + 1} / {images.length}</span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Content */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="pr-4">
              <h3 className="font-semibold text-lg mb-3">{item.title}</h3>
              <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-headings:mt-4 prose-headings:mb-2 prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-img:rounded-lg prose-img:my-3 prose-img:max-w-full prose-blockquote:border-l-primary prose-blockquote:bg-muted/50 prose-blockquote:py-1 prose-blockquote:px-3">
                <ReactMarkdown>{item.content}</ReactMarkdown>
              </div>
            </div>
          </ScrollArea>

          {/* Metrics */}
          <div className="flex items-center gap-6 py-3 border-t text-sm flex-shrink-0">
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-red-500" />
              <span className="font-medium">{item.metrics.likes.toLocaleString()}</span>
              <span className="text-muted-foreground">curtidas</span>
            </div>
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-blue-500" />
              <span className="font-medium">{item.metrics.comments.toLocaleString()}</span>
              <span className="text-muted-foreground">comentários</span>
            </div>
            <div className="flex items-center gap-2">
              <Share2 className="h-4 w-4 text-green-500" />
              <span className="font-medium">{item.metrics.shares.toLocaleString()}</span>
              <span className="text-muted-foreground">compartilhamentos</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-2 border-t flex-shrink-0">
            <Button variant="outline" className="gap-2" onClick={handleCopy}>
              <Copy className="h-4 w-4" />
              Copiar texto
            </Button>
            
            {/* Download buttons */}
            {images.length > 0 && (
              <>
                <Button 
                  variant="outline" 
                  className="gap-2"
                  onClick={() => downloadImage(images[currentImageIndex], `imagem-${currentImageIndex + 1}.jpg`)}
                  disabled={isDownloading}
                >
                  {isDownloading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Baixar imagem
                </Button>
                
                {images.length > 1 && (
                  <Button 
                    variant="outline" 
                    className="gap-2"
                    onClick={downloadAllImages}
                    disabled={isDownloadingAll}
                  >
                    {isDownloadingAll ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Images className="h-4 w-4" />
                    )}
                    Baixar todas ({images.length})
                  </Button>
                )}
              </>
            )}
            
            {onToggleFavorite && (
              <Button 
                variant="outline" 
                className="gap-2"
                onClick={onToggleFavorite}
              >
                <Star className={cn("h-4 w-4", item.is_favorite && "fill-yellow-400 text-yellow-400")} />
                {item.is_favorite ? 'Remover favorito' : 'Favoritar'}
              </Button>
            )}
            
            {item.permalink && (
              <Button 
                variant="outline" 
                className="gap-2"
                onClick={() => window.open(item.permalink, '_blank')}
              >
                <ExternalLink className="h-4 w-4" />
                Ver original
              </Button>
            )}
            
            {onEdit && (
              <Button 
                className="gap-2 ml-auto"
                onClick={onEdit}
              >
                <Edit className="h-4 w-4" />
                Editar
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
