/**
 * Viral Hunter — descobre posts com maior engajamento do cliente atual
 * (cross-plataforma) e serve de inspiração pro KAI gerar novas ideias.
 *
 * MVP: puxa diretamente de `instagram_posts` / `linkedin_posts` / `twitter_posts`
 * ranqueados por engagement_rate. Não depende de scraper externo.
 *
 * Ações por card:
 *   - Ver post original (abre URL)
 *   - Usar no KAI (abre dialog com prompt pré-preenchido → chat KAI)
 *   - Copiar ângulo (texto pronto pra colar no chat)
 */

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Flame,
  RefreshCw,
  ExternalLink,
  Copy,
  Sparkles,
  Search,
  TrendingUp,
  BookmarkPlus,
  Zap,
  Award,
  CalendarRange,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Client } from "@/hooks/useClients";

type Platform = "instagram" | "linkedin" | "twitter" | "youtube";

interface ViralPost {
  id: string;
  platform: Platform;
  caption: string;
  url?: string;
  posted_at: string | null;
  likes: number;
  comments: number;
  engagement_rate: number;
  thumbnail_url?: string | null;
  post_type?: string | null;
}

interface ViralHunterTabProps {
  clientId: string;
  client: Client;
  onUseAsInspiration?: (prompt: string) => void;
}

const platformColors: Record<Platform, { bg: string; dot: string; label: string }> = {
  instagram: {
    bg: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
    dot: "bg-pink-500",
    label: "Instagram",
  },
  linkedin: {
    bg: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    dot: "bg-blue-600",
    label: "LinkedIn",
  },
  twitter: {
    bg: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
    dot: "bg-sky-500",
    label: "Twitter/X",
  },
  youtube: {
    bg: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    dot: "bg-red-600",
    label: "YouTube",
  },
};

function scoreColor(engagement: number): string {
  if (engagement >= 5) return "bg-emerald-500 text-white";
  if (engagement >= 3) return "bg-green-500 text-white";
  if (engagement >= 1.5) return "bg-yellow-500 text-white";
  return "bg-orange-400 text-white";
}

function daysAgo(dateStr: string | null): string {
  if (!dateStr) return "sem data";
  const diff = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diff < 1) return "hoje";
  if (diff === 1) return "ontem";
  if (diff < 7) return `${diff}d atrás`;
  if (diff < 30) return `${Math.floor(diff / 7)}sem atrás`;
  return `${Math.floor(diff / 30)}mes atrás`;
}

type PeriodFilter = "all" | "30" | "90" | "180";

const periodLabels: Record<PeriodFilter, string> = {
  all: "Todo período",
  "30": "Últimos 30d",
  "90": "Últimos 90d",
  "180": "Últimos 6m",
};

export const ViralHunterTab = ({
  clientId,
  client,
  onUseAsInspiration,
}: ViralHunterTabProps) => {
  const [platformFilter, setPlatformFilter] = useState<Platform | "all">("all");
  const [period, setPeriod] = useState<PeriodFilter>("all");
  const [search, setSearch] = useState("");

  const { data: posts = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ["viral-hunter", clientId],
    queryFn: async (): Promise<ViralPost[]> => {
      const results: ViralPost[] = [];

      // Instagram posts — coluna URL é `permalink` aqui
      const { data: iposts } = await supabase
        .from("instagram_posts")
        .select("id, caption, engagement_rate, likes, comments, posted_at, permalink, post_type, thumbnail_url")
        .eq("client_id", clientId)
        .not("engagement_rate", "is", null)
        .order("engagement_rate", { ascending: false })
        .limit(50);
      if (iposts) {
        for (const p of iposts as Array<{
          id: string;
          caption: string | null;
          engagement_rate: number | null;
          likes: number | null;
          comments: number | null;
          posted_at: string | null;
          permalink: string | null;
          post_type: string | null;
          thumbnail_url: string | null;
        }>) {
          results.push({
            id: `ig_${p.id}`,
            platform: "instagram",
            caption: p.caption ?? "",
            url: p.permalink ?? undefined,
            posted_at: p.posted_at ?? null,
            likes: p.likes ?? 0,
            comments: p.comments ?? 0,
            engagement_rate: p.engagement_rate ?? 0,
            post_type: p.post_type ?? null,
            thumbnail_url: p.thumbnail_url ?? null,
          });
        }
      }

      // LinkedIn posts — coluna URL é `post_url` aqui
      const { data: lposts } = await supabase
        .from("linkedin_posts")
        .select("id, content, engagement_rate, likes, comments, posted_at, post_url")
        .eq("client_id", clientId)
        .not("engagement_rate", "is", null)
        .order("engagement_rate", { ascending: false })
        .limit(50);
      if (lposts) {
        for (const p of lposts as Array<{
          id: string;
          content: string | null;
          engagement_rate: number | null;
          likes: number | null;
          comments: number | null;
          posted_at: string | null;
          post_url: string | null;
        }>) {
          results.push({
            id: `li_${p.id}`,
            platform: "linkedin",
            caption: p.content ?? "",
            url: p.post_url ?? undefined,
            posted_at: p.posted_at ?? null,
            likes: p.likes ?? 0,
            comments: p.comments ?? 0,
            engagement_rate: p.engagement_rate ?? 0,
          });
        }
      }

      // Twitter posts (opcional — se a tabela existir)
      try {
        const { data: tposts } = await supabase
          // deno-lint-ignore no-explicit-any
          .from("twitter_posts" as any)
          .select("id, text, engagement_rate, likes, replies, posted_at, url")
          .eq("client_id", clientId)
          .not("engagement_rate", "is", null)
          .order("engagement_rate", { ascending: false })
          .limit(50);
        if (tposts) {
          for (const p of tposts as unknown as Array<{
            id: string;
            text?: string | null;
            engagement_rate?: number | null;
            likes?: number | null;
            replies?: number | null;
            posted_at?: string | null;
            url?: string | null;
          }>) {
            results.push({
              id: `tw_${p.id}`,
              platform: "twitter",
              caption: p.text ?? "",
              url: p.url ?? undefined,
              posted_at: p.posted_at ?? null,
              likes: p.likes ?? 0,
              comments: p.replies ?? 0,
              engagement_rate: p.engagement_rate ?? 0,
            });
          }
        }
      } catch {
        // tabela pode não existir em todos workspaces — ignora silenciosamente
      }

      // Ordena tudo por engagement_rate desc e limita a top 40
      results.sort((a, b) => b.engagement_rate - a.engagement_rate);
      return results.slice(0, 40);
    },
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000,
  });

  const filtered = useMemo(() => {
    const cutoff = period === "all"
      ? null
      : new Date(Date.now() - parseInt(period, 10) * 24 * 60 * 60 * 1000);
    return posts.filter((p) => {
      if (platformFilter !== "all" && p.platform !== platformFilter) return false;
      if (cutoff && p.posted_at) {
        if (new Date(p.posted_at) < cutoff) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!p.caption.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [posts, platformFilter, period, search]);

  // Quick stats: best, média, contagem no filtro
  const stats = useMemo(() => {
    if (filtered.length === 0) return null;
    const best = filtered[0]; // já ordenado por engagement desc
    const avg = filtered.reduce((acc, p) => acc + p.engagement_rate, 0) / filtered.length;
    const totalLikes = filtered.reduce((acc, p) => acc + p.likes, 0);
    return { best, avg, totalLikes };
  }, [filtered]);

  const handleSaveAsReference = async (post: ViralPost) => {
    const title = post.caption.slice(0, 80) || `Post viral ${post.platform}`;
    const referenceType = post.platform === "instagram"
      ? "post_com_imagem"
      : post.platform === "linkedin"
        ? "post_linkedin"
        : "tweet";
    const { error } = await supabase.from("client_reference_library").insert({
      client_id: clientId,
      title,
      content: post.caption,
      source_url: post.url ?? null,
      reference_type: referenceType,
      metadata: {
        engagement_rate: post.engagement_rate,
        likes: post.likes,
        comments: post.comments,
        platform: post.platform,
        posted_at: post.posted_at,
        source: "viral-hunter",
      },
    });
    if (error) {
      console.error("[ViralHunter] save as reference failed:", error);
      toast.error("Não foi possível salvar como referência.");
      return;
    }
    toast.success("Salvo na biblioteca de referências! ✨");
  };

  const handleCopyAngle = (post: ViralPost) => {
    const prompt = buildInspirationPrompt(post, client);
    navigator.clipboard.writeText(prompt);
    toast.success("Prompt copiado — cole no chat do KAI.");
  };

  const handleUseInKai = (post: ViralPost) => {
    const prompt = buildInspirationPrompt(post, client);
    if (onUseAsInspiration) {
      onUseAsInspiration(prompt);
      toast.success("Enviado pro KAI — ele vai criar algo similar.");
    } else {
      handleCopyAngle(post);
    }
  };

  const platformCounts = useMemo(() => {
    const counts: Record<string, number> = { all: posts.length };
    for (const p of posts) counts[p.platform] = (counts[p.platform] ?? 0) + 1;
    return counts;
  }, [posts]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="border-b border-border/30 bg-background/60 backdrop-blur-sm px-6 py-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
            <Flame className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Viral Hunter</h2>
            <p className="text-xs text-muted-foreground">
              Posts de maior engajamento de <span className="font-medium">{client.name}</span> — use como inspiração pra novos conteúdos.
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="gap-2"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Filters row 1 — plataforma + período */}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar no texto do post..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-8 text-sm"
            />
          </div>
          <PlatformChip
            platform="all"
            active={platformFilter === "all"}
            count={platformCounts.all ?? 0}
            onClick={() => setPlatformFilter("all")}
          />
          {(["instagram", "linkedin", "twitter", "youtube"] as Platform[]).map((p) =>
            platformCounts[p] ? (
              <PlatformChip
                key={p}
                platform={p}
                active={platformFilter === p}
                count={platformCounts[p] ?? 0}
                onClick={() => setPlatformFilter(p)}
              />
            ) : null,
          )}
        </div>

        {/* Filters row 2 — período */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <CalendarRange className="h-3.5 w-3.5 text-muted-foreground" />
          {(Object.keys(periodLabels) as PeriodFilter[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "text-xs px-2.5 py-1 rounded-full border transition-all",
                period === p
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-muted border-border text-muted-foreground",
              )}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Quick stats bar */}
      {stats && (
        <div className="border-b border-border/20 bg-muted/20 px-6 py-3">
          <div className="flex items-center gap-6 text-xs overflow-x-auto">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-emerald-100 dark:bg-emerald-900/30">
                <Award className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Melhor post</p>
                <p className="font-semibold">{stats.best.engagement_rate.toFixed(1)}% eng</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-blue-100 dark:bg-blue-900/30">
                <TrendingUp className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Média</p>
                <p className="font-semibold">{stats.avg.toFixed(1)}% eng</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-amber-100 dark:bg-amber-900/30">
                <Zap className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total de likes</p>
                <p className="font-semibold">{stats.totalLikes.toLocaleString("pt-BR")}</p>
              </div>
            </div>
            <div className="ml-auto text-muted-foreground">
              {filtered.length} posts · ordenados por engajamento
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState hasAny={posts.length > 0} clientName={client.name} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((post) => (
              <ViralCard
                key={post.id}
                post={post}
                onUseInKai={handleUseInKai}
                onCopyAngle={handleCopyAngle}
                onSaveAsReference={handleSaveAsReference}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Subcomponents ───────────────────────────────────────────────────────

function buildInspirationPrompt(post: ViralPost, client: Client): string {
  const platformLabel = platformColors[post.platform].label;
  const snippet = post.caption.slice(0, 280);
  return [
    `Crie um novo post inspirado neste conteúdo do ${client.name} que teve ${post.engagement_rate.toFixed(1)}% de engajamento no ${platformLabel}:`,
    "",
    `"${snippet}${post.caption.length > 280 ? "..." : ""}"`,
    "",
    "Mantenha o ângulo e o tom que funcionaram, mas traga um tema atual ou uma perspectiva nova. Gere o post completo pronto pra publicar.",
  ].join("\n");
}

interface PlatformChipProps {
  platform: Platform | "all";
  active: boolean;
  count: number;
  onClick: () => void;
}

function PlatformChip({ platform, active, count, onClick }: PlatformChipProps) {
  const label = platform === "all" ? "Todos" : platformColors[platform as Platform].label;
  const dotColor = platform === "all" ? "bg-muted-foreground" : platformColors[platform as Platform].dot;
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all border",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background hover:bg-muted border-border text-muted-foreground",
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", dotColor)} />
      {label}
      <span className="opacity-70">({count})</span>
    </button>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-card border border-border/40 rounded-xl p-4 space-y-3 animate-pulse">
      <div className="flex gap-2">
        <div className="h-5 w-14 bg-muted rounded" />
        <div className="h-5 w-20 bg-muted rounded" />
      </div>
      <div className="h-4 bg-muted rounded w-full" />
      <div className="h-4 bg-muted rounded w-5/6" />
      <div className="h-3 bg-muted/60 rounded w-2/3 mt-4" />
      <div className="flex gap-2 pt-3">
        <div className="h-7 flex-1 bg-muted rounded" />
        <div className="h-7 w-20 bg-muted rounded" />
      </div>
    </div>
  );
}

interface ViralCardProps {
  post: ViralPost;
  onUseInKai: (post: ViralPost) => void;
  onCopyAngle: (post: ViralPost) => void;
  onSaveAsReference: (post: ViralPost) => void;
}

function ViralCard({ post, onUseInKai, onCopyAngle, onSaveAsReference }: ViralCardProps) {
  const cfg = platformColors[post.platform];
  return (
    <div className="bg-card border border-border/50 rounded-xl shadow-sm hover:shadow-md transition-all p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={cn(
            "text-xs font-bold px-2 py-0.5 rounded-full",
            scoreColor(post.engagement_rate),
          )}
          title="Taxa de engajamento"
        >
          {post.engagement_rate.toFixed(1)}%
        </span>
        <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", cfg.bg)}>
          {cfg.label}
        </span>
        {post.post_type && (
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {post.post_type}
          </span>
        )}
        <span className="ml-auto text-xs text-muted-foreground">{daysAgo(post.posted_at)}</span>
      </div>

      {/* Thumbnail */}
      {post.thumbnail_url && (
        <div className="aspect-video rounded-lg bg-muted overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.thumbnail_url}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      {/* Caption */}
      <p className="text-sm leading-relaxed line-clamp-5 whitespace-pre-wrap">
        {post.caption || <span className="italic text-muted-foreground">(sem legenda)</span>}
      </p>

      {/* Stats */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground border-t border-border/40 pt-2">
        <span className="flex items-center gap-1">
          <TrendingUp className="h-3 w-3" />
          {post.likes.toLocaleString("pt-BR")} likes
        </span>
        <span>{post.comments.toLocaleString("pt-BR")} coments</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 pt-1">
        <Button
          variant="default"
          size="sm"
          className="h-8 text-xs gap-1.5 flex-1 bg-orange-600 hover:bg-orange-700 text-white"
          onClick={() => onUseInKai(post)}
          title="Criar conteúdo inspirado neste post"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Usar no KAI
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => onSaveAsReference(post)}
          title="Salvar como referência"
        >
          <BookmarkPlus className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => onCopyAngle(post)}
          title="Copiar prompt"
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
        {post.url && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => window.open(post.url, "_blank")}
            title="Abrir post original"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

function EmptyState({ hasAny, clientName }: { hasAny: boolean; clientName: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center max-w-md mx-auto gap-4">
      <div className="p-4 rounded-full bg-muted">
        <Flame className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold">
        {hasAny ? "Nada corresponde aos filtros" : "Nenhum post importado ainda"}
      </h3>
      <p className="text-sm text-muted-foreground">
        {hasAny
          ? "Ajuste os filtros ou a busca pra ver mais."
          : `Importe posts do ${clientName} pela aba Performance (Instagram, LinkedIn, etc.) pra eles aparecerem aqui ordenados por engajamento.`}
      </p>
    </div>
  );
}
