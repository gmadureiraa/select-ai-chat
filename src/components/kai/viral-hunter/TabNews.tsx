/**
 * Tab Notícias — busca Google News RSS por keywords do cliente.
 */

import { useGoogleNews } from "./useGoogleNews";
import { useViralHunterConfig } from "./useViralHunterConfig";
import { KeywordsChips } from "./KeywordsChips";
import { saveAsIdea, buildSequenceUrl } from "./saveAsIdea";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
import { useNavigate } from "react-router-dom";
import {
  Newspaper,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Globe,
  Lightbulb,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useState } from "react";

function hoursAgo(iso: string): string {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (h < 1) return "agora";
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

interface TabNewsProps {
  clientId: string;
  onUseAsInspiration: (prompt: string) => void;
}

export function TabNews({ clientId, onUseAsInspiration }: TabNewsProps) {
  const { config, save } = useViralHunterConfig(clientId);
  const { workspace } = useWorkspaceContext();
  const navigate = useNavigate();
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const query = config.keywords.join(" OR ");
  const { data: news = [], isLoading, isFetching, refetch, error } = useGoogleNews({
    query,
    enabled: config.keywords.length > 0,
  });

  const handleUse = (n: typeof news[number]) => {
    const prompt = [
      `Notícia recente do nicho:`,
      `\n${n.title}`,
      n.snippet ? `\n${n.snippet}` : "",
      `\nFonte: ${n.source} · ${n.url}`,
      `\nCrie um post reagindo a essa notícia — traga um ângulo editorial do cliente.`,
    ].join("");
    onUseAsInspiration(prompt);
    toast.success("Enviado pro KAI — ele vai reagir à notícia.");
  };

  const handleSaveAsIdea = async (n: typeof news[number]) => {
    if (!workspace?.id) {
      toast.error("Workspace não encontrado");
      return;
    }
    setSavingIds((s) => new Set(s).add(n.id));
    try {
      await saveAsIdea({
        clientId,
        workspaceId: workspace.id,
        title: n.title,
        briefing: [
          n.snippet ?? "",
          "",
          "Ângulo sugerido: reagir editorialmente a essa notícia trazendo a perspectiva do cliente.",
        ].join("\n"),
        source: {
          kind: "news",
          url: n.url,
          sourceName: n.source,
          thumbnail: n.thumbnailUrl,
          publishedAt: n.publishedAt,
        },
      });
      toast.success("Salvo como ideia no Planejamento");
    } catch (err) {
      toast.error("Falha ao salvar: " + (err as Error).message);
    } finally {
      setSavingIds((s) => {
        const next = new Set(s);
        next.delete(n.id);
        return next;
      });
    }
  };

  const handleGenerateCarousel = (n: typeof news[number]) => {
    const briefing = [
      `Notícia base: ${n.title}`,
      n.snippet ? `\nResumo: ${n.snippet}` : "",
      `\nFonte: ${n.source}`,
      n.url ? `Link: ${n.url}` : "",
      n.thumbnailUrl ? `\nImagem de capa sugerida: ${n.thumbnailUrl}` : "",
      "\nObjetivo: criar carrossel editorial estilo capa de jornal — slide 1 com headline forte sobre essa notícia, slides 2-7 desenvolvendo análise/contexto/implicações, slide 8 chamada pra discussão.",
    ].join("\n");
    const url = buildSequenceUrl({
      clientId,
      title: n.title,
      briefing,
    });
    navigate(url);
    toast.success("Abrindo Sequência Viral com briefing pronto…");
  };

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border/30 rounded-xl p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Keywords do nicho
            </p>
            <p className="text-xs text-muted-foreground">
              Google News busca por qualquer uma dessas palavras em pt-BR.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 shrink-0"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
          </Button>
        </div>
        <KeywordsChips keywords={config.keywords} onChange={(next) => save({ ...config, keywords: next })} />
      </div>

      {config.keywords.length === 0 ? (
        <div className="text-center py-16 max-w-md mx-auto">
          <div className="p-3 rounded-full bg-muted inline-flex mb-3">
            <Newspaper className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold mb-1">Adicione keywords pra puxar notícias</h3>
          <p className="text-sm text-muted-foreground">
            Ex: "bitcoin", "agência de marketing", "inteligência artificial"
          </p>
        </div>
      ) : error ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          Falha ao buscar notícias: {(error as Error).message}
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-card border border-border/30 rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-muted rounded w-3/4 mb-2" />
              <div className="h-3 bg-muted/60 rounded w-full mb-1" />
              <div className="h-3 bg-muted/60 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : news.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          Nenhuma notícia recente encontrada.
        </div>
      ) : (
        <div className="space-y-2">
          {news.map((n) => (
            <div
              key={n.id}
              className="bg-card border border-border/40 rounded-lg p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex gap-4">
                {n.thumbnailUrl && (
                  <img
                    src={n.thumbnailUrl}
                    alt=""
                    className="h-20 w-28 object-cover rounded-md flex-shrink-0"
                    loading="lazy"
                  />
                )}
                <div className="flex-1 min-w-0 space-y-1">
                  <a
                    href={n.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block font-semibold text-sm leading-snug line-clamp-2 hover:text-primary"
                  >
                    {n.title}
                  </a>
                  {n.snippet && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{n.snippet}</p>
                  )}
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-1">
                    <span className="flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      {n.source}
                    </span>
                    <span>{hoursAgo(n.publishedAt)}</span>
                    <div className="flex-1" />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-[11px] gap-1 px-2 text-muted-foreground hover:text-foreground"
                      onClick={() => handleSaveAsIdea(n)}
                      disabled={savingIds.has(n.id)}
                      title="Salvar como ideia no Planejamento"
                    >
                      <Lightbulb className="h-3 w-3" />
                      {savingIds.has(n.id) ? "Salvando…" : "Ideia"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-[11px] gap-1 px-2 text-sky-700 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/30"
                      onClick={() => handleGenerateCarousel(n)}
                      title="Abrir Sequência Viral com briefing dessa notícia"
                    >
                      <Layers className="h-3 w-3" />
                      Carrossel
                    </Button>
                    <Button
                      size="sm"
                      className="h-6 text-[11px] gap-1 bg-orange-600 hover:bg-orange-700 text-white px-2"
                      onClick={() => handleUse(n)}
                    >
                      <Sparkles className="h-3 w-3" />
                      Reagir no KAI
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 w-6 p-0"
                      onClick={() => window.open(n.url, "_blank")}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
