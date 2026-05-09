import * as React from "react";
import { Eye, Heart, Image as ImageIcon, MessageCircle, Trophy } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getNetworkBranding } from "@/lib/network-branding";

import {
  getPostCaption,
  getPostEngagementScore,
  getPostThumbnail,
  getPostUrl,
  getPostViews,
  type MetricoolPost,
  type SocialNetwork,
} from "./PostsGrid";

export type LeaderboardMetric = "engagement" | "reach" | "likes" | "comments";

export interface PostsLeaderboardProps {
  posts: MetricoolPost[];
  network: SocialNetwork | string;
  loading?: boolean;
  metric?: LeaderboardMetric;
  className?: string;
}

const ptBR = new Intl.NumberFormat("pt-BR");

function fmtNum(n: number | undefined): string {
  if (n === undefined || n === null || !Number.isFinite(n)) return "0";
  if (n >= 1000) {
    return new Intl.NumberFormat("pt-BR", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n);
  }
  return ptBR.format(n);
}

function metricValue(post: MetricoolPost, metric: LeaderboardMetric): number {
  switch (metric) {
    case "likes":
      return post.likes ?? 0;
    case "comments":
      return post.comments ?? 0;
    case "reach":
      return post.reach ?? getPostViews(post);
    case "engagement":
    default:
      return getPostEngagementScore(post);
  }
}

function metricLabel(metric: LeaderboardMetric): string {
  switch (metric) {
    case "likes":
      return "Curtidas";
    case "comments":
      return "Comentários";
    case "reach":
      return "Alcance";
    case "engagement":
    default:
      return "Engajamento";
  }
}

function metricBadge(metric: LeaderboardMetric, post: MetricoolPost): string {
  if (metric === "engagement" && typeof post.engagementRate === "number") {
    return `${post.engagementRate.toFixed(1)}%`;
  }
  return fmtNum(metricValue(post, metric));
}

export function PostsLeaderboard({
  posts,
  network,
  loading,
  metric: initialMetric = "engagement",
  className,
}: PostsLeaderboardProps) {
  const [metric, setMetric] = React.useState<LeaderboardMetric>(initialMetric);
  const branding = getNetworkBranding(network);

  React.useEffect(() => {
    setMetric(initialMetric);
  }, [initialMetric]);

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 p-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-9 w-36" />
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-md" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-6 w-14" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const safe = Array.isArray(posts) ? posts : [];
  const sorted = [...safe].sort((a, b) => metricValue(b, metric) - metricValue(a, metric));
  const top5 = sorted.slice(0, 5);

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 p-4">
        <CardTitle className="inline-flex items-center gap-2 text-base font-semibold">
          <Trophy className="h-4 w-4" style={{ color: branding.primaryHex }} />
          Top 5 posts
        </CardTitle>
        <Select value={metric} onValueChange={(v) => setMetric(v as LeaderboardMetric)}>
          <SelectTrigger className="h-9 w-[150px] text-xs">
            <SelectValue placeholder="Métrica" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="engagement">Engajamento</SelectItem>
            <SelectItem value="reach">Alcance</SelectItem>
            <SelectItem value="likes">Curtidas</SelectItem>
            <SelectItem value="comments">Comentários</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>

      <CardContent className="p-4 pt-0">
        {top5.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Sem posts pra ranquear ainda.
          </div>
        ) : (
          <ol className="space-y-2">
            {top5.map((post, idx) => {
              const caption = getPostCaption(post);
              const thumb = getPostThumbnail(post);
              const url = getPostUrl(post);
              const isClickable = Boolean(url);

              const handleClick = () => {
                if (url) window.open(url, "_blank", "noopener,noreferrer");
              };

              return (
                <li
                  key={String(post.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-md p-2 transition-colors",
                    isClickable &&
                      cn("cursor-pointer hover:bg-muted/50 hover:ring-1", branding.ringColor),
                  )}
                  onClick={isClickable ? handleClick : undefined}
                  role={isClickable ? "button" : undefined}
                  tabIndex={isClickable ? 0 : undefined}
                  onKeyDown={
                    isClickable
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleClick();
                          }
                        }
                      : undefined
                  }
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums",
                      idx === 0 ? branding.iconOnBgClass : "bg-muted text-foreground",
                    )}
                    style={idx === 0 ? { backgroundColor: branding.primaryHex } : undefined}
                  >
                    {idx + 1}
                  </span>

                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
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
                        <ImageIcon className="h-4 w-4" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      {caption || (
                        <span className="text-muted-foreground italic">Sem legenda</span>
                      )}
                    </p>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <Heart className="h-3 w-3" />
                        {fmtNum(post.likes)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MessageCircle className="h-3 w-3" />
                        {fmtNum(post.comments)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {fmtNum(getPostViews(post))}
                      </span>
                    </div>
                  </div>

                  <Badge
                    className={cn("shrink-0 tabular-nums font-semibold border-transparent", branding.iconOnBgClass)}
                    style={{ backgroundColor: branding.primaryHex }}
                    title={metricLabel(metric)}
                  >
                    {metricBadge(metric, post)}
                  </Badge>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

export default PostsLeaderboard;
