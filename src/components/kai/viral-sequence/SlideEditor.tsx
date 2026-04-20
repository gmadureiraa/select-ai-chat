/**
 * SlideEditor — edita 1 slide do carrossel.
 *
 * Layout: preview do slide no topo (scale ~0.28), campos abaixo (heading
 * textarea + body textarea + linha de ações de imagem).
 *
 * Ações de imagem: [Gerar IA] [Buscar] [Upload] [Remover]
 * - Gerar IA → TODO (placeholder mostra "em breve" / poderá plugar
 *   edge function futura). Por ora abre um dialog com o prompt e marca
 *   como futuro.
 * - Buscar → busca imagem via Unsplash Source (searchImage), atualiza
 *   imageUrl. Clicar de novo pega outra imagem aleatória.
 * - Upload → input type=file + FileReader pra base64 (imagem fica
 *   embutida no slide; pro Lovable depois mover pra Supabase Storage).
 * - Remover → volta pra kind:"none".
 */

import { useRef, useState } from "react";
import {
  Sparkles,
  Search,
  Upload,
  X,
  RefreshCw,
  ImageIcon,
  Rocket,
  Flag,
  Target,
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
import { TwitterSlide } from "./TwitterSlide";
import { searchImages, type ImageSearchResult } from "./imageSearch";

interface SlideEditorProps {
  slide: ViralSlide;
  totalSlides: number;
  profile: ViralProfile;
  onChange: (next: ViralSlide) => void;
  onRemove?: () => void;
  /** Callback que recebe o ref do nó do TwitterSlide — usado pra export PNG/PDF. */
  onSlideNode?: (slideId: string, node: HTMLElement | null) => void;
}

export function SlideEditor({ slide, totalSlides, profile, onChange, onSlideNode }: SlideEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");

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

  const handleSearch = () => {
    const q = searchQuery.trim() || slide.body.slice(0, 40);
    if (!q) {
      toast.error("Informe um termo pra buscar.");
      return;
    }
    const url = searchImage(q);
    setImage({ kind: "search", query: q, url });
    setSearchDialogOpen(false);
    toast.success("Imagem encontrada. Clica de novo no ícone pra trocar.");
  };

  const handleReShuffle = () => {
    if (slide.image.kind !== "search") return;
    setImage({ ...slide.image, url: searchImage(slide.image.query) });
  };

  const handleAiStub = () => {
    toast.info(
      "Geração IA: em breve (precisa de edge function dedicada). Por ora use 'Buscar' ou 'Upload'.",
      { duration: 4000 },
    );
    setAiDialogOpen(false);
  };

  const currentImageUrl =
    slide.image.kind === "none" ? undefined : slide.image.url;

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
      <div className="bg-gradient-to-b from-muted/30 to-muted/60 p-4 flex items-center justify-center border-b border-border/30 relative">
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
      <div className="p-3 space-y-2">
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

        {/* Image action bar */}
        <div className="flex items-center gap-1 pt-1">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground mr-1">
            <ImageIcon className="h-3 w-3" />
            <span className="hidden sm:inline">Imagem:</span>
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
            label={slide.image.kind === "search" ? "Outra" : "Buscar"}
            icon={
              slide.image.kind === "search" ? (
                <RefreshCw className="h-3 w-3" />
              ) : (
                <Search className="h-3 w-3" />
              )
            }
            active={slide.image.kind === "search"}
            onClick={() => {
              if (slide.image.kind === "search") {
                handleReShuffle();
              } else {
                setSearchQuery(slide.body.slice(0, 60));
                setSearchDialogOpen(true);
              }
            }}
          />
          <ImageButton
            label="Upload"
            icon={<Upload className="h-3 w-3" />}
            active={slide.image.kind === "upload"}
            onClick={() => fileInputRef.current?.click()}
          />
          {slide.image.kind !== "none" && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive ml-auto"
              onClick={() => setImage({ kind: "none" })}
              title="Remover imagem"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
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
      </div>

      {/* Dialog: buscar imagem */}
      <Dialog open={searchDialogOpen} onOpenChange={setSearchDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Buscar imagem</DialogTitle>
            <DialogDescription>
              Busca via Unsplash — qualquer termo funciona (em inglês geralmente rende mais resultados).
            </DialogDescription>
          </DialogHeader>
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ex: bitcoin, laptop, sunset..."
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSearch();
              }
            }}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSearchDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSearch} disabled={!searchQuery.trim()}>
              Buscar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: IA (stub) */}
      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Gerar imagem com IA</DialogTitle>
            <DialogDescription>
              Em breve — vai usar a mesma infra de geração de imagem do KAI.
              Por ora o campo só registra o prompt pra integrar depois.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="Descreva a imagem ideal (ex: laptop na mesa de madeira com café, luz suave, minimalista)"
            rows={4}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAiDialogOpen(false)}>
              Fechar
            </Button>
            <Button onClick={handleAiStub} disabled={!aiPrompt.trim()}>
              Gerar (em breve)
            </Button>
          </DialogFooter>
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
