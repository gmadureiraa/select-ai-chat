import * as React from "react";
import { Eye, Heart, Image as ImageIcon, MessageCircle, Repeat2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface MetricoolPost {
  id: string | number;
  text?: string;
  content?: string;
  caption?: string;
  url?: string;
  permalink?: string;
  imageUrl?: string;
  thumbnail?: string;
  mediaUrl?: string;
  date?: string;
  publishedAt?: string;
  type?: string;
  likes?: number;
  comments?: number;
  shares?: number;
  reach?: number;
  impressions?: number;
  views?: number;
  videoViews?: number;
  engagementRate?: number;
}

export type PostsGridSort = "recent" | "engagement" | "reach";

export type SocialNetwork =
  | "instagram"
  | "facebook"
  | "twitter"
  | "linkedin"
  | "tiktok"
  | "youtube"
  | "threads"
  | "bluesky";

export interface PostsGridProps {
  posts: MetricoolPost[];
  network: SocialNetwork | string;
  loading?: boolean;
  onClick?: (post: MetricoolPost) => void;
  sortBy?: PostsGridSort;
  className?: string;
}

const ptBR = new Intl.NumberFormat("pt-BR");

function fmtNum(n: number | undefined): string {
  if (n === undefined || n === null || !Number.isFinite(n)) return "0";
  if (n >= 1000) {
    // Compact for large numbers but pt-BR friendly
    return new Intl.NumberFormat("pt-BR", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n);
  }
  return ptBR.format(n);
}

export function getPostCaption(post: MetricoolPost): string {
  return post.caption || post.text || post.content || "";
}

export function getPostThumbnail(post: MetricoolPost): string | undefined {
  return post.imageUrl || post.thumbnail || post.mediaUrl || undefined;
}

export function getPostUrl(post: MetricoolPost): string | undefined {
  return post.url || post.permalink || undefined;
}

export function getPostDate(post: MetricoolPost): number {
  const raw = post.publishedAt || post.date;
  if (!raw) return 0;
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? 0 : t;
}

export function getPostViews(post: MetricoolPost): number {
  return post.views ?? post.videoViews ?? post.impressions ?? 0;
}

export function getPostEngagementScore(post: MetricoolPost): number {
  if (typeof post.engagementRate === "number") return post.engagementRate;
  return (post.likes ?? 0) + (post.comments ?? 0) + (post.shares ?? 0);
}

function sortPosts(posts: MetricoolPost[], by: PostsGridSort): MetricoolPost[] {
  const arr = [...posts];
  if (by === "engagement") {
    arr.sort((a, b) => getPostEngagementScore(b) - getPostEngagementScore(a));
  } else if (by === "reach") {
    arr.sort((a, b) => (b.reach ?? getPostViews(b)) - (a.reach ?? getPostViews(a)));
  } else {
    arr.sort((a, b) => getPostDate(b) - getPostDate(a));
  }
  return arr;
}

const SHARES_LABEL: Record<string, string> = {
  twitter: "Retweets",
  threads: "Reposts",
  linkedin: "Compart.",
  facebook: "Compart.",
  instagram: "Compart.",
  tiktok: "Compart.",
  youtube: "Compart.",
  bluesky: "Reposts",
};

export function PostsGrid({
  posts,
  network,
  loading,
  onClick,
  sortBy: initialSort = "recent",
  className,
}: PostsGridProps) {
  const [sortBy, setSortBy] = React.useState<PostsGridSort>(initialSort);

  React.useEffect(() => {
    setSortBy(initialSort);
  }, [initialSort]);

  if (loading) {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="aspect-square w-full rounded-none" />
              <CardContent className="p-3 space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const safe = Array.isArray(posts) ? posts : [];

  if (safe.length === 0) {
    return (
      <div
        className={cn(
          "rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground",
          className,
        )}
      >
        Nenhum post no período. Aumente o range ou conecte mais plataformas.
      </div>
    );
  }

  const sorted = sortPosts(safe, sortBy);
  const sharesLabel = SHARES_LABEL[network] || "Compart.";

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground tabular-nums">
          {ptBR.format(safe.length)} {safe.length === 1 ? "post" : "posts"}
        </span>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as PostsGridSort)}>
          <SelectTrigger className="h-9 w-[160px] text-xs">
            <SelectValue placeholder="Ordenar por" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Mais recentes</SelectItem>
            <SelectItem value="engagement">Engajamento</SelectItem>
            <SelectItem value="reach">Alcance</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {sorted.map((post) => {
          const caption = getPostCaption(post);
          const thumb = getPostThumbnail(post);
          const url = getPostUrl(post);
          const eng = post.engagementRate ?? null;
          const showEngBadge = typeof eng === "number" && (eng > 5 || eng < 2);
          const engVariant = (eng ?? 0) > 5 ? "approved" : "secondary";

          const handleClick = () => {
            if (onClick) {
              onClick(post);
              return;
            }
            if (url) {
              window.open(url, "_blank", "noopener,noreferrer");
            }
          };

          const interactive = Boolean(onClick) || Boolean(url);

          return (
            <Card
              key={String(post.id)}
              onClick={interactive ? handleClick : undefined}
              role={interactive ? "button" : undefined}
              tabIndex={interactive ? 0 : undefined}
              onKeyDown={
                interactive
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleClick();
                      }
                    }
                  : undefined
              }
              className={cn(
                "overflow-hidden flex flex-col transition-all",
                interactive && "cursor-pointer hover:shadow-md hover:ring-2 hover:ring-primary/30",
              )}
            >
              <div className="relative aspect-square bg-muted overflow-hidden">
                {thumb ? (
                  <img
                    src={thumb}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <ImageIcon className="h-8 w-8" />
                  </div>
                )}
                {showEngBadge && (
                  <Badge
                    variant={engVariant as "approved" | "secondary"}
                    className="absolute top-2 right-2 tabular-nums"
                  >
                    {(eng as number).toFixed(1)}%
                  </Badge>
                )}
              </div>

              <CardContent className="p-3 space-y-2">
                <p className="text-sm line-clamp-2 min-h-[2.5rem]">
                  {caption || <span className="text-muted-foreground italic">Sem legenda</span>}
                </p>

                <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
                  <span className="inline-flex items-center gap-1" title="Curtidas">
                    <Heart className="h-3.5 w-3.5" />
                    {fmtNum(post.likes)}
                  </span>
                  <span className="inline-flex items-center gap-1" title="Comentários">
                    <MessageCircle className="h-3.5 w-3.5" />
                    {fmtNum(post.comments)}
                  </span>
                  <span className="inline-flex items-center gap-1" title={sharesLabel}>
                    <Repeat2 className="h-3.5 w-3.5" />
                    {fmtNum(post.shares)}
                  </span>
                  <span className="inline-flex items-center gap-1" title="Visualizações">
                    <Eye className="h-3.5 w-3.5" />
                    {fmtNum(getPostViews(post))}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default PostsGrid;
