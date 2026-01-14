import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Heart,
  MessageCircle,
  Repeat2,
  Eye,
  TrendingUp,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  MousePointer,
  Link2,
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
import { TwitterPost } from "@/types/twitter";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TwitterPostContentDialogProps {
  post: TwitterPost | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const getStorageUrl = (path: string) => {
  const { data } = supabase.storage.from("client-files").getPublicUrl(path);
  return data.publicUrl;
};

const MetricCard = ({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number | null | undefined;
  color?: string;
}) => (
  <div className="flex flex-col items-center p-3 bg-muted/50 rounded-lg">
    <Icon className={`h-4 w-4 mb-1 ${color || "text-muted-foreground"}`} />
    <span className="text-lg font-semibold">
      {value != null ? value.toLocaleString("pt-BR") : "-"}
    </span>
    <span className="text-xs text-muted-foreground">{label}</span>
  </div>
);

export function TwitterPostContentDialog({
  post,
  open,
  onOpenChange,
}: TwitterPostContentDialogProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  if (!post) return null;

  // Get images from storage paths or external URLs
  const images: string[] = [];
  if (post.images && Array.isArray(post.images) && post.images.length > 0) {
    post.images.forEach((path) => {
      if (typeof path === "string") {
        // Check if it's a full URL or a storage path
        if (path.startsWith("http")) {
          images.push(path);
        } else {
          images.push(getStorageUrl(path));
        }
      }
    });
  }

  const hasMultipleImages = images.length > 1;

  const handlePrevImage = () => {
    setCurrentImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNextImage = () => {
    setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const copyContent = async () => {
    const textToCopy = post.full_content || post.content;
    if (textToCopy) {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      toast.success("Texto copiado!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const tweetUrl = post.tweet_id
    ? `https://twitter.com/i/web/status/${post.tweet_id}`
    : null;

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
                  : "Tweet"}
              </DialogTitle>
              <Badge variant="secondary" className="text-xs bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300">
                Tweet
              </Badge>
              {post.content_synced_at && (
                <Badge variant="outline" className="text-xs text-emerald-600">
                  <Check className="h-3 w-3 mr-1" />
                  Sincronizado
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-80px)]">
          <div className="p-4 pt-2 space-y-4">
            {/* Image Gallery */}
            {images.length > 0 && (
              <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
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

            {/* Main Metrics Grid */}
            <div className="grid grid-cols-4 gap-2">
              <MetricCard icon={Eye} label="Views" value={post.impressions} />
              <MetricCard icon={Heart} label="Likes" value={post.likes} color="text-rose-500" />
              <MetricCard icon={Repeat2} label="Retweets" value={post.retweets} color="text-emerald-500" />
              <MetricCard icon={MessageCircle} label="Replies" value={post.replies} color="text-sky-500" />
            </div>

            {/* Secondary Metrics */}
            <div className="grid grid-cols-4 gap-2">
              <MetricCard icon={MousePointer} label="Cliques Perfil" value={post.profile_clicks} />
              <MetricCard icon={Link2} label="Cliques URL" value={post.url_clicks} />
              <MetricCard icon={Eye} label="Media Views" value={post.media_views} />
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
                {(post.content || post.full_content) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs gap-1"
                    onClick={copyContent}
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
              ) : post.content ? (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {post.content}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Nenhum conteúdo disponível. Clique em editar para adicionar.
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              {tweetUrl && (
                <Button variant="outline" size="sm" className="gap-1" asChild>
                  <a
                    href={tweetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Abrir no Twitter
                  </a>
                </Button>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
