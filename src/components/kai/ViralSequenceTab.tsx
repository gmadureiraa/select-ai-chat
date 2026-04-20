/**
 * Viral Sequence — aba de criação de carrossel estilo Twitter.
 *
 * Fluxo único (MVP — F-SV1):
 *   1. User digita briefing/tema do carrossel
 *   2. Clica "Gerar carrossel" → KAI cria 8 slides de copy (heading + body)
 *   3. Grid dos 8 slides aparece — cada um editável (heading, body, imagem)
 *   4. Por slide, user escolhe imagem: IA (stub) / Buscar (Unsplash) / Upload
 *   5. Autosave em sessionStorage — sobrevive a refresh
 *   6. Botões: Começar do zero, Exportar JSON (temporário), Publicar (em breve)
 *
 * Persistência real no Supabase do sequencia-viral fica pro Lovable plugar.
 * A camada storage.ts isola isso.
 */

import { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  RotateCcw,
  Download,
  Send,
  Loader2,
  Twitter,
  ArrowRight,
  Save,
  Wand2,
  Zap,
  Layers,
  FileImage,
  FileText,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Client } from "@/hooks/useClients";
import type { ViralCarousel, ViralProfile } from "./viral-sequence/types";
import { emptyCarousel } from "./viral-sequence/types";
import {
  saveCurrentCarousel,
  loadCurrentCarousel,
  clearCurrentCarousel,
} from "./viral-sequence/storage";
import { generateCarouselCopies } from "./viral-sequence/generateCopy";
import { SlideEditor } from "./viral-sequence/SlideEditor";
import {
  exportCarouselAsPngs,
  exportCarouselAsPdf,
} from "./viral-sequence/exportCarousel";
import { CarouselFullPreview } from "./viral-sequence/CarouselFullPreview";

interface ViralSequenceTabProps {
  clientId: string;
  client: Client;
}

function buildInitialProfile(client: Client): ViralProfile {
  const sm = (client.social_media ?? {}) as Record<string, string>;
  const twitterHandle = sm.twitter ?? sm.x ?? "";
  const handle = twitterHandle.startsWith("@")
    ? twitterHandle
    : twitterHandle
      ? `@${twitterHandle.replace(/^https?:\/\/(?:www\.)?(?:x|twitter)\.com\//, "").split("/")[0]}`
      : `@${client.name.toLowerCase().replace(/\s+/g, "")}`;
  return {
    name: client.name,
    handle,
    avatarUrl: client.avatar_url ?? undefined,
  };
}

export const ViralSequenceTab = ({ clientId, client }: ViralSequenceTabProps) => {
  const [carousel, setCarousel] = useState<ViralCarousel>(() => {
    const saved = loadCurrentCarousel();
    // Só reusa rascunho salvo se for do mesmo cliente
    if (saved && saved.clientId === clientId) return saved;
    return emptyCarousel(clientId, buildInitialProfile(client));
  });
  const [briefing, setBriefing] = useState(carousel.briefing ?? "");
  const [tone, setTone] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Mapa de refs dos nós TwitterSlide (pra export PNG/PDF via html-to-image).
  const slideNodesRef = useRef<Map<string, HTMLElement>>(new Map());

  const registerSlideNode = (id: string, node: HTMLElement | null) => {
    if (node) slideNodesRef.current.set(id, node);
    else slideNodesRef.current.delete(id);
  };

  const hasAnySlideFilled = carousel.slides.some(
    (s) => s.heading.trim() || s.body.trim(),
  );

  // Autosave (debounced pela natureza de useEffect a cada render)
  useEffect(() => {
    saveCurrentCarousel(carousel);
  }, [carousel]);

  // Atalho de teclado: P abre preview (ignora se focus está em input/textarea)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!hasAnySlideFilled) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      )
        return;
      if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        setPreviewOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hasAnySlideFilled]);

  // Se trocar cliente no meio do caminho, reseta
  useEffect(() => {
    if (carousel.clientId !== clientId) {
      setCarousel(emptyCarousel(clientId, buildInitialProfile(client)));
      setBriefing("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const handleGenerate = async () => {
    if (!briefing.trim()) {
      toast.error("Escreva um briefing/tema pra gerar.");
      return;
    }
    setIsGenerating(true);
    try {
      const { slides } = await generateCarouselCopies({
        clientId,
        briefing: briefing.trim(),
        tone: tone.trim() || undefined,
      });
      setCarousel((c) => ({
        ...c,
        title: briefing.trim().slice(0, 60),
        briefing: briefing.trim(),
        slides,
        updatedAt: new Date().toISOString(),
      }));
      toast.success("Carrossel gerado! Ajuste as copies e adicione imagens por slide.");
    } catch (err) {
      console.error("[ViralSequence] generate failed:", err);
      toast.error(`Falha na geração: ${(err as Error).message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReset = () => {
    if (!confirm("Descartar carrossel atual e começar do zero?")) return;
    clearCurrentCarousel();
    setCarousel(emptyCarousel(clientId, buildInitialProfile(client)));
    setBriefing("");
    setTone("");
    toast.success("Rascunho descartado.");
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(carousel, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `carrossel-${carousel.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPngs = async () => {
    setIsExporting(true);
    try {
      const { ok, failed } = await exportCarouselAsPngs(carousel, slideNodesRef.current);
      if (failed > 0) {
        toast.warning(`${ok} PNGs exportados · ${failed} falharam (provavelmente CORS em imagens externas)`);
      } else {
        toast.success(`${ok} PNGs baixados! Uma imagem por slide.`);
      }
    } catch (err) {
      console.error("[ViralSequence] export PNG failed:", err);
      toast.error(`Falha: ${(err as Error).message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      const { ok, failed } = await exportCarouselAsPdf(carousel, slideNodesRef.current);
      if (failed > 0) {
        toast.warning(`PDF gerado com ${ok} slides · ${failed} falharam`);
      } else {
        toast.success(`PDF baixado com ${ok} slides!`);
      }
    } catch (err) {
      console.error("[ViralSequence] export PDF failed:", err);
      toast.error(`Falha: ${(err as Error).message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePublishStub = () => {
    toast.info(
      "Publicar/Agendar: em breve — vai chamar a integração LATE (já disponível no KAI em outras áreas) direto daqui.",
      { duration: 4000 },
    );
  };

  const handleSaveStub = () => {
    toast.info(
      "Salvar no Supabase do Sequência Viral: em breve. Rascunho continua autosaved localmente (sobrevive a refresh).",
      { duration: 4000 },
    );
  };

  const filledCount = carousel.slides.filter(
    (s) => s.heading.trim() || s.body.trim(),
  ).length;
  const imageCount = carousel.slides.filter(
    (s) => s.image.kind !== "none",
  ).length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header — sticky, com gradiente sutil */}
      <div className="border-b border-border/30 bg-gradient-to-b from-sky-50/30 to-background dark:from-sky-950/20 backdrop-blur-sm px-6 py-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-sky-500 text-white shadow-sm shadow-sky-500/30">
            <Twitter className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              Sequência Viral
              <span className="text-xs font-normal text-muted-foreground">·</span>
              <span className="text-xs font-normal text-muted-foreground truncate">
                {client.name}
              </span>
              {hasAnySlideFilled && (
                <span className="ml-1 inline-flex items-center gap-1 text-[10px] font-mono bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-1.5 py-0.5 rounded">
                  <Zap className="h-2.5 w-2.5" />
                  {filledCount} copies · {imageCount} imagens
                </span>
              )}
            </h2>
            <p className="text-xs text-muted-foreground">
              Carrossel estilo Twitter — KAI cria as copies, você escolhe a imagem de cada slide.
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {hasAnySlideFilled && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewOpen(true)}
                  className="gap-1.5 h-8"
                  title="Preview em tela cheia (atalho: P)"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Preview
                </Button>
                <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1.5 h-8">
                  <RotateCcw className="h-3.5 w-3.5" />
                  Zerar
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 h-8"
                      disabled={isExporting}
                    >
                      {isExporting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5" />
                      )}
                      Exportar
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={handleExportPngs} className="gap-2">
                      <FileImage className="h-4 w-4" />
                      <div>
                        <div className="text-sm">PNGs</div>
                        <div className="text-[10px] text-muted-foreground">Uma imagem por slide</div>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportPdf} className="gap-2">
                      <FileText className="h-4 w-4" />
                      <div>
                        <div className="text-sm">PDF</div>
                        <div className="text-[10px] text-muted-foreground">Todos slides em um arquivo</div>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportJson} className="gap-2">
                      <Download className="h-4 w-4" />
                      <div>
                        <div className="text-sm">JSON</div>
                        <div className="text-[10px] text-muted-foreground">Estrutura completa</div>
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="outline" size="sm" onClick={handleSaveStub} className="gap-1.5 h-8">
                  <Save className="h-3.5 w-3.5" />
                  Salvar
                </Button>
                <Button
                  size="sm"
                  onClick={handlePublishStub}
                  className="gap-1.5 h-8 bg-sky-600 hover:bg-sky-700 text-white shadow-sm shadow-sky-600/30"
                >
                  <Send className="h-3.5 w-3.5" />
                  Publicar
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-6 space-y-6">
          {/* Briefing form — hero style */}
          <div
            className={cn(
              "relative overflow-hidden rounded-2xl border max-w-3xl mx-auto w-full transition-all",
              hasAnySlideFilled
                ? "bg-card border-border/30 p-4"
                : "bg-gradient-to-br from-sky-50/60 via-background to-background dark:from-sky-950/30 border-sky-200/40 dark:border-sky-800/30 p-6",
            )}
          >
            {!hasAnySlideFilled && (
              <>
                <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-sky-200/30 to-transparent dark:from-sky-700/20 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl pointer-events-none" />
                <div className="relative flex items-center gap-2 mb-3">
                  <Wand2 className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-400">
                    Novo carrossel
                  </span>
                </div>
              </>
            )}
            <div className="relative space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Briefing
                </label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Tema, ângulo e insights. Quanto mais específico, melhor a saída.
                </p>
              </div>
              <Textarea
                value={briefing}
                onChange={(e) => setBriefing(e.target.value)}
                placeholder={`Ex: "Por que a maioria dos iniciantes em Bitcoin perde dinheiro nos primeiros 6 meses — traz 5 erros comuns + 1 hack que ninguém fala sobre self-custody."`}
                rows={hasAnySlideFilled ? 2 : 4}
                className={cn(
                  "text-sm resize-none transition-all bg-background",
                  !hasAnySlideFilled && "border-border/40 shadow-sm",
                )}
                disabled={isGenerating}
              />
              <div className="flex items-center gap-2">
                <Input
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  placeholder="Tom (opcional): direto, provocativo, técnico..."
                  className="h-9 text-sm flex-1"
                  disabled={isGenerating}
                />
                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating || !briefing.trim()}
                  className="h-9 gap-2 bg-sky-600 hover:bg-sky-700 text-white shadow-sm shadow-sky-600/30 px-5"
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {isGenerating
                    ? "Gerando..."
                    : hasAnySlideFilled
                      ? "Re-gerar"
                      : "Gerar carrossel"}
                </Button>
              </div>
            </div>
          </div>

          {/* Grid de slides */}
          {hasAnySlideFilled ? (
            <div className="max-w-7xl mx-auto w-full">
              <div className="flex items-center gap-2 mb-4">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Slides</h3>
                <span className="text-xs text-muted-foreground">
                  · {carousel.slides.length} slides · autosalvando
                </span>
                <div className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Salvo localmente
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {carousel.slides.map((slide) => (
                  <SlideEditor
                    key={slide.id}
                    slide={slide}
                    totalSlides={carousel.slides.length}
                    profile={carousel.profile}
                    onSlideNode={registerSlideNode}
                    onChange={(next) =>
                      setCarousel((c) => ({
                        ...c,
                        updatedAt: new Date().toISOString(),
                        slides: c.slides.map((s) => (s.id === next.id ? next : s)),
                      }))
                    }
                  />
                ))}
              </div>
            </div>
          ) : (
            <EmptyState />
          )}
        </div>
      </div>

      {/* Full-screen preview modal */}
      <CarouselFullPreview
        carousel={carousel}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />
    </div>
  );
};

function EmptyState() {
  const steps = [
    { n: "01", label: "KAI gera 8 slides", desc: "Capa + 6 insights + CTA" },
    { n: "02", label: "Você edita", desc: "Headline, body, imagem" },
    { n: "03", label: "Publica", desc: "Export / LATE (em breve)" },
  ];
  return (
    <div className="flex flex-col items-center py-10 max-w-2xl mx-auto gap-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
        {steps.map((s) => (
          <div
            key={s.n}
            className="rounded-xl border border-dashed border-border/50 bg-card/50 p-4 text-center"
          >
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-sky-600 dark:text-sky-400 mb-1">
              {s.n}
            </p>
            <p className="text-sm font-semibold">{s.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Próximo passo:</span>
        <ArrowRight className="h-3.5 w-3.5" />
        <span>Escreva um briefing acima e clique em "Gerar carrossel"</span>
      </div>
    </div>
  );
}
