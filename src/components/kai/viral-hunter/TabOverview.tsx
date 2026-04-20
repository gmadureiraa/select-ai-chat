/**
 * Tab Overview — dashboard de visão geral do Viral Hunter.
 * Mostra os posts virais do PRÓPRIO cliente (reaproveita o ViralHunter anterior
 * com filtro por engajamento nas tabelas instagram_posts/linkedin_posts/etc).
 *
 * Essa tab substitui o conteúdo anterior do ViralHunterTab — fica como "meu
 * melhor conteúdo" enquanto as outras tabs focam em fontes externas.
 */

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Flame,
  RefreshCw,
  ExternalLink,
  Copy,
  Sparkles,
  BookmarkPlus,
  TrendingUp,
  Award,
  Zap,
  CalendarRange,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Client } from "@/hooks/useClients";

type Platform = "instagram" | "linkedin" | "twitter" | "youtube";
type PeriodFilter = "all" | "30" | "90" | "180";

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

const platformColors: Record<Platform, { bg: string; label: string }> = {
  instagram: { bg: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400", label: "Instagram" },
  linkedin: { bg: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", label: "LinkedIn" },
  twitter: { bg: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400", label: "X" },
  youtube: { bg: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", label: "YouTube" },
};

const periodLabels: Record<PeriodFilter, string> = {
  all: "Todo período",
  "30": "30d",
  "90": "90d",
  "180": "6m",
};

function scoreColor(r: number): string {
  if (r >= 5) return "bg-emerald-500 text-white";
  if (r >= 3) return "bg-green-500 text-white";
  if (r >= 1.5) return "bg-yellow-500 text-white";
  return "bg-orange-400 text-white";
}

function daysAgo(d: string | null): string {
  if (!d) return "—";
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
  if (diff < 1) return "hoje";
  if (diff === 1) return "ontem";
  if (diff < 7) return `${diff}d`;
  if (diff < 30) return `${Math.floor(diff / 7)}sem`;
  return `${Math.floor(diff / 30)}m`;
}

interface TabOverviewProps {
  clientId: string;
  client: Client;
  onUseAsInspiration: (prompt: string) => void;
}

export function TabOverview({ clientId, client, onUseAsInspiration }: TabOverviewProps) {
  const [period, setPeriod] = useState<PeriodFilter>("all");

  const { data: posts = [], isLoading, isFetching, refetch } = useQuery<ViralPost[]>({
    queryKey: ["viral-hunter-own-posts", clientId],
    queryFn: async () => {
      const results: ViralPost[] = [];

      const { data: iposts } = await supabase
        .from("instagram_posts")
        .select("id, caption, engagement_rate, likes, comments, posted_at, permalink, post_type, thumbnail_url")
        .eq("client_id", clientId)
        .not("engagement_rate", "is", null)
        .order("engagement_rate", { ascending: false })
        .limit(30);
      if (iposts) {
        for (const p of iposts as Array<{
          id: string; caption: string | null; engagement_rate: number | null;
          likes: number | null; comments: number | null; posted_at: string | null;
          permalink: string | null; post_type: string | null; thumbnail_url: string | null;
        }>) {
          results.push({
            id: `ig_${p.id}`, platform: "instagram", caption: p.caption ?? "",
            url: p.permalink ?? undefined, posted_at: p.posted_at,
            likes: p.likes ?? 0, comments: p.comments ?? 0,
            engagement_rate: p.engagement_rate ?? 0,
            post_type: p.post_type, thumbnail_url: p.thumbnail_url,
          });
        }
      }

      const { data: lposts } = await supabase
        .from("linkedin_posts")
        .select("id, content, engagement_rate, likes, comments, posted_at, post_url")
        .eq("client_id", clientId)
        .not("engagement_rate", "is", null)
        .order("engagement_rate", { ascending: false })
        .limit(30);
      if (lposts) {
        for (const p of lposts as Array<{
          id: string; content: string | null; engagement_rate: number | null;
          likes: number | null; comments: number | null; posted_at: string | null;
          post_url: string | null;
        }>) {
          results.push({
            id: `li_${p.id}`, platform: "linkedin", caption: p.content ?? "",
            url: p.post_url ?? undefined, posted_at: p.posted_at,
            likes: p.likes ?? 0, comments: p.comments ?? 0,
            engagement_rate: p.engagement_rate ?? 0,
          });
        }
      }

      results.sort((a, b) => b.engagement_rate - a.engagement_rate);
      return results.slice(0, 24);
    },
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000,
  });

  const filtered = useMemo(() => {
    const cutoff = period === "all" ? null : new Date(Date.now() - parseInt(period, 10) * 86_400_000);
    return posts.filter((p) => !cutoff || !p.posted_at || new Date(p.posted_at) >= cutoff);
  }, [posts, period]);

  const stats = useMemo(() => {
    if (filtered.length === 0) return null;
    return {
      best: filtered[0],
      avg: filtered.reduce((a, p) => a + p.engagement_rate, 0) / filtered.length,
      totalLikes: filtered.reduce((a, p) => a + p.likes, 0),
    };
  }, [filtered]);

  const handleUse = (post: ViralPost) => {
    const prompt = [
      `Crie um novo post inspirado neste conteúdo do ${client.name} que teve ${post.engagement_rate.toFixed(1)}% de engajamento no ${platformColors[post.platform].label}:`,
      "",
      `"${post.caption.slice(0, 280)}${post.caption.length > 280 ? "..." : ""}"`,
      "",
      "Mantenha o ângulo e tom que funcionaram, traga um tema atual ou uma perspectiva nova.",
    ].join("\n");
    onUseAsInspiration(prompt);
    toast.success("Enviado pro KAI — ele vai criar algo similar.");
  };

  const handleCopy = (post: ViralPost) => {
    navigator.clipboard.writeText(post.caption);
    toast.success("Legenda copiada.");
  };

  const handleSaveRef = async (post: ViralPost) => {
    const { error } = await supabase.from("client_reference_library").insert({
      client_id: clientId,
      title: post.caption.slice(0, 80) || `Post viral ${post.platform}`,
      content: post.caption,
      source_url: post.url ?? null,
      reference_type: post.platform === "instagram" ? "post_com_imagem" : post.platform === "linkedin" ? "post_linkedin" : "tweet",
      metadata: {
        engagement_rate: post.engagement_rate, likes: post.likes,
        comments: post.comments, platform: post.platform, posted_at: post.posted_at,
        source: "viral-hunter",
      },
    });
    if (error) {
      toast.error("Não foi possível salvar.");
      return;
    }
    toast.success("Salvo na biblioteca de referências!");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Meus posts de maior engajamento</h3>
          <p className="text-xs text-muted-foreground">
            Ranqueados por engagement rate — use como inspiração pra novos conteúdos.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <CalendarRange className="h-3.5 w-3.5 text-muted-foreground" />
          {(Object.keys(periodLabels) as PeriodFilter[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "text-[11px] px-2 py-0.5 rounded-full border",
                period === p
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-muted border-border text-muted-foreground",
              )}
            >
              {periodLabels[p]}
            </button>
          ))}
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
          </Button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-3 gap-3">
          <StatCard icon={<Award className="h-4 w-4" />} label="Melhor" value={`${stats.best.engagement_rate.toFixed(1)}%`} accent="emerald" />
          <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Média" value={`${stats.avg.toFixed(1)}%`} accent="blue" />
          <StatCard icon={<Zap className="h-4 w-4" />} label="Total likes" value={stats.totalLikes.toLocaleString("pt-BR")} accent="amber" />
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card border border-border/30 rounded-xl p-4 h-48 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="p-3 rounded-full bg-muted inline-flex mb-3">
            <Flame className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold mb-1">Sem posts importados ainda</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Importe posts do {client.name} pela aba Performance pra ver aqui os de maior engajamento.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((post) => {
            const cfg = platformColors[post.platform];
            return (
              <div key={post.id} className="bg-card border border-border/40 rounded-xl p-3 space-y-2 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", scoreColor(post.engagement_rate))}>
                    {post.engagement_rate.toFixed(1)}%
                  </span>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full", cfg.bg)}>{cfg.label}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">{daysAgo(post.posted_at)}</span>
                </div>
                {post.thumbnail_url && (
                  <div className="aspect-video rounded-md bg-muted overflow-hidden">
                    <img src={post.thumbnail_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                  </div>
                )}
                <p className="text-xs leading-relaxed line-clamp-4">
                  {post.caption || <span className="italic text-muted-foreground">(sem legenda)</span>}
                </p>
                <div className="flex items-center gap-1 pt-1">
                  <Button size="sm" className="h-7 text-[11px] gap-1 flex-1 bg-orange-600 hover:bg-orange-700 text-white" onClick={() => handleUse(post)}>
                    <Sparkles className="h-3 w-3" />
                    Usar no KAI
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => handleSaveRef(post)} title="Salvar como referência">
                    <BookmarkPlus className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => handleCopy(post)} title="Copiar legenda">
                    <Copy className="h-3 w-3" />
                  </Button>
                  {post.url && (
                    <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => window.open(post.url, "_blank")} title="Ver original">
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, accent }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: "emerald" | "blue" | "amber";
}) {
  const bg = {
    emerald: "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400",
    blue: "bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400",
    amber: "bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400",
  }[accent];
  return (
    <div className="bg-card border border-border/40 rounded-lg p-3 flex items-center gap-3">
      <div className={cn("p-2 rounded-md", bg)}>{icon}</div>
      <div>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}
