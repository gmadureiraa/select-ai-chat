import * as React from "react";
import { Eye, Heart, Image as ImageIcon, MessageCircle, Trophy, Filter, FileText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { PostTranscriptionDialog } from "./PostTranscriptionDialog";
import type { TranscriptionSource } from "@/hooks/usePostTranscription";

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

/**
 * Tipo de post normalizado pra filtro. Metricool retorna `type` em formato
 * variável (string `image` | `video` | `carousel` | `reel` | `story` etc).
 * `all` desabilita o filtro.
 */
export type LeaderboardKind = "all" | "post" | "reel" | "story" | "carousel";

function classifyKind(post: MetricoolPost): Exclude<LeaderboardKind, "all"> {
  const raw = String(post.type ?? "").toLowerCase();
  if (raw.includes("reel")) return "reel";
  if (raw.includes("story") || raw.includes("storie")) return "story";
  if (raw.includes("carousel") || raw.includes("album") || raw.includes("multi")) return "carousel";
  return "post";
}

export interface PostsLeaderboardProps {
  posts: MetricoolPost[];
  network: SocialNetwork | string;
  loading?: boolean;
  metric?: LeaderboardMetric;
  className?: string;
  /**
   * Habilita botão "Transcrição" no item — abre PostTranscriptionDialog.
   * Sem clientId não renderiza (consistente com PostsGrid).
   */
  clientId?: string;
  transcriptionSource?: TranscriptionSource;
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
  clientId,
  transcriptionSource = "metricool",
}: PostsLeaderboardProps) {
  const [metric, setMetric] = React.useState<LeaderboardMetric>(initialMetric);
  const [kindFilter, setKindFilter] = React.useState<LeaderboardKind>("all");
  const [minEngStr, setMinEngStr] = React.useState<string>("");
  const branding = getNetworkBranding(network);

  React.useEffect(() => {
    setMetric(initialMetric);
  }, [initialMetric]);

  // Detecta se algum post tem `type` informado — se NÃO, esconde filtro de tipo
  // (tipos vazios ficam todos como "post", filtro vira ruído).
  const hasTypeInfo = React.useMemo(
    () => Array.isArray(posts) && posts.some((p) => p.type && String(p.type).length > 0),
    [posts],
  );

  // Min eng filter: parse seguro, vazio = sem filtro
  const minEng = minEngStr.trim() === "" ? null : Number(minEngStr.replace(",", "."));
  const minEngValid = minEng !== null && Number.isFinite(minEng);

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
  // Aplica filtros antes de ordenar.
  const filtered = safe.filter((p) => {
    if (kindFilter !== "all") {
      if (classifyKind(p) !== kindFilter) return false;
    }
    if (minEngValid && minEng !== null) {
      // Filtro por engagement rate quando disponível, senão por score absoluto.
      const eng = typeof p.engagementRate === "number" ? p.engagementRate : null;
      if (eng !== null) {
        if (eng < minEng) return false;
      } else {
        // Sem engagementRate → cai pra score absoluto (menos ideal mas evita esconder tudo)
        if (getPostEngagementScore(p) < minEng) return false;
      }
    }
    return true;
  });
  const sorted = [...filtered].sort((a, b) => metricValue(b, metric) - metricValue(a, metric));
  const top5 = sorted.slice(0, 5);
  const filtersActive = kindFilter !== "all" || minEngValid;
  const filteredOutCount = safe.length - filtered.length;

  return (
    <Card className={className}>
      <CardHeader className="flex flex-col gap-2 p-4 space-y-0">
        <div className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="inline-flex items-center gap-2 text-base font-semibold">
            <Trophy className="h-4 w-4" style={{ color: branding.primaryHex }} />
            Top 5 posts
            {filtersActive && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                {filtered.length} filtrados
              </Badge>
            )}
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
        </div>

        {/* Linha de filtros: tipo + engajamento mínimo */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Filter className="h-3 w-3 text-muted-foreground" />
          {hasTypeInfo && (
            <Select value={kindFilter} onValueChange={(v) => setKindFilter(v as LeaderboardKind)}>
              <SelectTrigger className="h-7 w-[120px] text-[11px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="post">Posts</SelectItem>
                <SelectItem value="reel">Reels</SelectItem>
                <SelectItem value="story">Stories</SelectItem>
                <SelectItem value="carousel">Carrosséis</SelectItem>
              </SelectContent>
            </Select>
          )}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground">Eng% min</span>
            <Input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              placeholder="—"
              value={minEngStr}
              onChange={(e) => setMinEngStr(e.target.value)}
              className="h-7 w-20 text-[11px] tabular-nums"
            />
          </div>
          {filtersActive && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[10px] text-muted-foreground"
              onClick={() => {
                setKindFilter("all");
                setMinEngStr("");
              }}
            >
              Limpar
            </Button>
          )}
          {filtersActive && filteredOutCount > 0 && (
            <span className="text-[10px] text-muted-foreground tabular-nums">
              ({filteredOutCount} ocultos)
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-0">
        {top5.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            {filtersActive
              ? "Nenhum post bateu os filtros. Tenta afrouxar o engajamento mínimo ou trocar o tipo."
              : "Sem posts pra ranquear ainda."}
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

                  {/* Botão transcrição inline — só renderiza se clientId presente.
                      stopPropagation evita que clicar no botão dispare o
                      handler do <li> que abre o post externo. */}
                  {clientId && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
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
                            className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-foreground"
                            type="button"
                            title="Transcrição"
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </Button>
                        }
                      />
                    </div>
                  )}
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
