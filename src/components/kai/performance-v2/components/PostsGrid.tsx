import * as React from "react";
import { Eye, FileText, Heart, Image as ImageIcon, LayoutGrid, List, MessageCircle, Repeat2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";
import { PostTranscriptionDialog } from "./PostTranscriptionDialog";
import type { TranscriptionSource } from "@/hooks/usePostTranscription";
import { getNetworkBranding } from "@/lib/network-branding";

const INITIAL_PAGE_SIZE = 50;
const PAGE_SIZE_INCREMENT = 50;

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
  /** Habilita botão "Transcrição" em cada card. */
  clientId?: string;
  /** Origem dos posts pra chave UNIQUE da transcrição. Default: 'metricool' */
  transcriptionSource?: TranscriptionSource;
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

export type PostsGridViewMode = "grid" | "list";

export function PostsGrid({
  posts,
  network,
  loading,
  onClick,
  sortBy: initialSort = "recent",
  className,
  clientId,
  transcriptionSource = "metricool",
}: PostsGridProps) {
  const [sortBy, setSortBy] = React.useState<PostsGridSort>(initialSort);
  const [viewMode, setViewMode] = React.useState<PostsGridViewMode>("grid");
  const [visibleCount, setVisibleCount] = React.useState(INITIAL_PAGE_SIZE);

  React.useEffect(() => {
    setSortBy(initialSort);
  }, [initialSort]);

  // Reset paginação quando ordem mudar — top-N depende da sort
  React.useEffect(() => {
    setVisibleCount(INITIAL_PAGE_SIZE);
  }, [sortBy]);

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
  const branding = getNetworkBranding(network);
  const NetworkIcon = branding.icon;

  // Slice client-side. Pagina só quando passa de INITIAL_PAGE_SIZE.
  const needsPaging = sorted.length > INITIAL_PAGE_SIZE;
  const visible = needsPaging ? sorted.slice(0, visibleCount) : sorted;
  const remaining = sorted.length - visible.length;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground tabular-nums">
          {ptBR.format(safe.length)} {safe.length === 1 ? "post" : "posts"}
          {needsPaging && (
            <span className="ml-1 text-[10px] opacity-70">
              · mostrando {visible.length}
            </span>
          )}
        </span>
        <div className="flex items-center gap-2">
          {/* View mode toggle: grid (default) ou lista compacta */}
          <div className="flex rounded-md border bg-muted/30 overflow-hidden h-9">
            <Toggle
              size="sm"
              variant="default"
              pressed={viewMode === "grid"}
              onPressedChange={() => setViewMode("grid")}
              className="h-9 px-2 rounded-none data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              title="Modo grade"
              aria-label="Modo grade"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </Toggle>
            <Toggle
              size="sm"
              variant="default"
              pressed={viewMode === "list"}
              onPressedChange={() => setViewMode("list")}
              className="h-9 px-2 rounded-none data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              title="Modo lista"
              aria-label="Modo lista"
            >
              <List className="h-3.5 w-3.5" />
            </Toggle>
          </div>
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
      </div>

      {viewMode === "list" ? (
        <ListView
          posts={visible}
          network={network}
          branding={branding}
          NetworkIcon={NetworkIcon}
          sharesLabel={sharesLabel}
          onClick={onClick}
          clientId={clientId}
          transcriptionSource={transcriptionSource}
        />
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {visible.map((post) => {
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
                interactive &&
                  cn("cursor-pointer hover:shadow-md hover:ring-2", branding.ringColor),
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
                {/* Badge da rede no canto superior esquerdo (cor própria, ícone branco) */}
                <div
                  className={cn(
                    "absolute top-2 left-2 flex h-6 w-6 items-center justify-center rounded-md shadow-sm",
                    branding.bgGradient,
                  )}
                  title={branding.label}
                >
                  <NetworkIcon className={cn("h-3 w-3", branding.iconOnBgClass)} />
                </div>
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
                  <span
                    className={cn("inline-flex items-center gap-1", branding.textColor)}
                    title={sharesLabel}
                  >
                    <Repeat2 className="h-3.5 w-3.5" />
                    {fmtNum(post.shares)}
                  </span>
                  <span className="inline-flex items-center gap-1" title="Visualizações">
                    <Eye className="h-3.5 w-3.5" />
                    {fmtNum(getPostViews(post))}
                  </span>
                </div>

                {clientId ? (
                  <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                    <PostTranscriptionDialog
                      clientId={clientId}
                      post={post as any}
                      source={transcriptionSource}
                      network={String(network)}
                      trigger={
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-full justify-start gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                          type="button"
                        >
                          <FileText className="h-3 w-3" />
                          Transcrição
                        </Button>
                      }
                    />
                  </div>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
      )}

      {needsPaging && remaining > 0 && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE_INCREMENT)}
            className="text-xs"
          >
            Carregar mais ({remaining} restantes)
          </Button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// List view (modo compacto) — alternativa ao grid pra escanear muitos posts.
// ─────────────────────────────────────────────────────────────────────────────
interface ListViewProps {
  posts: MetricoolPost[];
  network: string;
  branding: ReturnType<typeof getNetworkBranding>;
  NetworkIcon: React.ComponentType<{ className?: string }>;
  sharesLabel: string;
  onClick?: (post: MetricoolPost) => void;
  clientId?: string;
  transcriptionSource?: TranscriptionSource;
}

function ListView({
  posts,
  network,
  branding,
  NetworkIcon,
  sharesLabel,
  onClick,
  clientId,
  transcriptionSource = "metricool",
}: ListViewProps) {
  return (
    <div className="rounded-md border divide-y overflow-hidden">
      {posts.map((post) => {
        const caption = getPostCaption(post);
        const thumb = getPostThumbnail(post);
        const url = getPostUrl(post);
        const interactive = Boolean(onClick) || Boolean(url);
        const date = post.publishedAt || post.date;
        const eng = post.engagementRate ?? null;

        const handleClick = () => {
          if (onClick) {
            onClick(post);
            return;
          }
          if (url) window.open(url, "_blank", "noopener,noreferrer");
        };

        return (
          <div
            key={String(post.id)}
            role={interactive ? "button" : undefined}
            tabIndex={interactive ? 0 : undefined}
            onClick={interactive ? handleClick : undefined}
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
              "flex items-center gap-3 p-2.5 transition-colors",
              interactive && "cursor-pointer hover:bg-muted/40",
            )}
          >
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
              <div
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-tl-md rounded-br-md",
                  branding.bgGradient,
                )}
                title={branding.label}
              >
                <NetworkIcon className={cn("h-2 w-2", branding.iconOnBgClass)} />
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">
                {caption || (
                  <span className="text-muted-foreground italic">Sem legenda</span>
                )}
              </p>
              <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
                <span className="inline-flex items-center gap-1" title="Curtidas">
                  <Heart className="h-3 w-3" />
                  {fmtNum(post.likes)}
                </span>
                <span className="inline-flex items-center gap-1" title="Comentários">
                  <MessageCircle className="h-3 w-3" />
                  {fmtNum(post.comments)}
                </span>
                <span className="inline-flex items-center gap-1" title={sharesLabel}>
                  <Repeat2 className="h-3 w-3" />
                  {fmtNum(post.shares)}
                </span>
                <span className="inline-flex items-center gap-1" title="Visualizações">
                  <Eye className="h-3 w-3" />
                  {fmtNum(getPostViews(post))}
                </span>
                {date && (
                  <span className="hidden sm:inline">
                    · {new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                  </span>
                )}
              </div>
            </div>

            {typeof eng === "number" && (
              <Badge
                variant={eng > 5 ? "approved" : "secondary"}
                className="shrink-0 tabular-nums"
              >
                {eng.toFixed(1)}%
              </Badge>
            )}

            {clientId && (
              <div
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                className="shrink-0"
              >
                <PostTranscriptionDialog
                  clientId={clientId}
                  post={post as any}
                  source={transcriptionSource}
                  network={String(network)}
                  trigger={
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                      type="button"
                      title="Transcrição"
                    >
                      <FileText className="h-3.5 w-3.5" />
                    </Button>
                  }
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default PostsGrid;
