import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Eye,
  Users,
  TrendingUp,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { PostContentSyncButton } from "./PostContentSyncButton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface InstagramPost {
  id: string;
  client_id: string;
  post_id?: string | null;
  caption?: string | null;
  post_type?: string | null;
  permalink?: string | null;
  thumbnail_url?: string | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  saves?: number | null;
  reach?: number | null;
  impressions?: number | null;
  engagement_rate?: number | null;
  posted_at?: string | null;
  full_content?: string | null;
  images?: string[] | null;
  content_synced_at?: string | null;
  content_objective?: string | null;
  is_collab?: boolean | null;
}

interface PostContentDialogProps {
  post: InstagramPost | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const getStorageUrl = (path: string) => {
  const { data } = supabase.storage.from("instagram-images").getPublicUrl(path);
  return data.publicUrl;
};

const MetricCard = ({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: number | null | undefined;
}) => (
  <div className="flex flex-col items-center p-3 bg-muted/50 rounded-lg">
    <Icon className="h-4 w-4 text-muted-foreground mb-1" />
    <span className="text-lg font-semibold">
      {value != null ? value.toLocaleString("pt-BR") : "-"}
    </span>
    <span className="text-xs text-muted-foreground">{label}</span>
  </div>
);

export const PostContentDialog = ({
  post,
  open,
  onOpenChange,
}: PostContentDialogProps) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  if (!post) return null;

  // Get images from storage paths or fallback to thumbnail
  const images: string[] = [];
  if (post.images && Array.isArray(post.images) && post.images.length > 0) {
    post.images.forEach((path) => {
      if (typeof path === "string") {
        images.push(getStorageUrl(path));
      }
    });
  } else if (post.thumbnail_url) {
    images.push(post.thumbnail_url);
  }

  const hasMultipleImages = images.length > 1;

  const handlePrevImage = () => {
    setCurrentImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNextImage = () => {
    setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const copyCaption = async () => {
    if (post.caption) {
      await navigator.clipboard.writeText(post.caption);
      setCopied(true);
      toast.success("Legenda copiada!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getPostTypeLabel = (type: string | null | undefined) => {
    switch (type) {
      case "reel":
        return "Reels";
      case "carousel":
        return "Carrossel";
      case "image":
        return "Imagem";
      case "video":
        return "Vídeo";
      default:
        return type || "Post";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 gap-0">
        <DialogHeader className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DialogTitle className="text-lg">
                {post.posted_at
                  ? format(new Date(post.posted_at), "d 'de' MMMM, yyyy", {
                      locale: ptBR,
                    })
                  : "Post"}
              </DialogTitle>
              <Badge variant="secondary" className="text-xs">
                {getPostTypeLabel(post.post_type)}
              </Badge>
              {post.is_collab && (
                <Badge variant="outline" className="text-xs">
                  Collab
                </Badge>
              )}
            </div>
            <PostContentSyncButton
              postId={post.id}
              clientId={post.client_id}
              permalink={post.permalink}
              caption={post.caption}
              contentSyncedAt={post.content_synced_at || null}
            />
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-80px)]">
          <div className="p-4 pt-2 space-y-4">
            {/* Image Gallery */}
            {images.length > 0 && (
              <div className="relative aspect-square bg-muted rounded-lg overflow-hidden">
                <img
                  src={images[currentImageIndex]}
                  alt={`Imagem ${currentImageIndex + 1}`}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/placeholder.svg";
                  }}
                />

                {hasMultipleImages && (
                  <>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full opacity-80 hover:opacity-100"
                      onClick={handlePrevImage}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full opacity-80 hover:opacity-100"
                      onClick={handleNextImage}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                      {images.map((_, idx) => (
                        <button
                          key={idx}
                          className={`w-2 h-2 rounded-full transition-colors ${
                            idx === currentImageIndex
                              ? "bg-white"
                              : "bg-white/50"
                          }`}
                          onClick={() => setCurrentImageIndex(idx)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Metrics Grid */}
            <div className="grid grid-cols-4 gap-2">
              <MetricCard icon={Heart} label="Likes" value={post.likes} />
              <MetricCard
                icon={MessageCircle}
                label="Comentários"
                value={post.comments}
              />
              <MetricCard icon={Share2} label="Shares" value={post.shares} />
              <MetricCard icon={Bookmark} label="Salvos" value={post.saves} />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <MetricCard icon={Eye} label="Impressões" value={post.impressions} />
              <MetricCard icon={Users} label="Alcance" value={post.reach} />
              <MetricCard
                icon={TrendingUp}
                label="Engajamento"
                value={
                  post.engagement_rate != null
                    ? Math.round(post.engagement_rate * 100) / 100
                    : null
                }
              />
            </div>

            <Separator />

            {/* Content */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">Conteúdo</h4>
                {post.caption && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs gap-1"
                    onClick={copyCaption}
                  >
                    {copied ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    Copiar
                  </Button>
                )}
              </div>

              {post.full_content ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <div className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {post.full_content}
                  </div>
                </div>
              ) : post.caption ? (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {post.caption}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Nenhum conteúdo disponível. Clique em "Carregar" para
                  sincronizar.
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              {post.permalink && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  asChild
                >
                  <a
                    href={post.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Abrir no Instagram
                  </a>
                </Button>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
