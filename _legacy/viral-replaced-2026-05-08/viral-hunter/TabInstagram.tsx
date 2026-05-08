/**
 * Tab Instagram do Viral Hunter — busca posts/reels por hashtag via Apify
 * com infinite scroll + cache automático no banco.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Instagram, Heart, MessageSquare, Eye, Play, ExternalLink, RefreshCw, Sparkles,
  AlertTriangle, Lightbulb, Layers, History, Loader2, Hash,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
import { useInstagramSearchInfinite, useInstagramSearchHistory, type InstagramPostItem } from "./useInstagramSearch";
import { saveAsIdea, buildSequenceUrl } from "./saveAsIdea";

function fmt(n: number | null | undefined): string {
  if (n === undefined || n === null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

interface Props {
  clientId: string;
  onUseAsInspiration: (prompt: string) => void;
}

export function TabInstagram({ clientId, onUseAsInspiration }: Props) {
  const { workspace } = useWorkspaceContext();
  const navigate = useNavigate();
  const [hashtagInput, setHashtagInput] = useState("");
  const [hashtag, setHashtag] = useState("");
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const {
    data, isLoading, isFetching, error, refetch,
    fetchNextPage, hasNextPage, isFetchingNextPage,
  } = useInstagramSearchInfinite({
    hashtag, limit: 12, enabled: !!hashtag,
    clientId, workspaceId: workspace?.id,
  });

  const liveItems = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);
  const showHistory = !!error || (!isLoading && liveItems.length === 0 && !!hashtag);
  const { data: history } = useInstagramSearchHistory({ clientId, enabled: showHistory });
  const posts = liveItems.length > 0 ? liveItems : (history?.items ?? []);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && !isFetchingNextPage) fetchNextPage();
    }, { rootMargin: "300px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const h = hashtagInput.trim().replace(/^#/, "");
    if (!h) return;
    setHashtag(h);
  }

  async function handleSaveAsIdea(p: InstagramPostItem) {
    if (!workspace?.id) { toast.error("Workspace não encontrado"); return; }
    setSavingIds((s) => new Set(s).add(p.id));
    try {
      await saveAsIdea({
        clientId, workspaceId: workspace.id,
        title: (p.caption || `Post de @${p.ownerUsername}`).slice(0, 120),
        briefing: [
          p.caption?.slice(0, 500) ?? "", "",
          `Post viral de @${p.ownerUsername} (${fmt(p.likesCount)} likes · ${fmt(p.videoPlayCount ?? p.videoViewCount)} views).`,
          "Ângulo sugerido: adaptar a abordagem desse post pro feed do cliente.",
        ].join("\n"),
        source: { kind: "instagram", url: p.url, sourceName: `@${p.ownerUsername}`, thumbnail: p.thumbnailUrl, publishedAt: p.timestamp ?? undefined },
      });
      toast.success("Salvo como ideia no Planejamento");
    } catch (err) {
      toast.error("Falha ao salvar: " + (err as Error).message);
    } finally {
      setSavingIds((s) => { const n = new Set(s); n.delete(p.id); return n; });
    }
  }

  function handleUse(p: InstagramPostItem) {
    onUseAsInspiration([
      `Post viral do Instagram de @${p.ownerUsername} (${fmt(p.likesCount)} likes):`,
      p.caption ? `\nCaption: ${p.caption.slice(0, 400)}` : "",
      `\nLink: ${p.url}`,
      `\nCrie um post inspirado nessa abordagem, adaptado pro cliente atual.`,
    ].join(""));
    toast.success("Enviado pro KAI.");
  }

  function handleCarousel(p: InstagramPostItem) {
    navigate(buildSequenceUrl({
      clientId,
      title: (p.caption || `Post de @${p.ownerUsername}`).slice(0, 80),
      briefing: [
        `Post de referência: @${p.ownerUsername}`,
        p.caption ? `\nCaption: ${p.caption.slice(0, 400)}` : "",
        `\nLink: ${p.url}`,
        p.thumbnailUrl ? `Capa: ${p.thumbnailUrl}` : "",
        "\nObjetivo: adaptar a estrutura desse post viral pro feed do cliente.",
      ].join("\n"),
    }));
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="bg-card border border-border/30 rounded-xl p-4 space-y-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Hashtag do Instagram</p>
          <p className="text-xs text-muted-foreground">Digite uma hashtag (sem #) — o KAI traz top posts via Apify.</p>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={hashtagInput} onChange={(e) => setHashtagInput(e.target.value)}
              placeholder="bitcoin, marketing, defi…" className="pl-8 h-9 text-sm" />
          </div>
          <Button type="submit" size="sm" disabled={!hashtagInput.trim()}>Buscar</Button>
          {hashtag && (
            <Button type="button" variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
            </Button>
          )}
        </div>
        {hashtag && <Badge variant="secondary" className="text-[10px]">#{hashtag}</Badge>}
      </form>

      {showHistory && history && (
        <div className="text-xs px-3 py-2 rounded-md bg-blue-500/10 border border-blue-500/30 text-blue-700 dark:text-blue-300 flex items-center gap-2">
          <History className="h-3.5 w-3.5" />
          Mostrando histórico salvo de {new Date(history.cachedAt).toLocaleString("pt-BR")} ({history.query}).
        </div>
      )}

      {!hashtag ? (
        <Empty />
      ) : error && !history ? (
        <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
      ) : isLoading ? (
        <Grid>{Array.from({ length: 8 }).map((_, i) => <Skel key={i} />)}</Grid>
      ) : posts.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">Nenhum post encontrado pra essa hashtag.</div>
      ) : (
        <>
          <Grid>
            {posts.map((p) => (
              <div key={p.id} className="bg-card border border-border/40 rounded-xl overflow-hidden hover:shadow-md transition-shadow flex flex-col">
                <a href={p.url} target="_blank" rel="noopener noreferrer" className="relative block aspect-square bg-muted">
                  {p.thumbnailUrl ? (
                    <img src={p.thumbnailUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                  ) : <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Instagram /></div>}
                  {p.videoUrl && (
                    <span className="absolute top-2 right-2 bg-black/70 text-white p-1 rounded">
                      <Play className="h-3 w-3 fill-white" />
                    </span>
                  )}
                </a>
                <div className="p-3 flex-1 flex flex-col gap-2">
                  <p className="text-xs font-semibold truncate">@{p.ownerUsername}</p>
                  <p className="text-[11px] text-muted-foreground line-clamp-2">{p.caption || "—"}</p>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-auto">
                    <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{fmt(p.likesCount)}</span>
                    <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{fmt(p.commentsCount)}</span>
                    {(p.videoPlayCount ?? p.videoViewCount) !== null && (
                      <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{fmt(p.videoPlayCount ?? p.videoViewCount)}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 pt-1">
                    <Button size="sm" className="h-7 text-xs gap-1 flex-1 bg-orange-600 hover:bg-orange-700 text-white" onClick={() => handleUse(p)}>
                      <Sparkles className="h-3 w-3" />Usar
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1" onClick={() => handleSaveAsIdea(p)} disabled={savingIds.has(p.id)}>
                      <Lightbulb className="h-3 w-3" />{savingIds.has(p.id) ? "…" : "Ideia"}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1 text-sky-700 dark:text-sky-400" onClick={() => handleCarousel(p)}>
                      <Layers className="h-3 w-3" />Carrossel
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => window.open(p.url, "_blank")}>
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </Grid>
          {liveItems.length > 0 && (
            <div ref={sentinelRef} className="py-6 flex justify-center">
              {isFetchingNextPage ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Carregando mais posts…
                </div>
              ) : hasNextPage ? (
                <Button variant="outline" size="sm" onClick={() => fetchNextPage()}>Carregar mais</Button>
              ) : (
                <span className="text-[11px] text-muted-foreground">Fim dos resultados</span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">{children}</div>;
}
function Skel() {
  return (
    <div className="bg-card border border-border/30 rounded-xl overflow-hidden animate-pulse">
      <div className="aspect-square bg-muted" />
      <div className="p-3 space-y-2">
        <div className="h-3 bg-muted rounded w-1/2" />
        <div className="h-3 bg-muted/60 rounded w-full" />
      </div>
    </div>
  );
}
function Empty() {
  return (
    <div className="text-center py-16 max-w-md mx-auto">
      <div className="p-3 rounded-full bg-muted inline-flex mb-3">
        <Instagram className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold mb-1">Busque por hashtag</h3>
      <p className="text-sm text-muted-foreground">Ex: "bitcoin", "marketing digital", "investimentos".</p>
    </div>
  );
}
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="text-center py-8 max-w-md mx-auto">
      <div className="p-3 rounded-full bg-red-100 dark:bg-red-900/20 inline-flex mb-3">
        <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
      </div>
      <h3 className="text-sm font-semibold mb-1">Falha na busca</h3>
      <p className="text-xs text-muted-foreground mb-3">{message}</p>
      <Button size="sm" variant="outline" onClick={onRetry}>
        <RefreshCw className="h-3 w-3 mr-1.5" /> Tentar novamente
      </Button>
    </div>
  );
}
