/**
 * ViralReelsV2 — main panel do tab "Reels Viral" no KAI.
 *
 * Port completo do app standalone `code/reels-viral/` adaptado pra:
 *   - Vite + React 18 + react-router-dom (sem Next.js)
 *   - apiInvoke('adapt-viral-reel') (handler já existe em api/_handlers/)
 *   - useAuth() do KAI (Neon Auth via supabase-js adapter)
 *   - TanStack Query pra histórico + mutations
 *   - Shadcn/ui + Tailwind v4 (sem CSS vars rv-*)
 *
 * Diferença do `ViralReelsTab.tsx` antigo: arquitetura modular (URLInput,
 * BriefForm, AnalysisDisplay, ScriptCard, StoryboardScene, Teleprompter,
 * HistorySidebar), com hooks dedicados (useReelAnalysis, useReelHistory).
 *
 * Features cobertas:
 *  1. Input link IG/TikTok ✓
 *  2. Botão "Analisar" → apiInvoke('adapt-viral-reel') ✓
 *  3. Análise estrutural (resumo, porQueViralizou, esqueleto 5 blocos,
 *     padrõesTransferíveis) ✓
 *  4. Roteiro novo + storyboard cena por cena com tempo + papel ✓
 *  5. Save em viral_reels (handler faz isso) ✓
 *  6. Lista de "meus reels" salvos com seleção + delete ✓
 *  7. Salvar como ideia no Planning + salvar na Library ✓
 *  8. Teleprompter + download markdown + copy hooks/roteiro/caption ✓
 *
 * Bridge do Radar Viral: lê `?tema=` e `?briefing=` dos search params e
 * pre-popula o form (igual ViralReelsTab.tsx antigo).
 */

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  BookmarkPlus,
  Download,
  ExternalLink,
  Film,
  Lightbulb,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Client } from "@/hooks/useClients";
import { trackEvent } from "@/lib/analytics";

import { AnalysisDisplay } from "./components/AnalysisDisplay";
import { BriefForm, type BriefFormState } from "./components/BriefForm";
import { HistorySidebar } from "./components/HistorySidebar";
import { LoadingPipeline } from "./components/LoadingPipeline";
import { ScriptCard } from "./components/ScriptCard";
import { useReelAnalysis } from "./hooks/useReelAnalysis";
import {
  useDeleteReel,
  useInvalidateReels,
  useReelHistory,
  useSaveReelAsIdea,
  useSaveReelToLibrary,
} from "./hooks/useReelHistory";
import { downloadMarkdown } from "./lib/export-markdown";
import type { AdaptResponse, ReelRow } from "./types";

interface Props {
  clientId: string;
  client: Client;
}

const EMPTY_BRIEF: BriefFormState = {
  sourceUrl: "",
  tema: "",
  objetivo: "engajamento",
  cta: "",
  persona: "",
  nicho: "",
};

/**
 * Converte um ReelRow (linha do DB) num AdaptResponse pra reusar
 * AnalysisDisplay/ScriptCard sem duplicar.
 */
function reelRowToResponse(row: ReelRow): AdaptResponse | null {
  if (!row.analysis || !row.script) return null;
  return {
    ok: true,
    reelId: row.id,
    analysis: row.analysis,
    script: row.script,
    sourceMeta: row.source_meta ?? undefined,
    source: row.source_meta
      ? {
          ...row.source_meta,
          url: row.source_meta?.url ?? row.source_url,
        }
      : { url: row.source_url },
  };
}

export default function ViralReelsV2({ clientId, client }: Props) {
  const [brief, setBrief] = useState<BriefFormState>(EMPTY_BRIEF);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const { step, result, runAdapt, reset, setStep } = useReelAnalysis();
  const reelHistory = useReelHistory(clientId);
  const reels = useMemo(() => reelHistory.data ?? [], [reelHistory.data]);
  const deleteReel = useDeleteReel(clientId);
  const invalidateReels = useInvalidateReels(clientId);
  const saveAsIdea = useSaveReelAsIdea();
  const saveToLibrary = useSaveReelToLibrary();

  // Pre-fill nicho com industry do client (se ainda vazio)
  useEffect(() => {
    if (!brief.nicho && (client as any)?.industry) {
      setBrief((b) => ({ ...b, nicho: (client as any).industry }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  // Bridge Radar Viral: ?tema= / ?briefing= pre-popula form e limpa params
  useEffect(() => {
    const t = searchParams.get("tema");
    const b = searchParams.get("briefing");
    let consumed = false;
    if (t && !brief.tema) {
      setBrief((cur) => ({ ...cur, tema: t }));
      consumed = true;
    }
    if (b && !brief.cta) {
      setBrief((cur) => ({ ...cur, cta: cur.cta || `Ângulo: ${b}` }));
      consumed = true;
    }
    if (consumed) {
      const next = new URLSearchParams(searchParams);
      next.delete("tema");
      next.delete("briefing");
      setSearchParams(next, { replace: true });
      toast.info("Briefing puxado do Radar Viral.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Quando carregar histórico pela primeira vez e não houver seleção, escolhe
  // o primeiro reel "done" (se existir).
  useEffect(() => {
    if (selectedId || reels.length === 0) return;
    const firstDone = reels.find((r) => r.status === "done");
    if (firstDone) setSelectedId(firstDone.id);
  }, [reels, selectedId]);

  const selected: ReelRow | null = useMemo(
    () => reels.find((r) => r.id === selectedId) ?? null,
    [reels, selectedId],
  );

  // Quando geração termina, refresca lista + seleciona o novo reel
  async function handleSubmit() {
    const data = await runAdapt({
      clientId,
      sourceUrl: brief.sourceUrl,
      tema: brief.tema,
      objetivo: brief.objetivo,
      cta: brief.cta,
      persona: brief.persona || undefined,
      nicho: brief.nicho || undefined,
    });
    if (!data) return;

    trackEvent("reel_analyzed", {
      client_id: clientId,
      objetivo: brief.objetivo,
      tema_length: brief.tema.trim().length,
      has_persona: Boolean(brief.persona.trim()),
      has_nicho: Boolean(brief.nicho.trim()),
    });

    invalidateReels();
    if (data.reelId) setSelectedId(data.reelId);
    setBrief(EMPTY_BRIEF);
  }

  function handleReset() {
    reset();
    setBrief(EMPTY_BRIEF);
  }

  function handleDelete(id: string) {
    deleteReel.mutate(id, {
      onSuccess: () => {
        if (selectedId === id) setSelectedId(null);
      },
    });
  }

  // Quando user clica num reel do histórico, sai do estado "result/loading"
  // e mostra o reel salvo (renderizando AnalysisDisplay + ScriptCard a partir
  // da row).
  function handleSelectFromHistory(reel: ReelRow) {
    setSelectedId(reel.id);
    setStep("idle");
  }

  // O painel da direita pode estar em 4 estados:
  //   - loading (geração ativa)
  //   - result (acabou de gerar — usa `result` retornado pelo hook)
  //   - histórico selecionado (user clicou num reel salvo)
  //   - vazio (form puro)
  const showLoading = step === "loading";
  const liveResult = result;
  const persistedResult = selected ? reelRowToResponse(selected) : null;
  const displayedResult = liveResult ?? persistedResult;

  return (
    <div className="flex h-full overflow-hidden">
      <HistorySidebar
        reels={reels}
        selectedId={selectedId}
        onSelect={handleSelectFromHistory}
        onDelete={handleDelete}
        loading={reelHistory.isLoading}
      />

      <div className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto p-6 space-y-6">
          <header className="flex items-center gap-2">
            <Film className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold">Reels Viral</h1>
            <Badge variant="outline" className="ml-2 text-xs">
              Engenharia reversa · v2
            </Badge>
          </header>
          <p className="text-sm text-muted-foreground -mt-3">
            Cola o link de um Reel viral, descreve seu briefing, e a IA replica
            a estrutura narrativa exata adaptada ao seu conteúdo.
          </p>

          {/* Form sempre visível pra adaptação rápida */}
          <BriefForm
            value={brief}
            onChange={setBrief}
            onSubmit={handleSubmit}
            loading={showLoading}
          />

          {/* Painel inferior: loading | result | reel selecionado */}
          <AnimatePresence mode="wait">
            {showLoading && (
              <motion.section
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <LoadingPipeline />
              </motion.section>
            )}

            {!showLoading && displayedResult && (
              <motion.section
                key={displayedResult.reelId ?? "live"}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <ResultActions
                  result={displayedResult}
                  selected={selected}
                  client={client}
                  onReset={handleReset}
                  onDelete={handleDelete}
                  onSaveAsIdea={(reel) =>
                    saveAsIdea.mutate({
                      reel,
                      clientId,
                      workspaceId: (client as any).workspace_id,
                    })
                  }
                  onSaveToLibrary={(reel) =>
                    saveToLibrary.mutate({ reel, clientId })
                  }
                  isSavingIdea={saveAsIdea.isPending}
                  isSavingLibrary={saveToLibrary.isPending}
                />
                <AnalysisDisplay
                  analysis={displayedResult.analysis}
                  source={displayedResult.source ?? displayedResult.sourceMeta}
                  scenesCount={displayedResult.script.scenes.length}
                />
                <ScriptCard script={displayedResult.script} />
              </motion.section>
            )}

            {/* Caso especial: selected mas em status pending/processing/error */}
            {!showLoading && !displayedResult && selected && (
              <motion.section
                key={`selected-${selected.id}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-lg border border-border bg-card p-6"
              >
                <SelectedStatus reel={selected} onDelete={handleDelete} />
              </motion.section>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function SelectedStatus({
  reel,
  onDelete,
}: {
  reel: ReelRow;
  onDelete: (id: string) => void;
}) {
  if (reel.status === "error") {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-destructive">
          Erro na geração
        </h3>
        <p className="text-sm text-muted-foreground">
          {reel.error_message ?? "Falha desconhecida"}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(reel.id)}
          className="text-destructive"
        >
          <Trash2 className="h-3 w-3 mr-1" /> Excluir
        </Button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground">
      <div className="h-3 w-3 rounded-full bg-primary animate-pulse" />
      Processando reel… atualize em alguns segundos.
    </div>
  );
}

function ResultActions({
  result,
  selected,
  client,
  onReset,
  onDelete,
  onSaveAsIdea,
  onSaveToLibrary,
  isSavingIdea,
  isSavingLibrary,
}: {
  result: AdaptResponse;
  selected: ReelRow | null;
  client: Client;
  onReset: () => void;
  onDelete: (id: string) => void;
  onSaveAsIdea: (reel: ReelRow) => void;
  onSaveToLibrary: (reel: ReelRow) => void;
  isSavingIdea: boolean;
  isSavingLibrary: boolean;
}) {
  const source = result.source ?? result.sourceMeta;
  const sourceUrl = source?.url ?? source?.videoUrl;

  return (
    <div className="flex items-center justify-between flex-wrap gap-3 border-t border-border pt-4">
      <div className="min-w-0 flex-1 flex items-start gap-3">
        <Button variant="outline" size="sm" onClick={onReset} className="shrink-0">
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Adaptar outro
        </Button>
        {sourceUrl && (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mt-1"
          >
            <ExternalLink className="h-3 w-3" />
            Ver reel original
          </a>
        )}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => downloadMarkdown(result)}
          title="Baixa um .md com toda a análise + roteiro"
        >
          <Download className="h-3.5 w-3.5 mr-1.5" /> Markdown
        </Button>
        {selected && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSaveAsIdea(selected)}
              disabled={isSavingIdea}
              title="Salvar como ideia no Planning"
            >
              <Lightbulb className="h-3.5 w-3.5 mr-1.5" />
              Ideia
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSaveToLibrary(selected)}
              disabled={isSavingLibrary}
              title="Salvar na Library"
            >
              <BookmarkPlus className="h-3.5 w-3.5 mr-1.5" />
              Library
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (confirm("Excluir este roteiro?")) onDelete(selected.id);
              }}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// `client` é só pra suprimir lint quando não usamos
void ArrowLeft;
