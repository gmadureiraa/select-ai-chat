import { ExternalLink, Heart, MessageCircle, Eye, Bookmark, Share2, Flame } from "lucide-react";
import { InstagramPost } from "@/hooks/useInstagramPosts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface BestPostCardProps {
  post: InstagramPost;
}

export function BestPostCard({ post }: BestPostCardProps) {
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString('pt-BR');
  };

  const typeLabels: Record<string, string> = {
    carousel: "Carrossel",
    reel: "Reel",
    image: "Imagem",
    video: "Vídeo",
  };

  return (
    <div className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-medium">Melhor Post do Período</span>
          <Badge variant="secondary" className="ml-auto bg-amber-500/10 text-amber-500 border-0">
            Top Performance
          </Badge>
        </div>
      </div>

      <div className="p-4">
        <div className="flex gap-4">
          {/* Thumbnail */}
          {post.thumbnail_url ? (
            <img
              src={post.thumbnail_url}
              alt=""
              className="w-24 h-24 rounded-lg object-cover shrink-0"
            />
          ) : (
            <div className="w-24 h-24 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Eye className="h-8 w-8 text-muted-foreground" />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-xs">
                {typeLabels[post.post_type || 'image'] || post.post_type}
              </Badge>
              {post.engagement_rate && post.engagement_rate > 5 && (
                <Badge className="bg-emerald-500/10 text-emerald-500 border-0 text-xs">
                  {post.engagement_rate.toFixed(1)}% eng.
                </Badge>
              )}
            </div>

            <p className="text-sm line-clamp-2 text-muted-foreground mb-3">
              {post.caption || "Sem legenda"}
            </p>

            {/* Metrics row */}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <Heart className="h-3.5 w-3.5 text-rose-500" />
                <span className="font-medium">{formatNumber(post.likes || 0)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <MessageCircle className="h-3.5 w-3.5 text-blue-500" />
                <span className="font-medium">{formatNumber(post.comments || 0)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Share2 className="h-3.5 w-3.5 text-emerald-500" />
                <span className="font-medium">{formatNumber(post.shares || 0)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Bookmark className="h-3.5 w-3.5 text-amber-500" />
                <span className="font-medium">{formatNumber(post.saves || 0)}</span>
              </div>
            </div>
          </div>

          {/* External link */}
          {post.permalink && (
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 h-8 w-8"
              asChild
            >
              <a href={post.permalink} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
