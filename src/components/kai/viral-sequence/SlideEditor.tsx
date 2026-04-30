/**
 * SlideEditor — edita 1 slide do carrossel.
 *
 * Layout: preview do slide no topo (scale ~0.28), campos abaixo (body
 * textarea + linha de ações de imagem).
 *
 * Padrão Madureira (single layout): cada slide é um tweet único. Imagem,
 * quando presente, aparece ABAIXO do texto. Sem variantes de capa/editorial.
 *
 * Ações de imagem (linha 1): [IA] [Buscar] [Upload] [Sem imagem]
 * Ações secundárias (linha 2, só quando há imagem): [Preview] [Remover]
 */

import { useRef, useState } from "react";
import {
  Sparkles,
  Search,
  Upload,
  X,
  ImageIcon,
  Rocket,
  Flag,
  Target,
  Loader2,
  Maximize2,
  Ban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ViralSlide, ViralProfile, ImageSource } from "./types";
import { getImageUrl } from "./types";
import { TwitterSlide } from "./TwitterSlide";
import { searchImages, type ImageSearchResult } from "./imageSearch";
import { supabase } from "@/integrations/supabase/client";

interface SlideEditorProps {
  slide: ViralSlide;
  totalSlides: number;
  profile: ViralProfile;
  clientId: string;
  onChange: (next: ViralSlide) => void;
  onRemove?: () => void;
  /** Callback que recebe o ref do nó do TwitterSlide — usado pra export PNG/PDF. */
  onSlideNode?: (slideId: string, node: HTMLElement | null) => void;
}

export function SlideEditor({ slide, totalSlides, profile, clientId, onChange, onSlideNode }: SlideEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [fullPreviewOpen, setFullPreviewOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [searchResults, setSearchResults] = useState<ImageSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  const setImage = (image: ImageSource) =>
    onChange({ ...slide, image });

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      setImage({ kind: "upload", url, filename: file.name });
      toast.success("Imagem enviada.");
    };
    reader.onerror = () => toast.error("Falha ao ler o arquivo.");
    reader.readAsDataURL(file);
  };

  const runSearch = async (q: string) => {
    if (!q.trim()) {
      toast.error("Informe um termo pra buscar.");
      return;
    }
    setSearchLoading(true);
    try {
      const res = await searchImages(q, { perPage: 12, source: "pexels" });
      setSearchResults(res.items);
      if (res.items.length === 0) {
        toast.info("Nenhuma imagem encontrada — tente outro termo (em inglês geralmente rende mais).");
      }
    } catch (err) {
      toast.error(`Falha na busca: ${(err as Error).message}`);
    } finally {
      setSearchLoading(false);
    }
  };

  const pickImage = (item: ImageSearchResult) => {
    setImage({
      kind: "search",
      query: searchQuery.trim() || slide.body.slice(0, 40),
      url: item.url,
      attribution: item.attribution,
      sourceUrl: item.sourceUrl,
    } as ImageSource);
    setSearchDialogOpen(false);
    toast.success("Imagem aplicada ao slide.");
  };

  const openSearch = () => {
    const initial = slide.body.slice(0, 60);
    setSearchQuery(initial);
    setSearchResults([]);
    setSearchDialogOpen(true);
    if (initial.trim()) {
      void runSearch(initial);
    }
  };

  const handleAiGenerate = async () => {
    const prompt = aiPrompt.trim();
    if (!prompt) {
      toast.error("Descreva a imagem que você quer gerar.");
      return;
    }
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-content-v2", {
        body: {
          type: "image",
          inputs: [{ type: "text", content: prompt }],
          config: {
            format: "carousel",
            platform: "instagram",
            aspectRatio: "4:5",
            noText: true,
          },
          clientId,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      const url: string | undefined = data?.imageUrl || data?.image_url;
      if (!url) throw new Error("Nenhuma imagem retornada.");
      setImage({ kind: "ai", prompt, url });
      setAiDialogOpen(false);
      toast.success("Imagem IA aplicada ao slide.");
    } catch (err) {
      console.error("[SlideEditor] AI image gen failed:", err);
      toast.error(`Falha ao gerar imagem: ${(err as Error).message}`);
    } finally {
      setAiLoading(false);
    }
  };

  const currentImageUrl = getImageUrl(slide.image);
  const isSkipped = slide.image.kind === "skip";
  const hasImage = currentImageUrl !== undefined;

  const isCover = slide.order === 1;
  const isCta = slide.order === totalSlides;
  const roleLabel = isCover ? "Capa" : isCta ? "CTA" : "Insight";
  const RoleIcon = isCover ? Flag : isCta ? Target : Rocket;
  const roleColor = isCover
    ? "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400"
    : isCta
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
      : "bg-muted text-muted-foreground";

  const bodyOver = slide.body.length > 280;

  return (
    <div
      className={cn(
        "bg-card border border-border/40 rounded-xl overflow-hidden flex flex-col",
        "hover:shadow-md transition-shadow",
        (isCover || isCta) && "ring-1 ring-border/30",
      )}
    >
      {/* Preview */}
      <div className="bg-gradient-to-b from-muted/30 to-muted/60 p-3 flex items-center justify-center border-b border-border/30 relative">
        <span className="absolute top-2 left-2 flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider font-semibold text-muted-foreground bg-background/80 backdrop-blur-sm px-1.5 py-0.5 rounded">
          {String(slide.order).padStart(2, "0")}
        </span>
        <span
          className={cn(
            "absolute top-2 right-2 flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded",
            roleColor,
          )}
        >
          <RoleIcon className="h-2.5 w-2.5" />
          {roleLabel}
        </span>
        {isSkipped && (
          <span className="absolute bottom-2 left-2 flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider font-semibold text-muted-foreground bg-background/80 backdrop-blur-sm px-1.5 py-0.5 rounded">
            <Ban className="h-2.5 w-2.5" />
            Sem imagem
          </span>
        )}
        <div className="drop-shadow-md">
          <TwitterSlide
            ref={(n: HTMLDivElement | null) => onSlideNode?.(slide.id, n)}
            body={slide.body || "Texto do slide..."}
            imageUrl={currentImageUrl}
            slideNumber={slide.order}
            totalSlides={totalSlides}
            profile={profile}
            scale={0.28}
          />
        </div>
      </div>

      {/* Fields */}
      <div className="p-3 pt-2.5 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Slide {slide.order}/{totalSlides}
          </span>
          <span className={cn(
            "text-[10px] font-mono",
            bodyOver ? "text-destructive font-semibold" : "text-muted-foreground",
          )}>
            {slide.body.length}/280
          </span>
        </div>

        <Textarea
          value={slide.body}
          onChange={(e) => onChange({ ...slide, body: e.target.value })}
          placeholder="Escreva o tweet do slide. Use **bold** pra destacar trechos."
          className="text-sm resize-none min-h-[120px] max-h-[200px] leading-relaxed"
          rows={5}
        />

        {/* Image action bar — linha 1: tipo de imagem */}
        <div className="flex items-center gap-1.5 pt-1 flex-wrap">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground mr-0.5">
            <ImageIcon className="h-3 w-3" />
          </div>
          <ImageButton
            label="IA"
            icon={<Sparkles className="h-3 w-3" />}
            active={slide.image.kind === "ai"}
            onClick={() => {
              setAiPrompt(slide.body.slice(0, 60));
              setAiDialogOpen(true);
            }}
          />
          <ImageButton
            label={slide.image.kind === "search" ? "Trocar" : "Buscar"}
            icon={<Search className="h-3 w-3" />}
            active={slide.image.kind === "search"}
            onClick={openSearch}
          />
          <ImageButton
            label="Upload"
            icon={<Upload className="h-3 w-3" />}
            active={slide.image.kind === "upload"}
            onClick={() => fileInputRef.current?.click()}
          />
          <ImageButton
            label={isSkipped ? "Sem img ✓" : "Sem img"}
            icon={<Ban className="h-3 w-3" />}
            active={isSkipped}
            onClick={() => setImage(isSkipped ? { kind: "none" } : { kind: "skip" })}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
        </div>

        {/* Linha 2: ações secundárias só quando há imagem real */}
        {hasImage && (
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-[11px] gap-1"
              onClick={() => setFullPreviewOpen(true)}
              title="Ver slide em tamanho real (1080×1350)"
            >
              <Maximize2 className="h-3 w-3" />
              Preview
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-[11px] gap-1 text-muted-foreground hover:text-destructive ml-auto"
              onClick={() => setImage({ kind: "none" })}
              title="Remover imagem"
            >
              <X className="h-3 w-3" />
              Remover
            </Button>
          </div>
        )}
      </div>

      {/* Dialog: buscar imagem (galeria) */}
      <Dialog open={searchDialogOpen} onOpenChange={setSearchDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Buscar imagem</DialogTitle>
            <DialogDescription>
              Clica numa miniatura para aplicar ao slide. Termos em inglês geralmente rendem mais resultados.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ex: bitcoin, laptop, sunset, escritorio..."
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void runSearch(searchQuery);
                }
              }}
            />
            <Button onClick={() => void runSearch(searchQuery)} disabled={!searchQuery.trim() || searchLoading}>
              {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Buscar
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto -mx-6 px-6 min-h-[300px]">
            {searchLoading && (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}
            {!searchLoading && searchResults.length === 0 && (
              <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
                {searchQuery.trim() ? "Nenhum resultado. Tente outro termo." : "Digite um termo e clique em Buscar."}
              </div>
            )}
            {!searchLoading && searchResults.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {searchResults.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => pickImage(item)}
                    className="group relative aspect-video rounded-md overflow-hidden border border-border/40 hover:border-primary hover:ring-2 hover:ring-primary/40 transition-all bg-muted"
                    title={item.attribution}
                  >
                    <img
                      src={item.thumbnail}
                      alt=""
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setSearchDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: gerar imagem com IA */}
      <Dialog open={aiDialogOpen} onOpenChange={(o) => !aiLoading && setAiDialogOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Gerar imagem com IA</DialogTitle>
            <DialogDescription>
              Usa o Nano Banana com as referências visuais do cliente.
              Sem texto na imagem — proporção 4:5 (Instagram).
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="Descreva a imagem ideal (ex: laptop na mesa de madeira com café, luz suave, minimalista)"
            rows={4}
            disabled={aiLoading}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAiDialogOpen(false)} disabled={aiLoading}>
              Fechar
            </Button>
            <Button onClick={handleAiGenerate} disabled={!aiPrompt.trim() || aiLoading} className="gap-2">
              {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {aiLoading ? "Gerando..." : "Gerar imagem"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: preview do slide em tamanho real (1080×1350) */}
      <Dialog open={fullPreviewOpen} onOpenChange={setFullPreviewOpen}>
        <DialogContent className="max-w-[720px] p-0 gap-0 bg-neutral-950 border-neutral-800 overflow-hidden">
          <DialogHeader className="p-4 pb-2 border-b border-neutral-800">
            <DialogTitle className="text-white text-sm">
              Preview · Slide {slide.order} (1080×1350 — tamanho final Instagram)
            </DialogTitle>
            <DialogDescription className="text-neutral-400 text-xs">
              É exatamente assim que o slide vai sair quando você exportar e postar.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center p-6 bg-neutral-900">
            <TwitterSlide
              body={slide.body || "Texto do slide..."}
              imageUrl={currentImageUrl}
              slideNumber={slide.order}
              totalSlides={totalSlides}
              profile={profile}
              scale={0.5}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ImageButton({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      size="sm"
      variant={active ? "default" : "outline"}
      className={cn("h-7 text-[11px] gap-1 px-2", active && "bg-primary text-primary-foreground")}
      onClick={onClick}
    >
      {icon}
      {label}
    </Button>
  );
}
