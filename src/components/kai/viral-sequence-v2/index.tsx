/**
 * Sequência Viral v2 — entry point (MainPanel).
 *
 * Port completo do fluxo standalone (`code/sequencia-viral`) pra dentro do KAI.
 *
 * Diferenças vs legacy `viral-sequence/`:
 *   - Suporta 8 templates visuais (mesmo set, mas isolado em /viral-sequence-v2/templates/)
 *   - Heading + body separados (ou só body com **bold** — auto-detect)
 *   - BriefingPanel rico: tom, língua, slide count, atalhos, cyclers
 *   - TemplatePicker grande na dialog "Trocar template"
 *   - Layers e bgColor por slide
 *   - Auto-imagens via Gemini Flash + Pexels
 *   - Persistência: viral_carousels (Supabase/Neon)
 *   - Sem Stripe paywall (KAI tem subscription model próprio)
 *   - Sem Next.js — tudo Vite + React Router + Supabase client KAI
 *
 * Path único: src/components/kai/viral-sequence-v2/index.tsx
 * Default export: ViralSequenceV2.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Sparkles,
  RotateCcw,
  Download,
  Loader2,
  Twitter,
  Save,
  Eye,
  ListTodo,
  FileImage,
  FileText,
  FileArchive,
  Layers,
  Zap,
  Palette,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { Client } from "@/hooks/useClients";

import {
  emptyCarousel,
  type ViralCarousel,
  type ViralProfile,
  type ViralTemplateId,
} from "./types";
import {
  saveDraft,
  loadDraft,
  clearDraft,
  saveCarousel,
  loadCarousel,
} from "./lib/storage";
import {
  exportCarouselAsPdf,
  exportCarouselAsPngs,
  exportCarouselAsZip,
} from "./lib/exportCarousel";
import { useGenerateCarousel } from "./hooks/useGenerateCarousel";
import { useAutoImages } from "./hooks/useAutoImages";
import { BriefingPanel, type Lang, type Tone } from "./components/BriefingPanel";
import { SlideEditor } from "./components/SlideEditor";
import { TemplatePicker } from "./components/TemplatePicker";
import { CarouselFullPreview } from "./components/CarouselFullPreview";
import { OffscreenSlideRenderer } from "./components/OffscreenSlideRenderer";
import { SavedCarouselsSidebar } from "./components/SavedCarouselsSidebar";
import { TEMPLATES_META } from "./templates";

interface ViralSequenceV2Props {
  clientId: string;
  client: Client;
}

function buildInitialProfile(client: Client): ViralProfile {
  const sm = (client.social_media ?? {}) as Record<string, string>;
  const twitterHandle = sm.twitter ?? sm.x ?? sm.instagram_handle ?? "";
  const handle = twitterHandle.startsWith("@")
    ? twitterHandle
    : twitterHandle
      ? `@${twitterHandle.replace(/^https?:\/\/(?:www\.)?(?:x|twitter|instagram)\.com\//, "").split("/")[0]}`
      : `@${client.name.toLowerCase().replace(/\s+/g, "")}`;
  return {
    name: client.name,
    handle,
    avatarUrl: client.avatar_url ?? undefined,
  };
}

export default function ViralSequenceV2({ clientId, client }: ViralSequenceV2Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const carouselIdParam = searchParams.get("carouselId");
  const seedBriefingParam = searchParams.get("seedBriefing");

  const [carousel, setCarousel] = useState<ViralCarousel>(() => {
    const saved = loadDraft();
    if (saved && saved.clientId === clientId) return saved;
    return emptyCarousel(clientId, buildInitialProfile(client));
  });
  const [briefing, setBriefing] = useState(carousel.briefing ?? "");
  const [tone, setTone] = useState<Tone>("editorial");
  const [language, setLanguage] = useState<Lang>("pt-br");
  const [slideCount, setSlideCount] = useState<number>(carousel.slides.length || 8);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingToPlanning, setIsSendingToPlanning] = useState(false);

  const { generate: generateRaw, loading: isGenerating } = useGenerateCarousel();
  const { fillImages, loading: isAutoImaging } = useAutoImages();

  // Refs dos previews em scale (UI grid). Mapa pra captura PNG.
  const slideNodesRef = useRef<Map<string, HTMLElement>>(new Map());
  const exportNodesRef = useRef<Map<string, HTMLDivElement>>(new Map());

  const registerSlideNode = (id: string, node: HTMLElement | null) => {
    if (node) slideNodesRef.current.set(id, node);
    else slideNodesRef.current.delete(id);
  };
  const registerExportNode = (id: string, node: HTMLDivElement | null) => {
    if (node) exportNodesRef.current.set(id, node);
    else exportNodesRef.current.delete(id);
  };

  const hasAnySlideFilled = carousel.slides.some(
    (s) => (s.heading?.trim() ?? "") !== "" || s.body.trim() !== "",
  );

  const filledCount = carousel.slides.filter(
    (s) => (s.heading?.trim() ?? "") !== "" || s.body.trim() !== "",
  ).length;
  const imageCount = carousel.slides.filter((s) => s.image.kind !== "none").length;

  // Carrega carrossel do DB se houver ?carouselId
  useEffect(() => {
    if (!carouselIdParam) return;
    if (carousel.id === carouselIdParam) return;
    let canceled = false;
    loadCarousel(carouselIdParam)
      .then((c) => {
        if (canceled || !c) return;
        setCarousel(c);
        setBriefing(c.briefing ?? "");
        setSlideCount(c.slides.length);
        toast.success(`Carrossel "${c.title}" carregado`);
      })
      .catch((err) => {
        console.error("[ViralSequenceV2] loadCarousel failed:", err);
        toast.error("Falha ao carregar carrossel");
      });
    return () => {
      canceled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carouselIdParam]);

  // Pré-popula briefing vindo do Viral Hunter
  useEffect(() => {
    if (!seedBriefingParam) return;
    const decoded = decodeURIComponent(seedBriefingParam);
    setBriefing(decoded);
    const seedTitle = searchParams.get("seedTitle");
    if (seedTitle) {
      setCarousel((c) => ({ ...c, title: decodeURIComponent(seedTitle).slice(0, 60) }));
    }
    setSearchParams((sp) => {
      const next = new URLSearchParams(sp);
      next.delete("seedBriefing");
      next.delete("seedTitle");
      return next;
    });
    toast.success("Briefing carregado do Viral Hunter — clique 'Gerar carrossel'.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedBriefingParam]);

  // Autosave local
  useEffect(() => {
    saveDraft(carousel);
  }, [carousel]);

  // Atalho P → preview
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!hasAnySlideFilled) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
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

  // Reset state quando o cliente troca (sem ?carouselId param)
  useEffect(() => {
    if (carousel.clientId !== clientId && !carouselIdParam) {
      setCarousel(emptyCarousel(clientId, buildInitialProfile(client)));
      setBriefing("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  /* ──────────────────────────── Handlers ──────────────────────────── */

  const handleGenerate = useCallback(async () => {
    if (!briefing.trim()) {
      toast.error("Escreva um briefing/tema pra gerar.");
      return;
    }
    try {
      const res = await generateRaw({
        clientId,
        briefing: briefing.trim(),
        tone,
        slideCount,
        profile: carousel.profile,
        language,
      });
      setCarousel((c) => ({
        ...c,
        title: res.title,
        briefing: briefing.trim(),
        tone,
        language,
        slides: res.slides,
        profile: res.profile,
        updatedAt: new Date().toISOString(),
      }));
      toast.success("Carrossel gerado! Ajuste copies e adicione imagens.");
    } catch (err) {
      console.error("[ViralSequenceV2] generate failed:", err);
      toast.error(`Falha na geração: ${(err as Error).message}`);
    }
  }, [briefing, tone, slideCount, language, clientId, carousel.profile, generateRaw]);

  const handleReset = () => {
    if (!confirm("Descartar carrossel atual e começar do zero?")) return;
    clearDraft();
    setCarousel(emptyCarousel(clientId, buildInitialProfile(client)));
    setBriefing("");
    setSearchParams((sp) => {
      const next = new URLSearchParams(sp);
      next.delete("carouselId");
      return next;
    });
    toast.success("Rascunho descartado.");
  };

  const handleSelectSaved = (id: string) => {
    setSearchParams((sp) => {
      const next = new URLSearchParams(sp);
      next.set("carouselId", id);
      return next;
    });
  };

  const handleNewFromSidebar = () => {
    clearDraft();
    setCarousel(emptyCarousel(clientId, buildInitialProfile(client)));
    setBriefing("");
    setSearchParams((sp) => {
      const next = new URLSearchParams(sp);
      next.delete("carouselId");
      return next;
    });
  };

  const getSaveContext = async (): Promise<{ workspaceId: string; userId: string } | null> => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) {
      toast.error("Faça login pra salvar");
      return null;
    }
    const { data: clientRow } = await supabase
      .from("clients")
      .select("workspace_id")
      .eq("id", clientId)
      .single();
    if (!clientRow?.workspace_id) {
      toast.error("Workspace do cliente não encontrado");
      return null;
    }
    return { workspaceId: clientRow.workspace_id as string, userId };
  };

  const handleSave = async () => {
    if (!hasAnySlideFilled) {
      toast.error("Gere ou edite slides antes de salvar.");
      return;
    }
    setIsSaving(true);
    try {
      const ctx = await getSaveContext();
      if (!ctx) return;
      const saved = await saveCarousel(carousel, ctx);
      setCarousel(saved);
      setSearchParams((sp) => {
        const next = new URLSearchParams(sp);
        next.set("carouselId", saved.id);
        return next;
      });
      toast.success("Carrossel salvo");
    } catch (err) {
      console.error("[ViralSequenceV2] save failed:", err);
      toast.error(`Falha ao salvar: ${(err as Error).message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendToPlanning = async () => {
    if (!hasAnySlideFilled) {
      toast.error("Gere os slides antes de mandar pro planejamento.");
      return;
    }
    setIsSendingToPlanning(true);
    try {
      const ctx = await getSaveContext();
      if (!ctx) return;
      const saved = await saveCarousel(carousel, ctx);

      const { data: cols } = await supabase
        .from("kanban_columns")
        .select("id")
        .eq("workspace_id", ctx.workspaceId)
        .in("column_type", ["draft", "idea"])
        .order("position", { ascending: true })
        .limit(1);
      const columnId = cols?.[0]?.id ?? null;
      if (!columnId) {
        toast.error("Nenhuma coluna disponível no Planejamento");
        return;
      }

      const { data: pi, error: piErr } = await supabase
        .from("planning_items")
        .insert({
          workspace_id: ctx.workspaceId,
          client_id: clientId,
          column_id: columnId,
          title: saved.title,
          content: saved.slides
            .map((s, i) => `=== Slide ${i + 1} ===\n${s.heading ? `**${s.heading}**\n` : ""}${s.body}`)
            .join("\n\n"),
          platform: "instagram",
          content_type: "viral_carousel",
          status: "draft",
          created_by: ctx.userId,
          metadata: {
            source: "kai:viral_sequence_v2:manual",
            content_type: "viral_carousel",
            viral_carousel_id: saved.id,
            viral_carousel_briefing: saved.briefing ?? null,
            viral_carousel_template: saved.template,
            viral_carousel_slides: saved.slides,
          },
        } as never)
        .select("id")
        .single();
      if (piErr) throw piErr;

      await supabase
        .from("viral_carousels")
        .update({ planning_item_id: (pi as any).id })
        .eq("id", saved.id);

      setCarousel(saved);
      toast.success("Mandado pro Planejamento", {
        action: {
          label: "Abrir",
          onClick: () =>
            navigate(`/kaleidos?client=${clientId}&tab=planning&item=${(pi as any).id}`),
        },
      });
    } catch (err) {
      console.error("[ViralSequenceV2] sendToPlanning failed:", err);
      toast.error(`Falha: ${(err as Error).message}`);
    } finally {
      setIsSendingToPlanning(false);
    }
  };

  const handleAutoImages = async () => {
    const ctaId = carousel.slides[carousel.slides.length - 1]?.id;
    const result = await fillImages({
      briefing: carousel.briefing ?? briefing,
      title: carousel.title,
      slides: carousel.slides,
      skipIds: ctaId ? [ctaId] : [],
    });
    if (result.updates.length === 0) {
      toast.info("Nenhum slide precisa de imagem (CTA pulado, marcados como 'Sem imagem' respeitados).");
      return;
    }
    setCarousel((c) => ({
      ...c,
      updatedAt: new Date().toISOString(),
      slides: c.slides.map((s) => {
        const u = result.updates.find((x) => x.id === s.id);
        return u ? { ...s, image: u.image, imageQuery: u.query } : s;
      }),
    }));
    if (result.ok > 0) {
      toast.success(
        `${result.ok} imagens adicionadas${result.failed > 0 ? ` · ${result.failed} sem resultado` : ""}.`,
      );
    } else {
      toast.error("Nenhuma imagem encontrada. Tente buscar manualmente.");
    }
  };

  const handleExportZip = async () => {
    setIsExporting(true);
    try {
      const { ok, failed } = await exportCarouselAsZip(
        carousel,
        exportNodesRef.current as unknown as Map<string, HTMLElement>,
      );
      if (ok === 0) toast.error("Falha ao gerar ZIP. Tenta de novo.");
      else if (failed > 0) toast.warning(`ZIP baixado com ${ok} slides · ${failed} falharam.`);
      else toast.success(`ZIP baixado com ${ok} slides em 1080×1350. Pronto pro Instagram.`);
    } catch (err) {
      toast.error(`Falha: ${(err as Error).message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPngs = async () => {
    setIsExporting(true);
    try {
      const { ok, failed } = await exportCarouselAsPngs(
        carousel,
        exportNodesRef.current as unknown as Map<string, HTMLElement>,
      );
      if (failed > 0) toast.warning(`${ok} PNGs · ${failed} falharam (CORS).`);
      else toast.success(`${ok} PNGs baixados!`);
    } catch (err) {
      toast.error(`Falha: ${(err as Error).message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      const { ok, failed } = await exportCarouselAsPdf(
        carousel,
        exportNodesRef.current as unknown as Map<string, HTMLElement>,
      );
      if (failed > 0) toast.warning(`PDF gerado com ${ok} slides · ${failed} falharam`);
      else toast.success(`PDF baixado com ${ok} slides!`);
    } catch (err) {
      toast.error(`Falha: ${(err as Error).message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(carousel, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `carrossel-${carousel.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const currentTemplateMeta = useMemo(
    () => TEMPLATES_META.find((t) => t.id === carousel.template) ?? TEMPLATES_META[0],
    [carousel.template],
  );

  /* ────────────────────────────── Render ────────────────────────────── */

  return (
    <div className="flex h-full overflow-hidden">
      <SavedCarouselsSidebar
        clientId={clientId}
        currentId={carousel.id}
        onSelect={handleSelectSaved}
        onNew={handleNewFromSidebar}
      />

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="border-b border-border/30 bg-gradient-to-b from-sky-50/30 to-background dark:from-sky-950/20 backdrop-blur-sm px-6 py-4 shrink-0">
          <div className="flex items-start gap-3 flex-wrap">
            <div className="p-2 rounded-lg bg-sky-500 text-white shadow-sm shadow-sky-500/30 shrink-0">
              <Twitter className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-[200px]">
              <h2 className="text-lg font-semibold flex items-center gap-2 flex-wrap">
                Sequência Viral
                <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">
                  v2
                </span>
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
                Carrossel editorial — KAI escreve e diagrama, você ajusta. 8 templates,
                heading + body, layers, auto-imagens.
              </p>
            </div>

            {hasAnySlideFilled && (
              <div className="flex items-center gap-1.5 flex-wrap shrink-0 ml-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTemplatePickerOpen(true)}
                  className="gap-1.5 h-8"
                >
                  <Palette className="h-3.5 w-3.5" />
                  {currentTemplateMeta.name}
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewOpen(true)}
                  className="gap-1.5 h-8"
                  title="Preview (atalho: P)"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Preview
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAutoImages}
                  disabled={isAutoImaging}
                  className="gap-1.5 h-8 border-sky-300/60 dark:border-sky-700/40 text-sky-700 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40"
                >
                  {isAutoImaging ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileImage className="h-3.5 w-3.5" />
                  )}
                  Auto-imagens
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5 h-8" disabled={isExporting}>
                      {isExporting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5" />
                      )}
                      Exportar
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={handleExportZip} className="gap-2">
                      <FileArchive className="h-4 w-4" />
                      <div>
                        <div className="text-sm">ZIP</div>
                        <div className="text-[10px] text-muted-foreground">
                          1 download · todos slides
                        </div>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportPngs} className="gap-2">
                      <FileImage className="h-4 w-4" />
                      <div>
                        <div className="text-sm">PNGs</div>
                        <div className="text-[10px] text-muted-foreground">
                          1 imagem por slide
                        </div>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportPdf} className="gap-2">
                      <FileText className="h-4 w-4" />
                      <div>
                        <div className="text-sm">PDF</div>
                        <div className="text-[10px] text-muted-foreground">
                          Todos slides em um arquivo
                        </div>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportJson} className="gap-2">
                      <Download className="h-4 w-4" />
                      <div>
                        <div className="text-sm">JSON</div>
                        <div className="text-[10px] text-muted-foreground">
                          Estrutura completa
                        </div>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleReset}
                      className="gap-2 text-destructive focus:text-destructive"
                    >
                      <RotateCcw className="h-4 w-4" />
                      <div>
                        <div className="text-sm">Zerar carrossel</div>
                        <div className="text-[10px] text-muted-foreground">Descarta tudo</div>
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="gap-1.5 h-8"
                >
                  {isSaving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  Salvar
                </Button>
                <Button
                  size="sm"
                  onClick={handleSendToPlanning}
                  disabled={isSendingToPlanning}
                  className="gap-1.5 h-8 bg-sky-600 hover:bg-sky-700 text-white shadow-sm shadow-sky-600/30"
                >
                  {isSendingToPlanning ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ListTodo className="h-3.5 w-3.5" />
                  )}
                  Mandar pro Planejamento
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-6 space-y-6">
            <BriefingPanel
              briefing={briefing}
              onBriefingChange={setBriefing}
              tone={tone}
              onToneChange={setTone}
              language={language}
              onLanguageChange={setLanguage}
              slideCount={slideCount}
              onSlideCountChange={setSlideCount}
              loading={isGenerating}
              onGenerate={handleGenerate}
              compact={hasAnySlideFilled}
            />

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
                      clientId={clientId}
                      templateId={carousel.template}
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

        {/* Off-screen renderer pra captura PNG/PDF/ZIP */}
        {hasAnySlideFilled && (
          <OffscreenSlideRenderer carousel={carousel} registerRef={registerExportNode} />
        )}

        {/* Modals */}
        <CarouselFullPreview
          carousel={carousel}
          open={previewOpen}
          onOpenChange={setPreviewOpen}
        />
        <Dialog open={templatePickerOpen} onOpenChange={setTemplatePickerOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Trocar template visual</DialogTitle>
              <DialogDescription>
                Aplica ao carrossel inteiro — tipografia, paleta e layout.
              </DialogDescription>
            </DialogHeader>
            <TemplatePicker
              value={carousel.template}
              onChange={(t: ViralTemplateId) => {
                setCarousel((c) => ({
                  ...c,
                  template: t,
                  updatedAt: new Date().toISOString(),
                }));
                setTemplatePickerOpen(false);
              }}
              large
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function EmptyState() {
  const steps = [
    { n: "01", label: "KAI gera os slides", desc: "Capa + insights + CTA" },
    { n: "02", label: "Você edita", desc: "Heading, body, imagem, layout" },
    { n: "03", label: "Publica", desc: "ZIP / PDF / Planejamento" },
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
        <Sparkles className="h-3.5 w-3.5 text-sky-500" />
        <span>Próximo passo: escreva um briefing acima e clique em "Gerar carrossel"</span>
      </div>
    </div>
  );
}
