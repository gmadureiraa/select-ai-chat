import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Heart, MessageCircle, Bookmark, Share2, Eye, ExternalLink, Trophy } from "lucide-react";
import { InstagramPost } from "@/hooks/useInstagramPosts";

interface TopPostsGridProps {
  posts: InstagramPost[];
  maxItems?: number;
  selectedMetric?: string;
  onMetricChange?: (metric: string) => void;
}

const metricOptions = [
  { value: "engagement", label: "Engajamento" },
  { value: "reach", label: "Alcance" },
  { value: "likes", label: "Curtidas" },
  { value: "comments", label: "Comentários" },
  { value: "saves", label: "Salvamentos" },
  { value: "shares", label: "Compartilhamentos" },
];

const rankingColors = [
  { bg: "bg-amber-500", text: "text-amber-950", icon: "🥇" },
  { bg: "bg-slate-400", text: "text-slate-950", icon: "🥈" },
  { bg: "bg-amber-700", text: "text-amber-50", icon: "🥉" },
];

function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return "0";
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
}

function getMetricValue(post: InstagramPost, metric: string): number {
  switch (metric) {
    case "engagement":
      return post.engagement_rate || 0;
    case "reach":
      return post.reach || 0;
    case "likes":
      return post.likes || 0;
    case "comments":
      return post.comments || 0;
    case "saves":
      return post.saves || 0;
    case "shares":
      return post.shares || 0;
    default:
      return post.engagement_rate || 0;
  }
}

function getPostTypeLabel(type: string | null | undefined): string {
  switch (type?.toLowerCase()) {
    case "carousel":
    case "carousel_album":
      return "Carrossel";
    case "reel":
    case "reels":
      return "Reel";
    case "video":
      return "Vídeo";
    case "image":
      return "Imagem";
    default:
      return type || "Post";
  }
}

export function TopPostsGrid({
  posts,
  maxItems = 3,
  selectedMetric = "engagement",
  onMetricChange,
}: TopPostsGridProps) {
  const [metric, setMetric] = useState(selectedMetric);

  const handleMetricChange = (value: string) => {
    setMetric(value);
    onMetricChange?.(value);
  };

  const sortedPosts = [...posts]
    .sort((a, b) => getMetricValue(b, metric) - getMetricValue(a, metric))
    .slice(0, maxItems);

  if (sortedPosts.length === 0) {
    return null;
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-lg">Top {maxItems} Posts</CardTitle>
          </div>
          {onMetricChange && (
            <Select value={metric} onValueChange={handleMetricChange}>
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {metricOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {sortedPosts.map((post, index) => (
            <div
              key={post.id}
              className="group relative bg-muted/30 rounded-xl overflow-hidden border border-border/50 hover:border-primary/30 transition-all hover:shadow-lg"
            >
              {/* Image Container */}
              <div className="relative aspect-[4/5] overflow-hidden bg-muted">
                {post.thumbnail_url ? (
                  <img
                    src={post.thumbnail_url}
                    alt={post.caption?.slice(0, 50) || "Post"}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <Eye className="h-12 w-12 opacity-20" />
                  </div>
                )}
                
                {/* Ranking Badge */}
                <div
                  className={`absolute top-3 right-3 w-10 h-10 rounded-full ${rankingColors[index]?.bg || "bg-muted"} flex items-center justify-center text-lg font-bold shadow-lg`}
                >
                  {rankingColors[index]?.icon || index + 1}
                </div>

                {/* Type Badge */}
                <Badge 
                  variant="secondary" 
                  className="absolute bottom-3 left-3 bg-background/80 backdrop-blur-sm text-xs"
                >
                  {getPostTypeLabel(post.post_type)}
                </Badge>

                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>

              {/* Content */}
              <div className="p-4 space-y-3">
                {/* Caption */}
                <p className="text-sm text-foreground line-clamp-2 min-h-[2.5rem]">
                  {post.caption?.slice(0, 100) || "Sem legenda"}
                </p>

                {/* Metrics Grid */}
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="space-y-0.5">
                    <Heart className="h-3.5 w-3.5 mx-auto text-rose-500" />
                    <p className="text-xs font-medium">{formatNumber(post.likes)}</p>
                  </div>
                  <div className="space-y-0.5">
                    <MessageCircle className="h-3.5 w-3.5 mx-auto text-blue-500" />
                    <p className="text-xs font-medium">{formatNumber(post.comments)}</p>
                  </div>
                  <div className="space-y-0.5">
                    <Bookmark className="h-3.5 w-3.5 mx-auto text-amber-500" />
                    <p className="text-xs font-medium">{formatNumber(post.saves)}</p>
                  </div>
                  <div className="space-y-0.5">
                    <Share2 className="h-3.5 w-3.5 mx-auto text-emerald-500" />
                    <p className="text-xs font-medium">{formatNumber(post.shares)}</p>
                  </div>
                </div>

                {/* Reach & Engagement */}
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/50">
                  <div className="flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    <span>{formatNumber(post.reach)} alcance</span>
                  </div>
                  <span className="font-medium text-primary">
                    {(post.engagement_rate || 0).toFixed(2)}% eng.
                  </span>
                </div>

                {/* External Link */}
                {post.permalink && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-8 text-xs"
                    asChild
                  >
                    <a href={post.permalink} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3 mr-1.5" />
                      Ver no Instagram
                    </a>
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
