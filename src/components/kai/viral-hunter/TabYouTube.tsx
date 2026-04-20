/**
 * Tab YouTube do Viral Hunter — busca vídeos do nicho ordenados por views.
 */

import { useMemo, useState } from "react";
import { useYouTubeSearch } from "./useYouTubeSearch";
import { KeywordsChips } from "./KeywordsChips";
import { useViralHunterConfig } from "./useViralHunterConfig";
import {
  Play,
  Eye,
  ThumbsUp,
  MessageSquare,
  ExternalLink,
  RefreshCw,
  Sparkles,
  AlertTriangle,
  Youtube,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function fmt(n: number | undefined): string {
  if (n === undefined || n === null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function daysAgo(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (d < 1) return "hoje";
  if (d === 1) return "ontem";
  if (d < 30) return `${d}d`;
  if (d < 365) return `${Math.floor(d / 30)}m`;
  return `${Math.floor(d / 365)}a`;
}

interface TabYouTubeProps {
  clientId: string;
  onUseAsInspiration: (prompt: string) => void;
}

export function TabYouTube({ clientId, onUseAsInspiration }: TabYouTubeProps) {
  const { config, save } = useViralHunterConfig(clientId);
  const [period, setPeriod] = useState<"7d" | "30d" | "90d" | "all">("30d");

  const publishedAfter = useMemo(() => {
    if (period === "all") return undefined;
    const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
    return new Date(Date.now() - days * 86_400_000).toISOString();
  }, [period]);

  const query = config.keywords.join(" | ");
  const hasKey = true; // chave agora é server-side via edge function
  const { data: videos = [], isLoading, isFetching, refetch, error } = useYouTubeSearch({
    query,
    publishedAfter,
    order: "viewCount",
    maxResults: 20,
    enabled: config.keywords.length > 0,
  });

  const handleSaveKeywords = async (next: string[]) => {
    await save({ ...config, keywords: next });
  };

  const handleUseVideo = (v: typeof videos[number]) => {
    const prompt = [
      `Estou analisando um vídeo viral do YouTube do canal "${v.channelTitle}" com ${fmt(v.viewCount)} views:`,
      `\nTítulo: ${v.title}`,
      v.description ? `\nDescrição: ${v.description.slice(0, 280)}` : "",
      `\nLink: ${v.url}`,
      `\nCrie um post/thread inspirado nessa abordagem, adaptado pro cliente atual — mantenha o hook mas traga um ângulo original.`,
    ].join("");
    onUseAsInspiration(prompt);
    toast.success("Enviado pro KAI — ele vai criar algo baseado nesse vídeo.");
  };

  if (!hasKey) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center max-w-lg mx-auto gap-3">
        <div className="p-4 rounded-full bg-amber-100 dark:bg-amber-900/20">
          <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
        </div>
        <h3 className="text-base font-semibold">YouTube API Key não configurada</h3>
        <p className="text-sm text-muted-foreground">
          Adicione <code className="text-xs bg-muted px-1.5 py-0.5 rounded">VITE_YT_API_KEY</code> no
          <code className="text-xs bg-muted px-1.5 py-0.5 rounded ml-1">.env</code> do projeto e
          reinicie o dev server pra buscar vídeos virais.
        </p>
        <p className="text-xs text-muted-foreground">
          Grátis no Google Cloud Console — YouTube Data API v3 · 10k quotas/dia.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header de config */}
      <div className="bg-card border border-border/30 rounded-xl p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Keywords do nicho
            </p>
            <p className="text-xs text-muted-foreground">
              Adicione termos-chave. O KAI busca vídeos virais que mencionem esses termos.
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {(["7d", "30d", "90d", "all"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "text-[10px] px-2 py-0.5 rounded-full border",
                  period === p
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-muted border-border text-muted-foreground",
                )}
              >
                {p === "all" ? "Tudo" : p}
              </button>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
            </Button>
          </div>
        </div>
        <KeywordsChips keywords={config.keywords} onChange={handleSaveKeywords} />
      </div>

      {/* Results */}
      {config.keywords.length === 0 ? (
        <EmptyKeywords />
      ) : error ? (
        <ErrorState message={(error as Error).message} />
      ) : isLoading ? (
        <Grid>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} />
          ))}
        </Grid>
      ) : videos.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          Nenhum vídeo encontrado com essas keywords no período selecionado.
        </div>
      ) : (
        <Grid>
          {videos.map((v) => (
            <div
              key={v.id}
              className="bg-card border border-border/40 rounded-xl overflow-hidden hover:shadow-md transition-shadow flex flex-col"
            >
              <a
                href={v.url}
                target="_blank"
                rel="noopener noreferrer"
                className="relative block aspect-video bg-muted"
              >
                <img
                  src={v.thumbnailUrl}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Play className="h-10 w-10 text-white fill-white" />
                </div>
                <span className="absolute top-2 right-2 text-[10px] font-semibold bg-black/70 text-white px-1.5 py-0.5 rounded">
                  {daysAgo(v.publishedAt)}
                </span>
              </a>
              <div className="p-3 flex-1 flex flex-col gap-2">
                <h4 className="text-sm font-semibold leading-snug line-clamp-2">{v.title}</h4>
                <p className="text-xs text-muted-foreground truncate">{v.channelTitle}</p>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-auto">
                  <span className="flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    {fmt(v.viewCount)}
                  </span>
                  <span className="flex items-center gap-1">
                    <ThumbsUp className="h-3 w-3" />
                    {fmt(v.likeCount)}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    {fmt(v.commentCount)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 pt-1">
                  <Button
                    size="sm"
                    className="h-7 text-xs gap-1 flex-1 bg-orange-600 hover:bg-orange-700 text-white"
                    onClick={() => handleUseVideo(v)}
                  >
                    <Sparkles className="h-3 w-3" />
                    Usar no KAI
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 w-7 p-0"
                    onClick={() => window.open(v.url, "_blank")}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </Grid>
      )}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">{children}</div>;
}

function Skeleton() {
  return (
    <div className="bg-card border border-border/30 rounded-xl overflow-hidden animate-pulse">
      <div className="aspect-video bg-muted" />
      <div className="p-3 space-y-2">
        <div className="h-4 bg-muted rounded w-full" />
        <div className="h-4 bg-muted rounded w-4/5" />
        <div className="h-3 bg-muted/60 rounded w-2/3" />
      </div>
    </div>
  );
}

function EmptyKeywords() {
  return (
    <div className="text-center py-16 max-w-md mx-auto">
      <div className="p-3 rounded-full bg-muted inline-flex mb-3">
        <Youtube className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold mb-1">Adicione keywords do nicho</h3>
      <p className="text-sm text-muted-foreground">
        Ex: "bitcoin", "self-custody", "defi" — o KAI traz os vídeos virais desses temas.
      </p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="text-center py-8 max-w-md mx-auto">
      <div className="p-3 rounded-full bg-red-100 dark:bg-red-900/20 inline-flex mb-3">
        <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
      </div>
      <h3 className="text-sm font-semibold mb-1">Falha ao buscar do YouTube</h3>
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  );
}
