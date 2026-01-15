import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Instagram, Twitter, Linkedin, FileText, Heart, MessageCircle, Share2, Eye, Star, ExternalLink, Copy, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { UnifiedContentItem } from "@/hooks/useUnifiedContent";
import { toast } from "sonner";

interface ContentPreviewDialogProps {
  item: UnifiedContentItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggleFavorite?: () => void;
  onAddToCanvas?: () => void;
}

const platformIcons = {
  instagram: Instagram,
  twitter: Twitter,
  linkedin: Linkedin,
  newsletter: FileText,
  content: FileText,
};

const platformColors = {
  instagram: "text-pink-500",
  twitter: "text-blue-400",
  linkedin: "text-blue-600",
  newsletter: "text-orange-500",
  content: "text-muted-foreground",
};

const platformLabels = {
  instagram: "Instagram",
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
  onAddToCanvas 
}: ContentPreviewDialogProps) {
  if (!item) return null;

  const Icon = platformIcons[item.platform];
  const formattedDate = format(new Date(item.posted_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  const handleCopy = () => {
    navigator.clipboard.writeText(item.content);
    toast.success("Conteúdo copiado!");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-lg bg-muted/50")}>
                <Icon className={cn("h-5 w-5", platformColors[item.platform])} />
              </div>
              <div>
                <DialogTitle className="text-lg">{platformLabels[item.platform]}</DialogTitle>
                <p className="text-sm text-muted-foreground">{formattedDate}</p>
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

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Thumbnail */}
          {item.thumbnail_url && (
            <div className="rounded-lg overflow-hidden border bg-muted/30 max-h-[300px]">
              <img
                src={item.thumbnail_url}
                alt={item.title}
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}

          {/* Content */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="pr-4">
              <h3 className="font-semibold mb-2">{item.title}</h3>
              <div className="text-sm whitespace-pre-wrap text-muted-foreground leading-relaxed">
                {item.content}
              </div>
            </div>
          </ScrollArea>

          {/* Metrics */}
          <div className="flex items-center gap-6 py-3 border-t text-sm">
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
          <div className="flex gap-2 pt-2 border-t">
            <Button variant="outline" className="flex-1 gap-2" onClick={handleCopy}>
              <Copy className="h-4 w-4" />
              Copiar texto
            </Button>
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
            {onAddToCanvas && (
              <Button 
                className="gap-2"
                onClick={() => {
                  onAddToCanvas();
                  onOpenChange(false);
                }}
              >
                Adicionar ao Canvas
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
