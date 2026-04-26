/**
 * CarouselFullPreview — dialog em tela cheia que mostra o carrossel
 * navegável estilo Instagram (swipe horizontal com botões + keyboard).
 *
 * Útil pra review antes de publicar. Mostra contador X/8, thumbnails
 * abaixo, e atalhos ← → pra navegar.
 */

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TwitterSlide } from "./TwitterSlide";
import type { ViralCarousel } from "./types";

interface CarouselFullPreviewProps {
  carousel: ViralCarousel;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CarouselFullPreview({
  carousel,
  open,
  onOpenChange,
}: CarouselFullPreviewProps) {
  const [index, setIndex] = useState(0);

  const slides = carousel.slides;
  const total = slides.length;

  useEffect(() => {
    if (!open) setIndex(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setIndex((i) => Math.min(total - 1, i + 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, total, onOpenChange]);

  const current = slides[index];
  if (!current) return null;

  const imageUrl =
    current.image.kind === "none" ? undefined : current.image.url;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1100px] p-0 gap-0 overflow-hidden bg-neutral-950 border-neutral-800">
        <DialogTitle className="sr-only">Preview do carrossel</DialogTitle>

        {/* Close button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onOpenChange(false)}
          className="absolute top-3 right-3 z-20 h-8 w-8 p-0 text-white/80 hover:text-white hover:bg-white/10"
        >
          <X className="h-4 w-4" />
        </Button>

        {/* Counter */}
        <div className="absolute top-4 left-4 z-20 text-xs text-white/70 font-mono bg-black/40 backdrop-blur-sm rounded-full px-3 py-1">
          {index + 1} / {total}
        </div>

        {/* Stage */}
        <div className="relative flex items-center justify-center bg-neutral-950 min-h-[720px]">
          {/* Prev button */}
          <Button
            variant="ghost"
            size="sm"
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-10 h-10 w-10 p-0 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-30"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>

          <div className="transition-all duration-200">
            <TwitterSlide
              body={current.body || "(slide vazio)"}
              imageUrl={imageUrl}
              imageAsCover={current.imageAsCover === true && current.image.kind !== "none"}
              coverTextStyle={current.coverTextStyle}
              editorial={current.editorial}
              imageAttribution={
                current.image.kind === "search" ? current.image.attribution : undefined
              }
              slideNumber={current.order}
              totalSlides={total}
              profile={carousel.profile}
              scale={0.5}
            />
          </div>

          <Button
            variant="ghost"
            size="sm"
            disabled={index === total - 1}
            onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-10 h-10 w-10 p-0 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-30"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Thumbnails */}
        <div className="flex items-center gap-1.5 px-4 py-3 bg-neutral-900 border-t border-neutral-800 overflow-x-auto">
          {slides.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setIndex(i)}
              className={cn(
                "shrink-0 rounded-md overflow-hidden transition-all border-2",
                i === index
                  ? "border-sky-500 ring-1 ring-sky-500/50"
                  : "border-transparent opacity-50 hover:opacity-80",
              )}
              title={`Slide ${s.order}`}
            >
              <TwitterSlide
                body={s.body}
                imageUrl={s.image.kind === "none" ? undefined : s.image.url}
                imageAsCover={s.imageAsCover === true && s.image.kind !== "none"}
                coverTextStyle={s.coverTextStyle}
                editorial={s.editorial}
                slideNumber={s.order}
                totalSlides={total}
                profile={carousel.profile}
                scale={0.08}
              />
            </button>
          ))}
          <div className="ml-auto text-[10px] text-white/40 font-mono px-2">
            ←/→ navega · Esc fecha
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
